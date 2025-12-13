module swappy::intent;

use std::option::{Self, Option};
use std::type_name::{Self, TypeName};

use sui::clock::{Self, Clock};
use sui::coin::{Self, Coin};
use sui::dynamic_field;
use sui::transfer;
use sui::tx_context::{Self, TxContext};

use swappy::auction_book::{Self, AuctionBook};
use swappy::auction_book::{IntentKey, intent_key};
use swappy::escrow;
use swappy::link;
// Note: no hardcoded token allowlist.

/// === Error codes ===
const EIntentNotFound: u64 = 100;
const EInvalidTokens: u64 = 101;
const EInvalidAmounts: u64 = 102;
const EExpired: u64 = 103;
const EInvalidStatus: u64 = 104;
const EUnauthorized: u64 = 105;
const EUnsupportedCoinType: u64 = 106;

/// Status values (u8).
const OPEN_ESCROWED: u8 = 0;
const BATCHED: u8 = 1;
const SETTLED: u8 = 2;
const CANCELED: u8 = 3;
const EXPIRED: u8 = 4;

/// Public status helpers (constants are module-private in Move).
public fun status_open_escrowed(): u8 { OPEN_ESCROWED }
public fun status_batched(): u8 { BATCHED }
public fun status_settled(): u8 { SETTLED }
public fun status_canceled(): u8 { CANCELED }
public fun status_expired(): u8 { EXPIRED }

/// Intent state stored as a dynamic field under AuctionBook.
public struct IntentRecord has store {
    intent_id: u64,
    owner: address,

    sell_token: TypeName,
    buy_token: TypeName,

    sell_amount: u64,
    min_buy_amount: u64,

    expiration_ms: u64,

    status: u8, // OPEN_ESCROWED | BATCHED | SETTLED | CANCELED | EXPIRED
    auction_id: Option<u64>,
}

/// --- Read-only accessors (safe for other protocol modules and off-chain clients) ---
public fun owner(ir: &IntentRecord): address { ir.owner }
public fun sell_token(ir: &IntentRecord): TypeName { ir.sell_token }
public fun buy_token(ir: &IntentRecord): TypeName { ir.buy_token }
public fun sell_amount(ir: &IntentRecord): u64 { ir.sell_amount }
public fun min_buy_amount(ir: &IntentRecord): u64 { ir.min_buy_amount }
public fun expiration_ms(ir: &IntentRecord): u64 { ir.expiration_ms }
public fun status(ir: &IntentRecord): u8 { ir.status }
public fun auction_id(ir: &IntentRecord): Option<u64> { ir.auction_id }

/// --- Internal setters (used by other trusted protocol modules only) ---
public(package) fun set_status(ir: &mut IntentRecord, s: u8) { ir.status = s }
public(package) fun set_auction_id(ir: &mut IntentRecord, a: Option<u64>) { ir.auction_id = a }

public fun type_of<T>(): TypeName { type_name::with_defining_ids<T>() }

public fun borrow_intent(book: &AuctionBook, intent_id: u64): &IntentRecord {
    assert!(
        dynamic_field::exists_with_type<IntentKey, IntentRecord>(auction_book::uid(book), intent_key(intent_id)),
        EIntentNotFound
    );
    dynamic_field::borrow<IntentKey, IntentRecord>(auction_book::uid(book), intent_key(intent_id))
}

public fun borrow_intent_mut(book: &mut AuctionBook, intent_id: u64): &mut IntentRecord {
    assert!(
        dynamic_field::exists_with_type<IntentKey, IntentRecord>(auction_book::uid(book), intent_key(intent_id)),
        EIntentNotFound
    );
    dynamic_field::borrow_mut<IntentKey, IntentRecord>(auction_book::uid_mut(book), intent_key(intent_id))
}

public fun remove_intent(book: &mut AuctionBook, intent_id: u64): IntentRecord {
    assert!(
        dynamic_field::exists_with_type<IntentKey, IntentRecord>(auction_book::uid(book), intent_key(intent_id)),
        EIntentNotFound
    );
    dynamic_field::remove<IntentKey, IntentRecord>(auction_book::uid_mut(book), intent_key(intent_id))
}

public fun add_intent(book: &mut AuctionBook, record: IntentRecord) {
    dynamic_field::add<IntentKey, IntentRecord>(auction_book::uid_mut(book), intent_key(record.intent_id), record)
}

