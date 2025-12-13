#[test_only]
module swappy::swappy_tests;

use std::option;

use sui::clock::{Self, Clock};
use sui::coin;
use sui::test_scenario;
use sui::tx_context;
use sui::object;

use swappy::auction_book::{Self, AuctionBook};
use swappy::auction;
use swappy::escrow;
use swappy::intent;
use swappy::settlement;
use swappy::usdc_coin::USDC;

fun setup_shared(s: &mut test_scenario::Scenario, sender: address) {
    let ctx = test_scenario::ctx(s);

    // Shared test clock.
    let clock = clock::create_for_testing(ctx);
    clock::share_for_testing(clock);

    // Create an arbitrary pool ID (does not need to correspond to a real object).
    let pool_id = object::id_from_address(tx_context::fresh_object_address(ctx));

    // Create shared AuctionBook.
    auction_book::create_auction_book(pool_id, ctx);

    // Move shared objects into global inventory.
    test_scenario::next_tx(s, sender);
}

fun take_book_and_clock(s: &mut test_scenario::Scenario): (AuctionBook, Clock) {
    let book = test_scenario::take_shared<AuctionBook>(s);
    let clock = test_scenario::take_shared<Clock>(s);
    (book, clock)
}

fun return_book_and_clock(_s: &mut test_scenario::Scenario, book: AuctionBook, clock: Clock) {
    test_scenario::return_shared(book);
    test_scenario::return_shared(clock);
}

#[test]
fun test_create_intent_deposit_records_and_escrow() {
    let a: address = @0xA;
    let mut s = test_scenario::begin(a);
    setup_shared(&mut s, a);

    let (mut book, mut clk) = take_book_and_clock(&mut s);
    clock::set_for_testing(&mut clk, 100);

    let ctx = test_scenario::ctx(&mut s);
    let c = coin::mint_for_testing<USDC>(100, ctx);

    intent::create_intent_and_deposit<USDC, sui::sui::SUI>(
        &mut book, &clk, c, 50, 1, 1_000, ctx
    );

    let ir = intent::borrow_intent(&book, 0);
    std::unit_test::assert_eq!(intent::sell_token(ir), intent::type_of<USDC>());
    std::unit_test::assert_eq!(intent::buy_token(ir), intent::type_of<sui::sui::SUI>());
    assert!(escrow::exists_for_testing<USDC>(&book, 0));

    return_book_and_clock(&mut s, book, clk);
    test_scenario::end(s);
}

#[test]
fun test_cancel_intent_owner_only_success() {
    let a: address = @0xA;
    let mut s = test_scenario::begin(a);
    setup_shared(&mut s, a);

    // Create intent
    {
        let (mut book, mut clk) = take_book_and_clock(&mut s);
        clock::set_for_testing(&mut clk, 100);
        let ctx = test_scenario::ctx(&mut s);
        let c = coin::mint_for_testing<USDC>(10, ctx);
        intent::create_intent_and_deposit<USDC, sui::sui::SUI>(&mut book, &clk, c, 10, 1, 1_000, ctx);
        return_book_and_clock(&mut s, book, clk);
    };
    test_scenario::next_tx(&mut s, a);

    // Cancel as owner
    let (mut book, mut clk) = take_book_and_clock(&mut s);
    clock::set_for_testing(&mut clk, 200);
    let ctx = test_scenario::ctx(&mut s);
    intent::cancel_intent<USDC>(&mut book, 0, &clk, ctx);
    std::unit_test::assert_eq!(intent::status_for_testing(&book, 0), intent::status_canceled());
    assert!(!escrow::exists_for_testing<USDC>(&book, 0));
    return_book_and_clock(&mut s, book, clk);
    test_scenario::end(s);
}

#[test, expected_failure(abort_code = 105)]
fun test_cancel_intent_non_owner_fails() {
    let a: address = @0xA;
    let b: address = @0xB;
    let mut s = test_scenario::begin(a);
    setup_shared(&mut s, a);

    // Create intent as A
    {
        let (mut book, mut clk) = take_book_and_clock(&mut s);
        clock::set_for_testing(&mut clk, 100);
        let ctx = test_scenario::ctx(&mut s);
        let c = coin::mint_for_testing<USDC>(10, ctx);
        intent::create_intent_and_deposit<USDC, sui::sui::SUI>(&mut book, &clk, c, 10, 1, 1_000, ctx);
        return_book_and_clock(&mut s, book, clk);
    };
    test_scenario::next_tx(&mut s, b);

    // Attempt cancel as B (must abort EUnauthorized=105)
    let (mut book, mut clk) = take_book_and_clock(&mut s);
    clock::set_for_testing(&mut clk, 200);
    let ctx = test_scenario::ctx(&mut s);
    intent::cancel_intent<USDC>(&mut book, 0, &clk, ctx);

    // If the call above unexpectedly succeeds, force a failure (different abort code).
    abort 999_105
}

