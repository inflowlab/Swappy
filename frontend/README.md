## Overview (non-technical)

Swappy is a demo-friendly app for **intent-based trading on Sui**.

You describe what you want in plain English (“Swap 10 SUI to USDC…”), review a clear preview, and only then (with explicit wallet approval) escrow funds on-chain for batch-auction settlement.

The UI is designed to **never hide uncertainty**:
- If the backend is down, it says so.
- If the wallet rejects a tx, it says so.
- If a terminal status lacks on-chain proof (tx digest), it shows “pending confirmation”.

## Use cases
- **Connect wallet + see intents**: Dashboard shows whether you have intents and what you can do next.
- **Create a new intent**: Free-text → parse → preview → explicit “Confirm & Deposit”.
- **Understand an intent’s lifecycle**: Intent detail page explains what happened to funds, status-by-status.
- **Explain a batch auction to judges**: Auction detail page shows grouped intents, execution type, solver(s), and settlement proof.

## Technical overview (for engineers)
- **Framework**: Next.js (App Router) + React + TypeScript + Tailwind.
- **Trust model**:
  - **Chain** is authoritative for funds/finality.
  - **Backend** is informational; can be unavailable or temporarily inconsistent.
  - **Frontend** is untrusted; it only displays and triggers wallet-signed actions.
- **Architecture**:
  - REST reads live in `src/lib/api/*` (all calls include `network=<...>`).
  - Wallet writes live in `src/lib/wallet/*` (real tx building is TODO pending arg schemas).
  - Token metadata is fetched once per app load via `GET /tokens` and cached in-memory.
  - Errors are mapped via a shared taxonomy in `src/lib/errors/ui-errors.ts`.

## Development

### Prerequisites
- Node.js + npm

### Environment
- Copy the example env file:

```bash
cp .env.example .env.local
```

- Common settings:
  - `NEXT_PUBLIC_USE_MOCK_BACKEND=true` (demo without backend + mock tx results)
  - `NEXT_PUBLIC_DEFAULT_NETWORK=testnet` (can be changed from the UI dropdown at runtime)
  - `NEXT_PUBLIC_BACKEND_BASE_URL=...` (when using a real backend)
  - `NEXT_PUBLIC_SUI_EXPLORER_BASE_URL=...`
  - `NEXT_PUBLIC_PROTOCOL_PACKAGE_ID=...` (required for real tx wiring later)

### Run (dev)

First, run the development server:

```bash
npm run dev
```

Open `http://localhost:3000` in your browser.

### Lint / build
```bash
npm run lint
npm run build
```

### Clean
```bash
rm -rf .next
rm -rf node_modules
rm -f package-lock.json
```

Then reinstall with:

```bash
npm install
```

## Production best practices (recommended)
- **Build once, run many**:

```bash
npm run build
npm run start
```

- **Set env vars explicitly** (do not rely on `.env.local` in production).
- **Pin network selection** for demos (use a fixed default and/or restrict dropdown if desired).
- **Use a reverse proxy** (TLS termination, compression, caching headers) and a process manager.
- **Do not claim finality without proof**: require tx digests for terminal states (UI already warns if missing).

## What can be improved next
- **Real on-chain tx wiring**: implement `create_intent_and_deposit` and `cancel_intent` once the argument schemas and Move function signatures are finalized.
- **Backend contract hardening**: align final response schemas for intent/auction details (required fields per status).
- **Tests**: add unit tests for error taxonomy, token formatting, and network-param injection.
- **Better “partial data” UX**: show which fields are missing and why, without blocking the page.
- **Production hardening**: structured logging + error reporting, CSP headers, and deployment templates.

## Docs
- `TODO.md`: what is mocked and what remains to integrate
- `Workflow.md`: user/backend/chain workflows

