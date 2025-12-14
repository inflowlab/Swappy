## Context

This document explains Swappy’s **component architecture** and **trust boundaries**.

## Plan

- Summarize components and responsibilities.
- Explain the on-chain data model at a high level.
- Describe the “read path” (coordinator-free) and “write path” (wallet-signed).

## Code / Pseudocode

### Components

- **Move contracts (`contracts/swappy/`)** (trusted)
  - Escrow custody, intent lifecycle, auction batching, settlement enforcement.
- **Frontend (`frontend/`)** (untrusted)
  - UX + wallet-signed transactions.
  - On-chain reads happen directly via RPC (no backend required for correctness).
- **Coordinator (`coordinator/`)** (untrusted, optional)
  - Token registry metadata for display/formatting.
  - Advisory free-text parsing preview.

### Trust boundaries (strict)

- **Only Move is authoritative for funds.**
- Frontend/coordinator may be down, inconsistent, or malicious without compromising funds.
- Liveness failures are acceptable; safety failures are not.

### High-level data model (on-chain)

- **`AuctionBook`** (shared object) is the root entry point and owns protocol state via dynamic fields:
  - **Intent records** (`IntentRecord`, keyed by `intent_id`)
  - **Escrow entries** (`EscrowEntry<T>`, keyed by `intent_id`)
  - **Auctions** (`Auction`, keyed by `auction_id`)
- Users also own **`IntentRecordLink`** objects:
  - pointers to `(auction_book_id, intent_id)`
  - used for coordinator-free discovery

### Read path (coordinator-free)

1. **Discover intents**: user-owned `IntentRecordLink` objects are enumerated from the wallet address.
2. **Load canonical state**: for each link, the app reads the corresponding `IntentRecord` from `AuctionBook` via dynamic fields.
3. **Load auctions**: auction detail reads the `Auction` record from `AuctionBook` via dynamic fields.

### Write path (wallet-signed)

All writes must be initiated by explicit user action in the wallet:

- Create intent + deposit escrow: `intent::create_intent_and_deposit`
- Cancel intent (owner-only): `intent::cancel_intent`
- Reclaim expired intent (permissionless): `intent::reclaim_if_expired`
- Create auction + attach intents: `auction::create_auction`, `auction::attach_intents`
- Settle auction (permissionless PTB): `settlement::begin` + `settlement::step_*` + `settlement::finalize`

## Edge Cases

- If the coordinator is unavailable, the frontend should still be usable for on-chain reads (and for mock/demo flows).
- If settlement attempts violate invariants, the transaction aborts and reverts fully.

## Open Questions (if any)

- None in this document. See `TECH_SPEC.md` for protocol-level open questions.