#[test]
fun test_reclaim_expired_permissionless() {
    let a: address = @0xA;
    let b: address = @0xB;
    let mut s = test_scenario::begin(a);
    setup_shared(&mut s, a);

    // Create intent expiring at t=1_000
    {
        let (mut book, mut clk) = take_book_and_clock(&mut s);
        clock::set_for_testing(&mut clk, 100);
        let ctx = test_scenario::ctx(&mut s);
        let c = coin::mint_for_testing<USDC>(10, ctx);
        intent::create_intent_and_deposit<USDC, sui::sui::SUI>(&mut book, &clk, c, 10, 1, 1_000, ctx);
        return_book_and_clock(&mut s, book, clk);
    };
    test_scenario::next_tx(&mut s, b);

    // Reclaim after expiry (permissionless)
    let (mut book, mut clk) = take_book_and_clock(&mut s);
    clock::set_for_testing(&mut clk, 2_000);
    intent::reclaim_if_expired<USDC>(&mut book, 0, &clk);
    std::unit_test::assert_eq!(intent::status_for_testing(&book, 0), intent::status_expired());
    assert!(!escrow::exists_for_testing<USDC>(&book, 0));
    return_book_and_clock(&mut s, book, clk);
    test_scenario::end(s);
}

#[test]
fun test_attach_and_skip_transition() {
    let a: address = @0xA;
    let mut s = test_scenario::begin(a);
    setup_shared(&mut s, a);

    let (mut book, mut clk) = take_book_and_clock(&mut s);
    clock::set_for_testing(&mut clk, 100);
    let ctx = test_scenario::ctx(&mut s);

    // Intent 0: sell USDC, buy SUI
    let c = coin::mint_for_testing<USDC>(10, ctx);
    intent::create_intent_and_deposit<USDC, sui::sui::SUI>(&mut book, &clk, c, 10, 1, 10_000, ctx);

    // Auction 0
    auction::create_auction(&mut book, &clk, 1_000);
    auction::attach_intents(&mut book, 0, vector[0], &clk);
    std::unit_test::assert_eq!(intent::status_for_testing(&book, 0), intent::status_batched());

    // Settlement: skip intent 0 -> OPEN_ESCROWED
    let session = settlement::begin(&mut book, 0, &clk);
    let session = settlement::step_skip(session, &mut book, 0, &clk);
    settlement::finalize(session);

    std::unit_test::assert_eq!(intent::status_for_testing(&book, 0), intent::status_open_escrowed());
    assert!(option::is_none(&intent::auction_id_for_testing(&book, 0)));
    assert!(escrow::exists_for_testing<USDC>(&book, 0));
    std::unit_test::assert_eq!(auction::status_for_testing(&book, 0), auction::status_settled());

    return_book_and_clock(&mut s, book, clk);
    test_scenario::end(s);
}

#[test]
fun test_settlement_cow_match_happy() {
    let a: address = @0xA;
    let mut s = test_scenario::begin(a);
    setup_shared(&mut s, a);

    let (mut book, mut clk) = take_book_and_clock(&mut s);
    clock::set_for_testing(&mut clk, 100);
    let ctx = test_scenario::ctx(&mut s);

    // Intent 0: sell SUI buy USDC
    let c0 = coin::mint_for_testing<sui::sui::SUI>(10, ctx);
    intent::create_intent_and_deposit<sui::sui::SUI, USDC>(&mut book, &clk, c0, 10, 10, 10_000, ctx);
    // Intent 1: sell USDC buy SUI
    let c1 = coin::mint_for_testing<USDC>(10, ctx);
    intent::create_intent_and_deposit<USDC, sui::sui::SUI>(&mut book, &clk, c1, 10, 10, 10_000, ctx);

    // Batch into auction 0
    auction::create_auction(&mut book, &clk, 1_000);
    auction::attach_intents(&mut book, 0, vector[0, 1], &clk);

    // Settle via cow match (X=SUI, Y=USDC)
    let session = settlement::begin(&mut book, 0, &clk);
    let session = settlement::step_cow_match<sui::sui::SUI, USDC>(session, &mut book, 0, 1, 10, 10, &clk);
    settlement::finalize(session);

    std::unit_test::assert_eq!(intent::status_for_testing(&book, 0), intent::status_settled());
    std::unit_test::assert_eq!(intent::status_for_testing(&book, 1), intent::status_settled());
    assert!(!escrow::exists_for_testing<sui::sui::SUI>(&book, 0));
    assert!(!escrow::exists_for_testing<USDC>(&book, 1));

    return_book_and_clock(&mut s, book, clk);
    test_scenario::end(s);
}

