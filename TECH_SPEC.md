## Context

This document is the **canonical technical specification for the current state of this repository** (Move + Coordinator + Frontend).  
If code and this spec diverge, the **Move contracts are authoritative over funds and invariants**, and this spec should be updated to match the contracts.

## Plan

- Define the **trust model** and component responsibilities (strict separation).
- Specify the **on-chain data model** and **state transitions** implemented in Move.
- Specify the **settlement interface** (permissionless, atomic, fully reverting).
- Document the **coordinator REST contract** (informational only).
- Document **frontend integration modes** (mock vs real) and required env wiring.

## Code / Pseudocode (spec)

### System goals

- Intent-based trading with **escrowed funds** and **batch auction settlement**.
- **Coordinator-free discovery** of user intents (no indexers/events required for correctness).
- **Permissionless settlement**: any party can settle an auction.
- **Atomic settlement**: any violation aborts and **reverts all changes**.

### Trust model (non-negotiable)

- **Trusted**: Move contracts.
- **Untrusted**: Frontend, Coordinator, (future) Driver, (future) Solvers.
- **SQLite (coordinator)** is a cache only; it must never be a source of truth.
- **No indexers or event listeners** are required for correctness.

### Component responsibilities (strict)

- **Move (contracts)**: escrow, intent/auction lifecycle, settlement enforcement.
- **Frontend**: UX + wallet-signed transactions only. Must not claim finality without on-chain proof.
- **Coordinator**: optional informational REST service (token registry + advisory parsing).

### On-chain modules and authority

The Move package lives under `contracts/swappy/sources/` and contains:

- `swappy::auction_book`: shared root object (`AuctionBook`) + dynamic-field key namespaces.
- `swappy::intent`: intent records + create/cancel/reclaim entrypoints.
- `swappy::escrow`: escrow entries stored under `AuctionBook`.
- `swappy::auction`: auction records + create/attach entrypoints.
- `swappy::settlement`: settlement session + step functions + finalize.
- `swappy::link`: user-owned “link” object enabling coordinator-free intent discovery.
- `swappy::cetus_adapter`: adapter boundary (currently aborts; not integrated).
- `swappy::usdc_coin`: placeholder USDC type for tests/demo.

### On-chain data model

#### Shared root object: `AuctionBook`

- Shared object created via `auction_book::create_auction_book(...)`.
- Owns (via dynamic fields):
  - `IntentRecord` keyed by `IntentKey(intent_id)`
  - `EscrowEntry<T>` keyed by `EscrowKey(intent_id)`
  - `Auction` keyed by `AuctionKey(auction_id)`
- Holds immutable MVP config:
  - `max_intents_per_auction` (MVP fixed at **10**)
  - `cetus_pool_id` (allowlisted pool identifier used by settlement adapter steps)
- Monotonic counters:
  - `next_intent_id`, `next_auction_id` (first allocated id is `0`)

#### Intent record: `IntentRecord`

Stored as a dynamic field under `AuctionBook`.

Fields (high level):
- `intent_id: u64`
- `owner: address`
- `sell_token: TypeName`, `buy_token: TypeName`
- `sell_amount: u64`, `min_buy_amount: u64`
- `expiration_ms: u64` (strict comparisons against on-chain `Clock`)
- `status: u8`
- `auction_id: Option<u64>`

#### Escrow entry: `EscrowEntry<T>`

Stored as a dynamic field under `AuctionBook`.

**Invariant:** escrow exists **iff** the intent status is:
- `OPEN_ESCROWED`, or
- `BATCHED`

Escrow contains:
- `intent_id`
- `owner`
- `coin: Coin<T>` (owned by protocol via dynamic field; refunded/transferred by protocol code)

#### Auction: `Auction`

Stored as a dynamic field under `AuctionBook`.

Fields:
- `auction_id: u64`
- `intent_ids: vector<u64>` (MVP size limit enforced by `AuctionBook.max_intents_per_auction`, currently `10`)
- `status: u8` (`OPEN` or `SETTLED`)
- `created_at_ms: u64`
- `deadline_ms: u64`

#### Intent discovery link: `IntentRecordLink`

Owned by users, created during intent creation and transferred to the intent owner.

Fields:
- `auction_book: ID`
- `intent_id: u64`
- `schema_version: u8`

**Security:** this object is *not* trusted for correctness; it is purely a discovery pointer. The canonical intent state lives under `AuctionBook`.

### Lifecycle and state transitions

#### Intent status values

Implemented in `swappy::intent`:
- `OPEN_ESCROWED`
- `BATCHED`
- `SETTLED`
- `CANCELED`
- `EXPIRED`

**Allowed transitions only:**
- `OPEN_ESCROWED → BATCHED` (via `auction::attach_intents`)
- `OPEN_ESCROWED → CANCELED` (via `intent::cancel_intent`, owner-only)
- `OPEN_ESCROWED → EXPIRED` (via `intent::reclaim_if_expired`, permissionless)
- `BATCHED → SETTLED` (via settlement non-skip step)
- `BATCHED → OPEN_ESCROWED` (**SKIP only**, via settlement skip step; escrow remains)

Any other transition must abort (or be impossible).

#### Auction status values

Implemented in `swappy::auction`:
- `OPEN`
- `SETTLED`

**Note:** settlement begins by marking the auction `SETTLED` immediately to prevent concurrent settlement. Any later abort in the same PTB reverts that change.

### Entry points and on-chain checks

#### Create intent + deposit

`intent::create_intent_and_deposit<Sell, Buy>(...)`

