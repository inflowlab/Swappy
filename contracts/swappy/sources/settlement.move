module swappy::settlement;

use std::option;
use std::vector;

use sui::clock::{Self, Clock};
use sui::coin::{Self, Coin};
use sui::tx_context::TxContext;
use sui::transfer;

use swappy::auction_book::{Self, AuctionBook};
use swappy::auction;
use swappy::cetus_adapter;
use swappy::escrow;
use swappy::intent;
use swappy::usdc_coin::USDC;

/// === Error codes ===
const EInvalidAuction: u64 = 400;
const EPlanDoesNotCoverAll: u64 = 401;
const EIntentNotInAuction: u64 = 402;
const EIntentUsedTwice: u64 = 403;
const EInvalidStep: u64 = 404;
const EMinBuyViolation: u64 = 405;
const EExpired: u64 = 406;
const EInvalidStatus: u64 = 407;

/// Hot-potato settlement session passed across multiple Move calls inside one PTB.
/// Intentionally has NO `drop`, forcing the PTB to end with `finalize`.
public struct SettlementSession has store {
    auction_id: u64,
    all_intents: vector<u64>,
    covered: vector<u64>,
    used_non_skip: vector<u64>,
}

fun now_ms(clock: &Clock): u64 { clock::timestamp_ms(clock) }

fun assert_intent_in_auction(intent_ids: &vector<u64>, intent_id: u64) {
    let mut i = 0;
    let n = vector::length(intent_ids);
    let mut found = false;
    while (i < n) {
        if (*vector::borrow(intent_ids, i) == intent_id) {
            found = true;
            break
        };
        i = i + 1;
    };
    assert!(found, EIntentNotInAuction);
}

fun mark_used(used: &mut vector<u64>, intent_id: u64) {
    let mut i = 0;
    let n = vector::length(used);
    while (i < n) {
        assert!(*vector::borrow(used, i) != intent_id, EIntentUsedTwice);
        i = i + 1;
    };
    vector::push_back(used, intent_id);
}

fun assert_covers_all_intents(all_intents: &vector<u64>, covered: &vector<u64>) {
    let mut i = 0;
    let n = vector::length(all_intents);
    while (i < n) {
        let id = *vector::borrow(all_intents, i);
        // linear scan; n <= 10
        let mut j = 0;
        let m = vector::length(covered);
        let mut ok = false;
        while (j < m) {
            if (*vector::borrow(covered, j) == id) { ok = true; break };
            j = j + 1;
        };
        assert!(ok, EPlanDoesNotCoverAll);
        i = i + 1;
    }
}

fun assert_not_expired(clock: &Clock, expiration_ms: u64) {
    assert!(now_ms(clock) < expiration_ms, EExpired)
}

/// Begin settlement for an auction.
///
/// This sets the auction status to SETTLED immediately to prevent concurrent settlements;
/// any abort later in the PTB reverts the entire transaction, restoring the previous state.
public fun begin(
    auction_book: &mut AuctionBook,
    auction_id: u64,
    _clock: &Clock,
): SettlementSession {
    // Must exist and be OPEN.
    assert!(auction::exists(auction_book, auction_id), EInvalidAuction);
    let auc = auction::borrow_mut(auction_book, auction_id);
    auction::assert_open(auc);

    // Snapshot intent_ids.
    let ids_r = auction::intent_ids(auc);
    let mut all: vector<u64> = vector::empty();
    let mut i = 0;
    let n = vector::length(ids_r);
    while (i < n) {
        vector::push_back(&mut all, *vector::borrow(ids_r, i));
        i = i + 1;
    };

    // Lock auction.
    auction::set_status(auc, auction::status_settled());

    // Session tracks coverage + non-skip usage.
    SettlementSession {
        auction_id,
        all_intents: all,
        covered: vector::empty(),
        used_non_skip: vector::empty(),
    }
}

/// Skip an intent: BATCHED -> OPEN_ESCROWED, escrow stays in place.
public fun step_skip(
    session: SettlementSession,
    auction_book: &mut AuctionBook,
    intent_id: u64,
    clock: &Clock,
): SettlementSession {
    let mut s = session;
    assert_intent_in_auction(&s.all_intents, intent_id);
    mark_used(&mut s.covered, intent_id);

    let ir = intent::borrow_intent_mut(auction_book, intent_id);
    assert!(intent::status(ir) == intent::status_batched(), EInvalidStatus);
    assert_not_expired(clock, intent::expiration_ms(ir));
    intent::set_status(ir, intent::status_open_escrowed());
    intent::set_auction_id(ir, option::none());
    s
}

