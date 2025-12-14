# Swappy

Swappy is an **intent-based batch auction trading protocol on Sui**, with a demo-friendly frontend and an optional, untrusted coordinator service.

**Prime directive:** *fund safety and invariants are enforced exclusively on-chain* (Move). Off-chain services are **never trusted** for correctness.

## What’s in this repo

- **Move contracts** (`contracts/swappy`): escrow, intent lifecycle, auction batching, and **permissionless atomic settlement**.
- **Frontend** (`frontend`): Next.js UI for creating/viewing intents and auctions; wallet-signed txs only.
- **Coordinator** (`coordinator`): optional Fastify HTTP service for token metadata + advisory free-text parsing.
- **Docs**
  - `TECH_SPEC.md` (canonical spec for *this repo’s current implementation*)
  - `docs/ARCHITECTURE.md`
  - `docs/CONTRACTS.md`
  - `docs/LOCAL_DEV.md`
  - `docs/SECURITY_MODEL.md`

## Trust model (non-negotiable)

- **Trusted**: Move contracts (sole authority over funds and invariants).
- **Untrusted**: Frontend, Coordinator, (future) Driver, (future) Solvers.
- **Safety > liveness**: it’s acceptable to fail to settle; it is not acceptable to settle incorrectly.

## Quickstart

### Prerequisites

- **Node.js >= 18** (for `frontend/` and `coordinator/`)
- **Sui CLI** (for `contracts/swappy/`)

### 1) Move contracts (build + tests)

```bash
cd contracts/swappy
sui move build
sui move test
```

### 2) Coordinator (optional)

The coordinator is **informational** only (token registry + advisory parsing).

```bash
cd coordinator
cp env.template .env
npm install
npm run dev
```

See `coordinator/README.md` for full endpoint and env details.

### 3) Frontend

```bash
cd frontend
npm install
npm run dev
```

See `frontend/README.md` for environment variables, mock modes, and workflow details (`frontend/Workflow.md`).

## Implementation status notes (important)

- **Cetus integration is intentionally stubbed**: `swappy::cetus_adapter` aborts until the exact external package/function signature is provided. Settlement steps that require Cetus will fail with `ECetusNotIntegrated` (abort code `900`).
- **USDC type is a placeholder** for tests/demo: `swappy::usdc_coin::USDC` is *not* the canonical mainnet USDC type.
- **Coordinator-free reads** are a first-class design goal: users own `swappy::link::IntentRecordLink` objects which allow the frontend to discover intents without relying on any backend.

## Where to look next

- **Protocol spec**: `TECH_SPEC.md`
- **Contract entrypoints/state machine**: `docs/CONTRACTS.md`
- **System architecture + trust boundaries**: `docs/ARCHITECTURE.md`
- **Local development guide**: `docs/LOCAL_DEV.md`
- **Security model**: `docs/SECURITY_MODEL.md`