Checks:
- `Sell != Buy`
- `now_ms < expiration_ms` (strict)
- `sell_amount > 0`, `min_buy_amount > 0`
- provided coin value `>= sell_amount`

Effects:
- Create `IntentRecord` with status `OPEN_ESCROWED`
- Create escrow entry for the exact deposited amount (splitting and refunding any remainder)
- Create + transfer `IntentRecordLink` to the user

#### Cancel intent (owner-only)

`intent::cancel_intent<T>(...)`

Checks:
- caller is intent `owner`
- status is `OPEN_ESCROWED`
- `now_ms < expiration_ms` (strict)
- type arg `T` matches `sell_token` of intent (caller must supply correct type)

Effects:
- status → `CANCELED`, `auction_id → none`
- remove escrow and refund to owner

#### Reclaim expired intent (permissionless)

`intent::reclaim_if_expired<T>(...)`

Checks:
- status is `OPEN_ESCROWED`
- `now_ms >= expiration_ms`
- type arg `T` matches intent sell token

Effects:
- status → `EXPIRED`, `auction_id → none`
- remove escrow and refund to owner

#### Create auction

`auction::create_auction(...)`

Checks:
- `deadline_ms > now_ms`

Effects:
- create new `Auction` with status `OPEN`

#### Attach intents into an auction (batching)

`auction::attach_intents(...)`

Checks:
- auction exists and is `OPEN`
- `now_ms < auction.deadline_ms`
- total intents in auction `<= max_intents_per_auction`
- no duplicates in the provided `intent_ids` list
- for each intent:
  - status is `OPEN_ESCROWED`
  - `now_ms < intent.expiration_ms`

Effects:
- each intent: `OPEN_ESCROWED → BATCHED`, `auction_id = some(auction_id)`
- append ids to auction’s `intent_ids`

### Settlement interface (permissionless, atomic, fully reverting)

Settlement is designed to be executed inside a single Sui **Programmable Transaction Block (PTB)**:

1. `settlement::begin(...) -> SettlementSession`
2. One or more `settlement::step_*` calls
3. `settlement::finalize(session)`

#### Settlement session

`SettlementSession` is a “hot potato” value with **no `drop`**, forcing PTBs to end with `finalize`.

It tracks:
- `all_intents` (snapshot from the auction at `begin`)
- `covered` (intents referenced by any step)
- `used_non_skip` (intents used by non-skip steps; prevents reuse)

#### Mandatory settlement checks (enforced on-chain)

Across `begin`, steps, and `finalize`, settlement enforces:
- auction exists and is `OPEN` at `begin`
- each referenced intent is part of the auction
- each referenced intent has status `BATCHED` (for non-skip steps; skip also requires `BATCHED`)
- strict expiry: `now_ms < intent.expiration_ms`
- **each intent is covered** by the plan (finalize checks coverage)
- **each intent is used at most once** in a non-skip step (plan abuse prevention)
- output satisfies `min_buy_amount` for non-skip steps

#### Step types

Implemented today:
- `step_skip`: `BATCHED → OPEN_ESCROWED` (escrow remains; intent removed from auction association)
- `step_cow_match<X, Y>`: two-intent “coincidence of wants” full-fill match
  - enforces type args correspond to intent token types
  - enforces full-fill semantics (MVP): exchanged amounts equal counterpart sell amounts
  - enforces `min_buy_amount` for both
  - transfers escrowed coins to counterparties
  - marks both intents `SETTLED`
- `step_cetus_swap_exact_in<TIn, TOut>`: adapter step
  - enforces pool allowlist by reading `AuctionBook.cetus_pool_id`
  - currently depends on `swappy::cetus_adapter` which **aborts** until integrated

#### Finalize

`finalize(session)` asserts every auction intent appears in `covered`.

### Coordinator (optional REST service)

The coordinator is an untrusted Fastify service used for:
- **Token registry** for metadata/formatting: `GET /api/tokens?network=<network>`
- **Advisory free-text parsing** preview: `POST /api/intent/free-text?network=<network>`

It enforces a global `?network=` parameter (except `/health`) and provides a canonical JSON error schema.

Full docs: `coordinator/README.md`.

### Frontend integration modes

The frontend supports:
- **Mock backend** (`NEXT_PUBLIC_USE_MOCK_BACKEND=true`): token registry + parsing + wallet results mocked
- **Mock chain** (`NEXT_PUBLIC_USE_MOCK_CHAIN=true`): chain reads mocked for demo friendliness
- **Coordinator-free chain reads** (real chain): uses owned `IntentRecordLink` + dynamic-field reads from `AuctionBook`

Full docs: `frontend/README.md`, `frontend/Workflow.md`, `frontend/DEMO_SAFETY_CHECKLIST.md`.

## Edge Cases

- **Settlement reentrancy / concurrent settlers**: `begin` flips auction to `SETTLED` immediately; later aborts revert everything.
- **Expired intents**: all settlement steps enforce strict `now_ms < expiration_ms`; expired intents cannot be settled.
- **Plan incompleteness**: `finalize` aborts if any auction intent is not covered by the steps.
- **Double-usage**: non-skip reuse aborts (prevents “use intent twice” exploits).
- **Cetus path**: will fail until external integration details are provided (`ECetusNotIntegrated`).

## Open Questions (if any)

- **Canonical production USDC type**: `swappy::usdc_coin::USDC` is a placeholder.
- **External DEX integration**: exact package/module/function signatures and type addresses for Cetus are not yet specified.


