module swappy::auction;

use std::option;
use std::vector;

use sui::clock::{Self, Clock};
use sui::dynamic_field;

use swappy::auction_book::{Self, AuctionBook};
use swappy::auction_book::{AuctionKey, auction_key};
use swappy::intent;

/// === Error codes ===
const EAuctionNotFound: u64 = 300;
const EAuctionInvalidStatus: u64 = 301;
const EDeadlineInvalid: u64 = 302;
const ETooManyIntents: u64 = 303;
const EDuplicateIntent: u64 = 304;
const EAttachAfterDeadline: u64 = 305;

const AUCTION_OPEN: u8 = 0;
const AUCTION_SETTLED: u8 = 1;

/// Public status helpers (constants are module-private in Move).
public fun status_open(): u8 { AUCTION_OPEN }
public fun status_settled(): u8 { AUCTION_SETTLED }

/// Auction state stored as a dynamic field under AuctionBook.
public struct Auction has store {
    auction_id: u64,
    intent_ids: vector<u64>, // ≤ 10
    status: u8,              // OPEN | SETTLED
    created_at_ms: u64,
    deadline_ms: u64,
}

/// --- Read-only accessors ---
public fun intent_ids(auc: &Auction): &vector<u64> { &auc.intent_ids }
public fun deadline_ms(auc: &Auction): u64 { auc.deadline_ms }
public fun status(auc: &Auction): u8 { auc.status }

/// --- Internal setters (used by other trusted protocol modules only) ---
public(package) fun set_status(auc: &mut Auction, s: u8) { auc.status = s }

public fun exists(book: &AuctionBook, auction_id: u64): bool {
    dynamic_field::exists_with_type<AuctionKey, Auction>(auction_book::uid(book), auction_key(auction_id))
}

public fun borrow(book: &AuctionBook, auction_id: u64): &Auction {
    assert!(exists(book, auction_id), EAuctionNotFound);
    dynamic_field::borrow<AuctionKey, Auction>(auction_book::uid(book), auction_key(auction_id))
}

public fun borrow_mut(book: &mut AuctionBook, auction_id: u64): &mut Auction {
    assert!(exists(book, auction_id), EAuctionNotFound);
    dynamic_field::borrow_mut<AuctionKey, Auction>(auction_book::uid_mut(book), auction_key(auction_id))
}

public fun add(book: &mut AuctionBook, auction: Auction) {
    dynamic_field::add<AuctionKey, Auction>(auction_book::uid_mut(book), auction_key(auction.auction_id), auction)
}

public fun assert_open(auction: &Auction) {
    assert!(auction.status == AUCTION_OPEN, EAuctionInvalidStatus);
}

public fun assert_before_deadline(clock: &Clock, deadline_ms: u64) {
    let now = clock::timestamp_ms(clock);
    assert!(now < deadline_ms, EDeadlineInvalid);
}

/// 7.4 Create Auction
public entry fun create_auction(
    auction_book: &mut AuctionBook,
    clock: &Clock,
    deadline_ms: u64,
) {
    let now = clock::timestamp_ms(clock);
    assert!(deadline_ms > now, EDeadlineInvalid);
    let auction_id = auction_book::alloc_auction_id(auction_book);
    let auc = Auction {
        auction_id,
        intent_ids: vector::empty(),
        status: status_open(),
        created_at_ms: now,
        deadline_ms,
    };
    add(auction_book, auc);
}

/// 7.5 Attach Intents
public entry fun attach_intents(
    auction_book: &mut AuctionBook,
    auction_id: u64,
    intent_ids: vector<u64>,
    clock: &Clock,
) {
    // Read auction state first (immutable borrow), then update intents, then append to auction.
    let (deadline_ms, existing) = {
        let auc_r = borrow(auction_book, auction_id);
        assert_open(auc_r);
        (auc_r.deadline_ms, vector::length(&auc_r.intent_ids))
    };
    assert!(clock::timestamp_ms(clock) < deadline_ms, EAttachAfterDeadline);

    let max = auction_book::max_intents_per_auction(auction_book);
    let n = vector::length(&intent_ids);
    assert!(existing + n <= max, ETooManyIntents);

    // Ensure no duplicates in provided list.
    let mut i = 0;
    while (i < n) {
        let id_i = *vector::borrow(&intent_ids, i);
        let mut j = i + 1;
        while (j < n) {
            assert!(*vector::borrow(&intent_ids, j) != id_i, EDuplicateIntent);
            j = j + 1;
        };
        i = i + 1;
    };

    // Attach each intent: OPEN_ESCROWED -> BATCHED
    let mut k = 0;
    while (k < n) {
        let intent_id = *vector::borrow(&intent_ids, k);
        let ir = intent::borrow_intent_mut(auction_book, intent_id);
        assert!(intent::status(ir) == intent::status_open_escrowed(), EAuctionInvalidStatus);
        assert!(clock::timestamp_ms(clock) < intent::expiration_ms(ir), EDeadlineInvalid);
        intent::set_status(ir, intent::status_batched());
        intent::set_auction_id(ir, option::some(auction_id));
        k = k + 1;
    };

    // Now append to auction intent_ids (mutable borrow).
    let auc_w = borrow_mut(auction_book, auction_id);
    assert_open(auc_w);
    let mut p = 0;
    while (p < n) {
        vector::push_back(&mut auc_w.intent_ids, *vector::borrow(&intent_ids, p));
        p = p + 1;
    };
}

#[test_only]
public fun status_for_testing(book: &AuctionBook, auction_id: u64): u8 {
    borrow(book, auction_id).status
}


