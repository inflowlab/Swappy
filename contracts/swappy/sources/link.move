module swappy::link;

use sui::object::{Self, ID, UID};

/// Owned by the user. Enables coordinator-free discovery.
/// Never mutated by protocol.
public struct IntentRecordLink has key, store {
    id: UID,
    auction_book: ID,
    intent_id: u64,
    schema_version: u8,
}

public fun new(auction_book: ID, intent_id: u64, schema_version: u8, ctx: &mut sui::tx_context::TxContext): IntentRecordLink {
    IntentRecordLink {
        id: object::new(ctx),
        auction_book,
        intent_id,
        schema_version,
    }
}

public fun auction_book_id(link: &IntentRecordLink): ID { link.auction_book }
public fun intent_id(link: &IntentRecordLink): u64 { link.intent_id }
public fun schema_version(link: &IntentRecordLink): u8 { link.schema_version }