public fun assert_trade_pair(sell_t: &TypeName, buy_t: &TypeName) {
    assert!(*sell_t != *buy_t, EInvalidTokens);
}

public(package) fun assert_not_expired(clock: &Clock, expiration_ms: u64) {
    let now = clock::timestamp_ms(clock);
    assert!(now < expiration_ms, EExpired);
}

/// 7.1 Create Intent + Deposit
public entry fun create_intent_and_deposit<Sell, Buy>(
    auction_book: &mut AuctionBook,
    clock: &Clock,
    coin: Coin<Sell>,
    sell_amount: u64,
    min_buy_amount: u64,
    expiration_ms: u64,
    ctx: &mut TxContext,
) {
    let sell_t = type_of<Sell>();
    let buy_t = type_of<Buy>();
    assert_trade_pair(&sell_t, &buy_t);

    // strict time comparison
    assert!(clock::timestamp_ms(clock) < expiration_ms, EExpired);
    assert!(sell_amount > 0, EInvalidAmounts);
    assert!(min_buy_amount > 0, EInvalidAmounts);

    let sender = tx_context::sender(ctx);

    // Split coin to exact sell_amount; return any remainder to sender.
    let mut c = coin;
    let total = coin::value(&c);
    assert!(total >= sell_amount, EInvalidAmounts);
    let deposit = if (total == sell_amount) {
        c
    } else {
        let deposit = coin::split(&mut c, sell_amount, ctx);
        transfer::public_transfer(c, sender);
        deposit
    };

    let intent_id = auction_book::alloc_intent_id(auction_book);

    let record = IntentRecord {
        intent_id,
        owner: sender,
        sell_token: sell_t,
        buy_token: buy_t,
        sell_amount,
        min_buy_amount,
        expiration_ms,
        status: status_open_escrowed(),
        auction_id: option::none(),
    };
    add_intent(auction_book, record);

    let escrow_entry = escrow::new_entry<Sell>(intent_id, sender, deposit);
    escrow::add<Sell>(auction_book, escrow_entry);

    let link_obj = link::new(auction_book::id(auction_book), intent_id, /*schema_version*/ 1, ctx);
    transfer::public_transfer(link_obj, sender);
}

/// 7.2 Cancel Intent
///
/// Owner-only cancellation.
public entry fun cancel_intent<T>(
    auction_book: &mut AuctionBook,
    intent_id: u64,
    clock: &Clock,
    ctx: &TxContext,
) {
    let ir = borrow_intent_mut(auction_book, intent_id);
    assert!(tx_context::sender(ctx) == owner(ir), EUnauthorized);
    assert!(status(ir) == status_open_escrowed(), EInvalidStatus);
    assert!(clock::timestamp_ms(clock) < expiration_ms(ir), EExpired);

    set_status(ir, status_canceled());
    set_auction_id(ir, option::none());

    // Caller must supply the correct sell token type for the escrow.
    assert!(sell_token(ir) == type_of<T>(), EInvalidTokens);
    let e = escrow::remove<T>(auction_book, intent_id);
    escrow::refund_to_owner<T>(e);
}

/// 7.3 Reclaim Expired Intent
public entry fun reclaim_if_expired<T>(
    auction_book: &mut AuctionBook,
    intent_id: u64,
    clock: &Clock,
) {
    let ir = borrow_intent_mut(auction_book, intent_id);
    assert!(status(ir) == status_open_escrowed(), EInvalidStatus);
    assert!(clock::timestamp_ms(clock) >= expiration_ms(ir), EExpired);

    set_status(ir, status_expired());
    set_auction_id(ir, option::none());

    // Caller must supply the correct sell token type for the escrow.
    assert!(sell_token(ir) == type_of<T>(), EInvalidTokens);
    let e = escrow::remove<T>(auction_book, intent_id);
    escrow::refund_to_owner<T>(e);
}

#[test_only]
public fun status_for_testing(book: &AuctionBook, intent_id: u64): u8 {
    borrow_intent(book, intent_id).status
}

#[test_only]
public fun auction_id_for_testing(book: &AuctionBook, intent_id: u64): Option<u64> {
    borrow_intent(book, intent_id).auction_id
}


