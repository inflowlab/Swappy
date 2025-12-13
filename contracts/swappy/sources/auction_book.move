module swappy::auction_book;

use std::option::{Self, Option};

use sui::object::{Self, ID, UID};
use sui::transfer;
use sui::tx_context::{Self, TxContext};

/// === Error codes ===
const EInvalidConfig: u64 = 1;

/// Core shared object.
///
/// Owns:
/// - all intent state (dynamic fields)
/// - all escrowed funds (dynamic fields)
/// - all auctions (dynamic fields)
/// - immutable MVP configuration
public struct AuctionBook has key {
    id: UID,

    // Monotonic counters
    next_intent_id: u64,
    next_auction_id: u64,

    // Config
    max_intents_per_auction: u64, // MVP: 10
    // Optional: allowlisted pool for an integrated DEX path (currently only used by adapters).
    cetus_pool_id: ID,
}

/// Dynamic field key namespaces (avoid collisions across value types).
public struct IntentKey has copy, drop, store { intent_id: u64 }
public struct EscrowKey has copy, drop, store { intent_id: u64 }
public struct AuctionKey has copy, drop, store { auction_id: u64 }

public fun intent_key(intent_id: u64): IntentKey { IntentKey { intent_id } }
public fun escrow_key(intent_id: u64): EscrowKey { EscrowKey { intent_id } }
public fun auction_key(auction_id: u64): AuctionKey { AuctionKey { auction_id } }

public fun id(auction_book: &AuctionBook): ID {
    object::id(auction_book)
}

public(package) fun uid(auction_book: &AuctionBook): &UID { &auction_book.id }
public(package) fun uid_mut(auction_book: &mut AuctionBook): &mut UID { &mut auction_book.id }

public fun cetus_pool_id(auction_book: &AuctionBook): ID {
    auction_book.cetus_pool_id
}

public fun max_intents_per_auction(auction_book: &AuctionBook): u64 {
    auction_book.max_intents_per_auction
}

/// For tests and off-chain clients that derive IDs from counters.
/// The first created intent/auction uses id 0, then increments.
#[test_only]
public fun next_intent_id_for_testing(auction_book: &AuctionBook): u64 { auction_book.next_intent_id }
#[test_only]
public fun next_auction_id_for_testing(auction_book: &AuctionBook): u64 { auction_book.next_auction_id }

/// Create and share the canonical AuctionBook.
///
/// MVP config is immutable.
public entry fun create_auction_book(cetus_pool_id: ID, ctx: &mut TxContext) {
    let max_intents_per_auction = 10;
    assert!(max_intents_per_auction == 10, EInvalidConfig);
    let auction_book = AuctionBook {
        id: object::new(ctx),
        next_intent_id: 0,
        next_auction_id: 0,
        max_intents_per_auction,
        cetus_pool_id,
    };
    transfer::share_object(auction_book);
}

/// Internal: allocate a fresh intent id.
public(package) fun alloc_intent_id(auction_book: &mut AuctionBook): u64 {
    let id = auction_book.next_intent_id;
    auction_book.next_intent_id = id + 1;
    id
}

/// Internal: allocate a fresh auction id.
public(package) fun alloc_auction_id(auction_book: &mut AuctionBook): u64 {
    let id = auction_book.next_auction_id;
    auction_book.next_auction_id = id + 1;
    id
}


