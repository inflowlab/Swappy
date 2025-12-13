module swappy::escrow;

use sui::coin::{Self, Coin};
use sui::dynamic_field;
use sui::transfer;

use swappy::auction_book::{Self, AuctionBook};
use swappy::auction_book::{EscrowKey, escrow_key};

/// === Error codes ===
const EEscrowNotFound: u64 = 200;
const EEscrowAlreadyExists: u64 = 201;
const EEscrowInsufficient: u64 = 202;

/// Escrow entry stored as a dynamic field under AuctionBook.
///
/// Exists iff intent status is OPEN_ESCROWED or BATCHED.
public struct EscrowEntry<phantom T> has store {
    intent_id: u64,
    owner: address,
    coin: Coin<T>,
}

public(package) fun new_entry<T>(intent_id: u64, owner: address, coin: Coin<T>): EscrowEntry<T> {
    EscrowEntry { intent_id, owner, coin }
}

public fun owner<T>(entry: &EscrowEntry<T>): address { entry.owner }
public fun coin_ref<T>(entry: &EscrowEntry<T>): &Coin<T> { &entry.coin }
public fun into_coin<T>(entry: EscrowEntry<T>): Coin<T> {
    let EscrowEntry { intent_id: _, owner: _, coin } = entry;
    coin
}

public fun exists<T>(book: &AuctionBook, intent_id: u64): bool {
    dynamic_field::exists_with_type<EscrowKey, EscrowEntry<T>>(auction_book::uid(book), escrow_key(intent_id))
}

public fun borrow<T>(book: &AuctionBook, intent_id: u64): &EscrowEntry<T> {
    assert!(exists<T>(book, intent_id), EEscrowNotFound);
    dynamic_field::borrow<EscrowKey, EscrowEntry<T>>(auction_book::uid(book), escrow_key(intent_id))
}

public fun borrow_mut<T>(book: &mut AuctionBook, intent_id: u64): &mut EscrowEntry<T> {
    assert!(exists<T>(book, intent_id), EEscrowNotFound);
    dynamic_field::borrow_mut<EscrowKey, EscrowEntry<T>>(auction_book::uid_mut(book), escrow_key(intent_id))
}

public fun add<T>(book: &mut AuctionBook, entry: EscrowEntry<T>) {
    assert!(!exists<T>(book, entry.intent_id), EEscrowAlreadyExists);
    dynamic_field::add<EscrowKey, EscrowEntry<T>>(auction_book::uid_mut(book), escrow_key(entry.intent_id), entry)
}

public fun remove<T>(book: &mut AuctionBook, intent_id: u64): EscrowEntry<T> {
    assert!(exists<T>(book, intent_id), EEscrowNotFound);
    dynamic_field::remove<EscrowKey, EscrowEntry<T>>(auction_book::uid_mut(book), escrow_key(intent_id))
}

public fun assert_sufficient<T>(book: &AuctionBook, intent_id: u64, required: u64) {
    let entry = borrow<T>(book, intent_id);
    assert!(coin::value(&entry.coin) >= required, EEscrowInsufficient);
}

public fun refund_to_owner<T>(entry: EscrowEntry<T>) {
    let EscrowEntry { intent_id: _, owner, coin } = entry;
    transfer::public_transfer(coin, owner)
}

#[test_only]
public fun exists_for_testing<T>(book: &AuctionBook, intent_id: u64): bool { exists<T>(book, intent_id) }


