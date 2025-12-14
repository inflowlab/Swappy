## Context

This document describes the **Move contract surface area** and the **enforced invariants**.

## Plan

- List the Move modules and what each is responsible for.
- Specify entrypoints and their required checks/effects.
- Specify lifecycle transitions and settlement constraints.

## Code / Pseudocode

### Package

- Location: `contracts/swappy`
- Package name: `swappy` (see `contracts/swappy/Move.toml`)

### Modules (authoritative)

- **`swappy::auction_book`**
  - Defines the shared root object `AuctionBook`.
  - Provides monotonic allocation of `intent_id` and `auction_id`.
  - Defines dynamic-field key namespaces (`IntentKey`, `EscrowKey`, `AuctionKey`).
- **`swappy::intent`**
  - Defines `IntentRecord` and intent status codes.
  - Entry functions:
    - `create_intent_and_deposit<Sell, Buy>`
    - `cancel_intent<T>`
    - `reclaim_if_expired<T>`
- **`swappy::escrow`**
  - Defines `EscrowEntry<T>` and escrow add/remove/refund helpers.
  - Enforces “exists iff OPEN_ESCROWED or BATCHED” by usage in lifecycle functions.
- **`swappy::auction`**
  - Defines `Auction` and auction status codes.
  - Entry functions:
    - `create_auction`
    - `attach_intents`
- **`swappy::settlement`**
  - Defines the settlement PTB interface (`SettlementSession` hot potato).
  - Functions:
    - `begin`
    - `step_skip`
    - `step_cow_match<X, Y>`
    - `step_cetus_swap_exact_in<TIn, TOut>` (depends on adapter integration)
    - `finalize`
- **`swappy::link`**
  - Defines `IntentRecordLink` owned by users (discovery pointer).
  - Never mutated by the protocol.
- **`swappy::cetus_adapter`**
  - Adapter boundary for exact-in swaps.
  - **Currently aborts** (`ECetusNotIntegrated=900`) until external signatures are provided.
- **`swappy::usdc_coin`**
  - Placeholder `USDC` type for tests/demo.

### Intent lifecycle (enforced on-chain)

Status values (`swappy::intent`):
- `OPEN_ESCROWED`
- `BATCHED`
- `SETTLED`
- `CANCELED`
- `EXPIRED`

Allowed transitions only:
- `OPEN_ESCROWED → BATCHED` (batching into an auction)
- `OPEN_ESCROWED → CANCELED` (owner-only)
- `OPEN_ESCROWED → EXPIRED` (permissionless reclaim)
- `BATCHED → SETTLED` (non-skip settlement step)
- `BATCHED → OPEN_ESCROWED` (SKIP settlement step)

### Escrow invariants

- Escrow is stored under `AuctionBook` as `EscrowEntry<T>`.
- Escrow **exists iff** intent status is `OPEN_ESCROWED` or `BATCHED`.
- Refund/transfer of escrow is performed by protocol code only (cancel/reclaim/settlement steps).

### Auction lifecycle

Status values (`swappy::auction`):
- `OPEN`
- `SETTLED`

Constraints:
- `attach_intents` only allowed while auction is `OPEN` and before `deadline_ms`.
- Maximum intents per auction is configured in `AuctionBook` (MVP fixed at 10).

### Settlement interface

Settlement executes inside a single PTB:

1. `session = settlement::begin(book, auction_id, clock)`
2. `session = settlement::step_* (session, ...)` repeated
3. `settlement::finalize(session)`

Mandatory enforcement:
- auction exists and is `OPEN` at `begin`
- steps only reference intents that are actually in the auction
- strict expiry: `now_ms < expiration_ms`
- each intent appears in at most one **non-skip** step
- `finalize` requires all auction intents are covered by steps
- any invariant violation aborts and fully reverts the PTB

### Tests

Core lifecycle + settlement invariants are tested in:
- `contracts/swappy/tests/swappy_tests.move`

Run:

```bash
cd contracts/swappy
sui move test
```

## Edge Cases

- Settlement locks the auction early (sets status to `SETTLED` in `begin`) to prevent concurrent settlement; later aborts revert the lock.
- `step_cetus_swap_exact_in` will abort until Cetus integration is implemented.

## Open Questions (if any)

- Canonical USDC type address for real deployments.
- Exact Cetus package/module/function signature for adapter integration.