/// COW match between token types `X` and `Y`.
///
/// Requires:
/// - intent_a sells X and buys Y
/// - intent_b sells Y and buys X
public fun step_cow_match<X, Y>(
    session: SettlementSession,
    auction_book: &mut AuctionBook,
    intent_a: u64,
    intent_b: u64,
    a_receives: u64,
    b_receives: u64,
    clock: &Clock,
): SettlementSession {
    let mut s = session;
    assert_intent_in_auction(&s.all_intents, intent_a);
    assert_intent_in_auction(&s.all_intents, intent_b);
    mark_used(&mut s.covered, intent_a);
    mark_used(&mut s.covered, intent_b);
    mark_used(&mut s.used_non_skip, intent_a);
    mark_used(&mut s.used_non_skip, intent_b);

    let (a_owner, a_sell_t, a_buy_t, a_sell_amt, a_min_buy, a_exp, a_status) = {
        let ia = intent::borrow_intent(auction_book, intent_a);
        (intent::owner(ia), intent::sell_token(ia), intent::buy_token(ia),
         intent::sell_amount(ia), intent::min_buy_amount(ia),
         intent::expiration_ms(ia), intent::status(ia))
    };
    let (b_owner, b_sell_t, b_buy_t, b_sell_amt, b_min_buy, b_exp, b_status) = {
        let ib = intent::borrow_intent(auction_book, intent_b);
        (intent::owner(ib), intent::sell_token(ib), intent::buy_token(ib),
         intent::sell_amount(ib), intent::min_buy_amount(ib),
         intent::expiration_ms(ib), intent::status(ib))
    };

    assert!(a_status == intent::status_batched(), EInvalidStatus);
    assert!(b_status == intent::status_batched(), EInvalidStatus);
    assert_not_expired(clock, a_exp);
    assert_not_expired(clock, b_exp);

    // Enforce the type args correspond to the intents.
    assert!(a_sell_t == intent::type_of<X>(), EInvalidStep);
    assert!(a_buy_t == intent::type_of<Y>(), EInvalidStep);
    assert!(b_sell_t == intent::type_of<Y>(), EInvalidStep);
    assert!(b_buy_t == intent::type_of<X>(), EInvalidStep);

    // Full-fill semantics (MVP).
    assert!(a_receives == b_sell_amt, EInvalidStep);
    assert!(b_receives == a_sell_amt, EInvalidStep);
    assert!(a_receives >= a_min_buy, EMinBuyViolation);
    assert!(b_receives >= b_min_buy, EMinBuyViolation);

    // Transfer escrowed coins to counterparties.
    let ea = escrow::remove<X>(auction_book, intent_a);
    let eb = escrow::remove<Y>(auction_book, intent_b);
    transfer::public_transfer(escrow::into_coin(ea), b_owner);
    transfer::public_transfer(escrow::into_coin(eb), a_owner);

    // Mark both intents settled.
    let ia_mut = intent::borrow_intent_mut(auction_book, intent_a);
    intent::set_status(ia_mut, intent::status_settled());
    let ib_mut = intent::borrow_intent_mut(auction_book, intent_b);
    intent::set_status(ib_mut, intent::status_settled());
    s
}

/// Cetus exact-in swap step for SUI/USDC only (adapter restriction).
public fun step_cetus_swap_exact_in<TIn, TOut>(
    session: SettlementSession,
    auction_book: &mut AuctionBook,
    intent_id: u64,
    amount_in: u64,
    min_amount_out: u64,
    clock: &Clock,
    ctx: &mut TxContext,
): SettlementSession {
    let mut s = session;
    assert_intent_in_auction(&s.all_intents, intent_id);
    mark_used(&mut s.covered, intent_id);
    mark_used(&mut s.used_non_skip, intent_id);

    let (owner, sell_t, buy_t, sell_amt, min_buy, exp, status) = {
        let ir = intent::borrow_intent(auction_book, intent_id);
        (intent::owner(ir), intent::sell_token(ir), intent::buy_token(ir),
         intent::sell_amount(ir), intent::min_buy_amount(ir),
         intent::expiration_ms(ir), intent::status(ir))
    };
    assert!(status == intent::status_batched(), EInvalidStatus);
    assert_not_expired(clock, exp);
    assert!(amount_in == sell_amt, EInvalidStep);
    assert!(min_amount_out >= min_buy, EMinBuyViolation);

    // Enforce type args match intent.
    assert!(sell_t == intent::type_of<TIn>(), EInvalidStep);
    assert!(buy_t == intent::type_of<TOut>(), EInvalidStep);

    // Pool allowlist enforced here.
    let pool_id = auction_book::cetus_pool_id(auction_book);

    // Adapter only supports SUI <-> USDC.
    if (sell_t == intent::type_of<sui::sui::SUI>() && buy_t == intent::type_of<USDC>()) {
        let e = escrow::remove<sui::sui::SUI>(auction_book, intent_id);
        let out: Coin<USDC> = cetus_adapter::swap_exact_in_sui_usdc(
            pool_id, escrow::into_coin(e), amount_in, min_amount_out, ctx
        );
        assert!(coin::value(&out) >= min_buy, EMinBuyViolation);
        transfer::public_transfer(out, owner);
    } else if (sell_t == intent::type_of<USDC>() && buy_t == intent::type_of<sui::sui::SUI>()) {
        let e = escrow::remove<USDC>(auction_book, intent_id);
        let out: Coin<sui::sui::SUI> = cetus_adapter::swap_exact_in_usdc_sui(
            pool_id, escrow::into_coin(e), amount_in, min_amount_out, ctx
        );
        assert!(coin::value(&out) >= min_buy, EMinBuyViolation);
        transfer::public_transfer(out, owner);
    } else {
        abort EInvalidStep
    };

    let ir_mut = intent::borrow_intent_mut(auction_book, intent_id);
    intent::set_status(ir_mut, intent::status_settled());
    s
}

/// Finalize settlement: require full coverage of all auction intents.
public fun finalize(session: SettlementSession) {
    let SettlementSession { auction_id: _, all_intents, covered, used_non_skip: _ } = session;
    assert_covers_all_intents(&all_intents, &covered);
    // session is fully consumed here
}


