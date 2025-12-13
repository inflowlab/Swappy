# Frontend TODO / Integration Notes

This document is the **handoff checklist** between the current demo-safe frontend foundations and the upcoming real backend + on-chain contract wiring.

## What is mocked today (what/how/where)

### Backend REST (mock mode)
- **How**
  - Set `NEXT_PUBLIC_USE_MOCK_BACKEND=true` to force mock responses.
  - Additionally, if `NEXT_PUBLIC_BACKEND_BASE_URL` is missing, the API client falls back to mocks.
- **Where**
  - Mock data + mock endpoints live in `src/lib/api/mock.ts`.
  - Client routing to mock vs real lives in `src/lib/api/client.ts` (`shouldMockBackend()`).

#### Mocked endpoints
- **GET /tokens**
  - **Where**: `mockGetTokens()` in `src/lib/api/mock.ts`, used by `getTokens()` in `src/lib/api/client.ts`.
  - **Notes**: Includes optional `indicativePriceUsd` for preview-only display.

- **POST /intent/free-text**
  - **Where**: `mockParseFreeTextIntent(text)` in `src/lib/api/mock.ts`, used by `parseFreeTextIntent()` in `src/lib/api/client.ts`.
  - **Notes**: This is a demo-only parser. **Real parsing is authoritative on the backend.**

### Wallet transactions (mock mode)
- **How**
  - In mock mode (`NEXT_PUBLIC_USE_MOCK_BACKEND=true`), wallet tx functions simulate a successful tx result.
- **Where**
  - Create intent: `src/lib/wallet/create-intent.ts` (`createIntentAndDeposit()`).
  - Cancel intent: `src/lib/wallet/cancel-intent.ts` (`cancelIntent()`).

### Token registry usage
- **How**
  - Token registry is fetched once per app load and cached in-memory.
  - If token registry fetch fails, UI shows a **non-blocking warning** and falls back to “Unknown Token”/short IDs.
- **Where**
  - Provider + hook: `src/components/tokens/token-registry.tsx`
  - Warning banner: `src/components/tokens/token-registry-banner.tsx` (rendered globally in the shell)
  - Formatting utilities: `src/lib/tokens/format.ts`

### Indicative prices (preview only)
- **How**
  - Only displayed in the parsed intent preview (create intent page), and only if provided by `/tokens`.
  - Always includes disclaimer: “Prices are indicative only. Final execution enforced on-chain.”
- **Where**
  - UI: `src/app/intent/new/page.tsx`

## Global integration behaviors (important)

### Network selection (required)
- **How**
  - User selects network via the header dropdown (persisted in `localStorage`).
  - Default is `NEXT_PUBLIC_DEFAULT_NETWORK` (fallback: `testnet`).
- **Where**
  - Provider: `src/components/network/network-provider.tsx`
  - Dropdown: `src/components/layout/app-header.tsx`
  - Backend query injection: `src/lib/api/network.ts` + `src/lib/api/client.ts`
  - Sui client wiring: `src/components/wallet/wallet-connection.tsx` (`SuiClientProvider defaultNetwork={network}`)
- **Contract**
  - Every backend request includes `network=<mainnet|testnet|devnet|localnet>` as a query param.
  - Every backend request also includes `chainIdentifier=<expected_chain_identifier>` as a query param.

### Coordinator-free read plane (on-chain)
- **Dashboard, Intent Detail, Auction Detail** now read from chain directly:
  - `suix_getOwnedObjects` filtered by `NEXT_PUBLIC_INTENT_LINK_TYPE_{NETWORK}`
  - `sui_getDynamicFieldObject` under `NEXT_PUBLIC_AUCTION_BOOK_ID_{NETWORK}` with `u64` keys
- These reads require env-driven configuration per network in real deployments:
  - `NEXT_PUBLIC_SUI_RPC_{NETWORK}`
  - `NEXT_PUBLIC_CHAIN_IDENTIFIER_{NETWORK}`
  - `NEXT_PUBLIC_AUCTION_BOOK_ID_{NETWORK}`
  - `NEXT_PUBLIC_INTENT_LINK_TYPE_{NETWORK}`
  - `NEXT_PUBLIC_INTENT_TYPE_{NETWORK}` (validation/decoding only)

### Mock-chain mode (demo-friendly)
- **How**
  - Set `NEXT_PUBLIC_USE_MOCK_CHAIN=true`
  - `NEXT_PUBLIC_USE_MOCK_BACKEND=true` also implies mock-chain for convenience.
- **Where**
  - Mock chain objects live in `src/lib/sui/mock.ts`
  - Read modules automatically use mock chain when:
    - `NEXT_PUBLIC_USE_MOCK_CHAIN=true`, OR
    - required chain env vars are missing for the selected network (implicit demo fallback)
  - Modules involved:
    - `src/lib/sui/links.ts`
    - `src/lib/sui/intents.ts`
    - `src/lib/sui/auctions.ts`
    - `src/lib/sui/client.ts` (chainIdentifier)

### Fail-fast backend calls (no infinite spinners)
- **How**
  - API fetches use a default timeout (10s) and abort on timeout.
- **Where**
  - `src/lib/api/http.ts`

### Error taxonomy (consistent, non-silent failures)
- **How**
  - All pages map raw errors to a canonical UI error category+code and user-safe message.
  - Codes are logged to console for demo observability.
- **Where**
  - `src/lib/errors/ui-errors.ts`

## What must be finished / adjusted for the real backend contract

### Backend endpoints + shapes (authoritative contract)
- **GET /tokens**
  - Confirm canonical token **ID** used across all APIs (coinType/address/objectId).
  - Provide `symbol`, `decimals`; optional `indicativePriceUsd` allowed (preview-only).

- **POST /intent/free-text?network=<network>**
  - Backend parsing is authoritative; frontend sends raw text.
  - Confirm parse response schema:
    - sell/buy token identifiers
    - sell amount, minimum buy amount
    - expiration timestamp
  - If parse fails due to user input, return a 4xx so UI can classify it as `USER_INPUT_UNPARSEABLE`.

### On-chain transaction wiring (argument schema pending)
- **create_intent_and_deposit(...)**
  - **Where to implement**: `src/lib/wallet/create-intent.ts` (`TODO(protocol)`).
  - Requires argument schema (Move module/function signature + type args + object IDs + coin inputs).
  - Must stay: **explicit user approval only** (never auto-trigger signing).

- **cancel_intent(...)**
  - **Where to implement**: `src/lib/wallet/cancel-intent.ts` (`TODO(protocol)`).
  - Requires argument schema (Move module/function signature + required object IDs).

### Invariant warning logic depends on backend invariants
- UI shows “pending on-chain confirmation” warning when terminal statuses lack digests.
- If backend invariants are changed, update:
  - `src/components/intent/intent-detail.tsx`
  - `src/components/auction/auction-detail.tsx`


