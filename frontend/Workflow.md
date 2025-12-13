# Frontend Workflows (User ↔ Backend ↔ Chain)

This document describes the current UX flows and the corresponding backend + on-chain interactions.

## Trust boundaries (non-negotiable)
- **Chain (Move)**: authoritative for funds and finality.
- **Backend**: informational (REST), may be unavailable or temporarily inconsistent.
- **Frontend**: untrusted UI; must never imply finality without on-chain evidence (tx digest).
- **Wallet**: user-controlled signer; all fund movement must be explicitly approved by the user.

## Global behaviors

### Network selection
- **User**
  - Selects network via header dropdown: `mainnet | testnet | devnet | localnet`.
  - Choice persists in `localStorage` under `swappy.network`.
- **Backend**
  - Every REST request includes `network=<network>` query param (added automatically in `src/lib/api/client.ts`).
- **Chain**
  - `SuiClientProvider` is configured with all networks and uses the selected network as `defaultNetwork`.

### Token registry (metadata only)
- **User**
  - Sees token symbols/decimals consistently; if registry fails, sees a non-blocking warning.
- **Backend**
  - `GET /tokens?network=<network>` fetched once per app load (in-memory cache).
- **Chain**
  - Not used for discovery; token registry is descriptive only.

### Failure and uncertainty rules
- **Backend unavailable**
  - UI shows: “Service temporarily unavailable. Please try again later.”
  - No infinite spinners: REST calls time out and fail fast.
- **Wallet rejection/failure**
  - UI shows explicit error (e.g. “Transaction was rejected in wallet.”).
  - UI remains recoverable (no clearing input/preview on failure).
- **Terminal status without tx digest**
  - UI shows **warning**: “Status pending on-chain confirmation… Funds are not finalized until confirmed on-chain.”

## Workflow 1 — Dashboard (`/`)

### Goal
Let a user connect their wallet, see whether they have intents, and navigate to creation or inspection.

### User flow
1. User visits `/`.
2. If disconnected, user clicks **Connect Wallet**.
3. If connected, user sees their intents table or an empty state.

### Frontend behavior
- No wallet connected:
  - No backend calls.
  - Shows connect CTA + “No backend calls are made until you connect.”
- Wallet connected:
  - Triggers one fetch per page load/reconnect (no polling).
  - Shows loading / explicit error / empty / table states.

### Backend interactions
- `GET /intents?owner=<wallet_address>&network=<network>`

### Chain interactions
- None (read-only). Wallet connect only.

## Workflow 2 — Create intent (`/intent/new`)

### Goal
User writes free-text, previews parsed intent, then explicitly signs escrow transaction.

### User flow
1. User navigates to `/intent/new`.
2. If disconnected, page shows “Connect your wallet to create an intent” and disables inputs.
3. User enters free-text intent.
4. User clicks **Parse**.
5. User reviews read-only preview + escrow warning.
6. User clicks **Confirm & Deposit** (explicit signing).
7. On success, UI shows digest + explorer link and redirects to `/intent/<intent_id>`.

### Frontend behavior
- Parse errors do not clear input.
- Wallet tx errors do not clear parsed preview.
- Preview always shows escrow warning.
- Indicative token prices (if available) are shown **only** in preview with a disclaimer.

### Backend interactions
- `POST /intent/free-text?network=<network>`
  - Body: `{ text: "<raw user text>" }`

### Chain interactions
- Wallet-signed transaction: `create_intent_and_deposit(...)`
  - **Current state**: mocked in demo mode; real tx build is TODO pending argument schema.
  - **Safety**: never auto-trigger; only on explicit user click.

## Workflow 3 — Intent detail (`/intent/[intent_id]`)

### Goal
Provide a canonical lifecycle view explaining funds state, actions, and on-chain proof.

### User flow
1. User opens `/intent/<intent_id>` from dashboard/auction or direct navigation.
2. Page shows canonical intent info + exactly one status-specific block.
3. If `OPEN_ESCROWED`, user may click **Cancel Intent**.
4. If `BATCHED` or `SETTLED` and `auctionId` exists, user can click **View Auction**.

### Frontend behavior
- Fetches once on mount (no polling).
- Shows loading / explicit error / not-found states.
- Status blocks are mutually exclusive.
- Shows warning when terminal status has no digest (pending confirmation).
- Shows warning when intent fields are partial (non-blocking).

### Backend interactions
- `GET /intent/<intent_id>?network=<network>`

### Chain interactions
- Only for `OPEN_ESCROWED` cancellation:
  - Wallet-signed transaction: `cancel_intent(...)`
  - **Current state**: mocked in demo mode; real tx build is TODO pending argument schema.
- For terminal proofs:
  - Explorer links are shown **only** if backend provides tx digests.

## Workflow 4 — Auction detail (`/auction/[auction_id]`)

### Goal
Judge-facing explanation of batch auction grouping, execution type, solver used, and settlement proof.

### User flow
1. User opens `/auction/<auction_id>` (via intent link, or direct navigation).
2. Page shows overview + intents table.
3. If status is OPEN, user sees “Waiting for settlement”.
4. If status is SETTLED, user sees settlement summary + tx digest proof (if present).

### Frontend behavior
- Fetches once on mount (no polling).
- Read-only; no wallet interactions.
- Shows warning if status is SETTLED but settlement digest is missing (pending confirmation).

### Backend interactions
- `GET /auction/<auction_id>?network=<network>`

### Chain interactions
- None (read-only). Explorer links only if digest exists.

## Demo/mock mode notes
- When `NEXT_PUBLIC_USE_MOCK_BACKEND=true`, the backend calls are served by `src/lib/api/mock.ts`.
- Wallet tx functions return simulated digests/intent IDs; **real on-chain wiring requires argument schemas**.


