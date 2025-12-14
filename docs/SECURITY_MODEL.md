## Context

This document summarizes Swappy’s security model and the invariants that must remain true.

## Plan

- Restate trust boundaries and forbidden assumptions.
- List protocol invariants enforced on-chain.
- Call out known non-features (intentional) that prevent unsafe reliance on off-chain components.

## Code / Pseudocode

### Trust boundaries

- **Move contracts are trusted** and are the sole authority over funds.
- **Frontend is untrusted**: it displays data and triggers wallet-signed transactions.
- **Coordinator is untrusted**: it provides informational metadata and advisory parsing only.

### Global rules

- **All invariants are enforced on-chain**.
- **Settlement is permissionless**.
- **Settlement is atomic and fully reverting**: any violation aborts and reverts the entire PTB.
- **No indexers or event listeners** are required for correctness.
- If off-chain data is missing or inconsistent, the correct behavior is to **fail safely** (not to “assume”).

### Core on-chain invariants (enforced in Move)

- **Escrow existence invariant**:
  - Escrow exists **iff** intent status is `OPEN_ESCROWED` or `BATCHED`.
- **Intent lifecycle**:
  - Only the allowed transitions occur (cancel/expire/batch/settle/skip).
- **Strict time checks**:
  - `now_ms < expiration_ms` for active actions and settlement steps.
- **Auction constraints**:
  - auction must be `OPEN` to be settled (at `begin`)
  - auction must be `OPEN` and before deadline to attach intents
  - max intents per auction is bounded (MVP: 10)
- **Settlement plan constraints**:
  - every intent in the auction must be covered by the plan (`finalize`)
  - no intent can be used more than once in a non-skip step
  - non-skip steps must satisfy `min_buy_amount`

### Important non-features (intentional)

- The coordinator does **not** control funds or settlement.
- There is no reliance on events for correctness.
- The `swappy::cetus_adapter` is stubbed and aborts until fully specified to avoid accidentally “inventing” swap semantics.

## Edge Cases

- Liveness failures (e.g. no solver/driver available) are acceptable; funds remain safely escrowed and can be canceled/expired per rules.

## Open Questions (if any)

- External DEX integration details (package addresses + signatures) for Cetus adapter.
- Canonical mainnet USDC type for real deployments.


