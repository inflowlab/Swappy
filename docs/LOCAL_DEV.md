## Context

This is a practical guide for running Swappy locally (contracts, coordinator, frontend).

## Plan

- Provide a “happy path” local workflow.
- Document mock/demo modes for frontend.
- Document common failure modes and how to confirm what’s running.

## Code / Pseudocode

### 1) Contracts (Move)

```bash
cd contracts/swappy
sui move build
sui move test
```

### 2) Coordinator (optional)

```bash
cd coordinator
cp env.template .env
npm install
npm run dev
```

- Health endpoint: `GET /health`
- Token registry: `GET /api/tokens?network=<network>`
- Free-text parse: `POST /api/intent/free-text?network=<network>`

See `coordinator/README.md` for full details.

### 3) Frontend

```bash
cd frontend
npm install
npm run dev
```

#### Environment variables

The frontend expects a `.env.example` in `frontend/` as the starting point (copy it to `.env.local` as described in `frontend/README.md`).

Key behaviors to know:
- **Mock backend**: `NEXT_PUBLIC_USE_MOCK_BACKEND=true`
- **Mock chain**: `NEXT_PUBLIC_USE_MOCK_CHAIN=true`
- **Default network**: `NEXT_PUBLIC_DEFAULT_NETWORK=<mainnet|testnet|devnet|localnet>`
- **Coordinator URL** (optional): `NEXT_PUBLIC_COORDINATOR_URL=...`

See:
- `frontend/README.md`
- `frontend/Workflow.md`
- `frontend/DEMO_SAFETY_CHECKLIST.md`
- `frontend/TODO.md` (integration checklist)

### Running everything at once (manual)

In separate terminals:

```bash
cd coordinator && npm run dev
```

```bash
cd frontend && npm run dev
```

Contracts are compiled/tested separately via `sui move test`.

## Edge Cases

- If the coordinator is down, the frontend should still operate for **coordinator-free chain reads** (and demo mocks).
- If chain env vars are missing, the frontend can fall back to mock-chain mode depending on configuration (see `frontend/TODO.md`).

## Open Questions (if any)

- None in this document.