#[test, expected_failure(abort_code = 403)]
fun test_settlement_double_use_fails() {
    let a: address = @0xA;
    let mut s = test_scenario::begin(a);
    setup_shared(&mut s, a);

    let (mut book, mut clk) = take_book_and_clock(&mut s);
    clock::set_for_testing(&mut clk, 100);
    let ctx = test_scenario::ctx(&mut s);
    let c = coin::mint_for_testing<USDC>(10, ctx);
    intent::create_intent_and_deposit<USDC, sui::sui::SUI>(&mut book, &clk, c, 10, 1, 10_000, ctx);
    auction::create_auction(&mut book, &clk, 1_000);
    auction::attach_intents(&mut book, 0, vector[0], &clk);

    let session = settlement::begin(&mut book, 0, &clk);
    let session = settlement::step_skip(session, &mut book, 0, &clk);
    // Re-using the same intent must abort with EIntentUsedTwice=403.
    let _session = settlement::step_skip(session, &mut book, 0, &clk);

    // If the call above unexpectedly succeeds, force a failure (different abort code).
    abort 999_403
}

#[test, expected_failure(abort_code = 405)]
fun test_settlement_min_buy_violation_fails() {
    let a: address = @0xA;
    let mut s = test_scenario::begin(a);
    setup_shared(&mut s, a);

    let (mut book, mut clk) = take_book_and_clock(&mut s);
    clock::set_for_testing(&mut clk, 100);
    let ctx = test_scenario::ctx(&mut s);

    // Intent 0 expects >= 11 but counterparty sells 10.
    let c0 = coin::mint_for_testing<sui::sui::SUI>(10, ctx);
    intent::create_intent_and_deposit<sui::sui::SUI, USDC>(&mut book, &clk, c0, 10, 11, 10_000, ctx);
    let c1 = coin::mint_for_testing<USDC>(10, ctx);
    intent::create_intent_and_deposit<USDC, sui::sui::SUI>(&mut book, &clk, c1, 10, 10, 10_000, ctx);

    auction::create_auction(&mut book, &clk, 1_000);
    auction::attach_intents(&mut book, 0, vector[0, 1], &clk);

    let session = settlement::begin(&mut book, 0, &clk);
    let _session = settlement::step_cow_match<sui::sui::SUI, USDC>(session, &mut book, 0, 1, 10, 10, &clk);

    // If the call above unexpectedly succeeds, force a failure (different abort code).
    abort 999_405
}

#[test, expected_failure(abort_code = 406)]
fun test_settlement_expired_intent_fails() {
    let a: address = @0xA;
    let mut s = test_scenario::begin(a);
    setup_shared(&mut s, a);

    let (mut book, mut clk) = take_book_and_clock(&mut s);
    clock::set_for_testing(&mut clk, 100);
    let ctx = test_scenario::ctx(&mut s);

    let c = coin::mint_for_testing<USDC>(10, ctx);
    // Expire at 200
    intent::create_intent_and_deposit<USDC, sui::sui::SUI>(&mut book, &clk, c, 10, 1, 200, ctx);
    auction::create_auction(&mut book, &clk, 1_000);
    auction::attach_intents(&mut book, 0, vector[0], &clk);

    // Advance time past expiration before settlement step.
    clock::set_for_testing(&mut clk, 300);
    let session = settlement::begin(&mut book, 0, &clk);
    let _session = settlement::step_skip(session, &mut book, 0, &clk);

    // If the call above unexpectedly succeeds, force a failure (different abort code).
    abort 999_406
}

#[test, expected_failure(abort_code = 401)]
fun test_finalize_without_covering_all_intents_fails() {
    let a: address = @0xA;
    let mut s = test_scenario::begin(a);
    setup_shared(&mut s, a);

    let (mut book, mut clk) = take_book_and_clock(&mut s);
    clock::set_for_testing(&mut clk, 100);
    let ctx = test_scenario::ctx(&mut s);
    let c = coin::mint_for_testing<USDC>(10, ctx);
    intent::create_intent_and_deposit<USDC, sui::sui::SUI>(&mut book, &clk, c, 10, 1, 10_000, ctx);
    auction::create_auction(&mut book, &clk, 1_000);
    auction::attach_intents(&mut book, 0, vector[0], &clk);

    // Begin then finalize without any steps => uncovered intent => abort 401.
    let session = settlement::begin(&mut book, 0, &clk);
    settlement::finalize(session);

    // If finalize unexpectedly succeeds, force a failure (different abort code).
    abort 999_401
}

