# Coordinator Service (Swappy)

### Context
The **Coordinator** is a **stateless, untrusted** HTTP service that supports the Swappy frontend by providing:
- **Static token registry** for display and formatting.
- **Advisory free-text intent parsing** into a structured preview (no funds, no authority).

The Coordinator is **not a source of truth** and must never be treated as authoritative over on-chain state.

---

### What’s in here
- **Fastify** server (TypeScript, ESM)
- **Global `?network=` enforcement** (except `/health`)
- **Canonical error schema** for all non-2xx responses
- **Token Registry**: `GET /api/tokens`
- **Intent Parsing (advisory)**: `POST /api/intent/free-text`
  - Uses OpenAI Structured Outputs (schema-constrained)
  - Deterministic defaults for expiry and slippage-derived min amounts
  - **Unit tests** fully mock OpenAI (no network)
  - Optional **integration script** calls OpenAI for manual validation

---

### Project layout
```
coordinator/
  config/                    # static per-network assets
    tokens.<network>.json
  src/
    app.ts                   # Fastify app builder (injectable for tests)
    server.ts                # process entrypoint
    config/env.ts            # env loader + validation
    errors/httpError.ts      # canonical error schema helper
    plugins/                 # global middleware
    routes/                  # HTTP routes
    intent/                  # parsing types, prompt, OpenAI adapter, parser core
    tokens/                  # token registry loader + cache
    utils/                   # deterministic helpers (decimal math, caches)
  tests/                     # Vitest tests using Fastify inject()
  scripts/                   # optional integration scripts (may call OpenAI)
```

---

### Requirements
- **Node.js >= 18**
- `npm` available

---

### Install
From repo root:
```bash
cd coordinator
npm install
```

---

### Environment variables
Required to **start** the service:
- **`NETWORKS_SUPPORTED`**: comma-separated list (e.g. `"mainnet,testnet,devnet,localnet"`)

Tip: this repo blocks committing `.env` files. Use `coordinator/env.template` as your starting point:

```bash
cd coordinator
cp env.template .env
```

Optional (defaults shown):
- **`PORT`**: `3000`
- **`HOST`**: `0.0.0.0`
- **`CORS_ORIGIN`**: `*` (dev-friendly; set explicitly for production)

Intent parsing (defaults shown):
- **`MAX_TEXT_LEN`**: `500`
- **`DEFAULT_EXPIRY_MINUTES`**: `15` (1..1440)
- **`DEFAULT_MAX_SLIPPAGE_BPS`**: `100` (0..5000)
- **`PARSER_TIMEOUT_MS`**: `10000`
- **`PARSER_IDEMPOTENCY_TTL_MS`**: `600000`
- **`PARSER_RATE_LIMIT_PER_MINUTE`**: `30`

OpenAI (required only for parsing):
- **`OPENAI_API_KEY`**
- **`OPENAI_MODEL`** (example: `"gpt-4o-2024-08-06"`)

---

### Run locally
From `coordinator/`:
```bash
npm run dev
```

The server will load (in order) `coordinator/env.local`, `coordinator/.env`, and `coordinator/.env.local` into `process.env` at startup (shell env vars still take priority).

---

### Endpoints

### Health
- **GET `/health`**
- No `network` required
- Response:
```json
{ "status": "ok" }
```

### Global network enforcement
All routes **except** `/health` require:
- `?network=<network>` and `<network>` must be included in `NETWORKS_SUPPORTED`

Missing/invalid:
```json
{
  "error": "Invalid network parameter.",
  "code": "INVALID_NETWORK",
  "details": { "expected": ["mainnet","testnet","devnet","localnet"] }
}
```

### Token registry (display-only)
- **GET `/api/tokens?network=<network>`**
- Returns the per-network static list from `config/tokens.<network>.json`

### Intent parsing (advisory only)
- **POST `/api/intent/free-text?network=<network>`**
- Body:
```json
{ "text": "Swap 10 SUI to USDC" }
```
- Success response:
```json
{
  "rawText": "Swap 10 SUI to USDC",
  "parsed": {
    "sellToken": "0x2::sui::SUI",
    "buyToken": "0xUSDC",
    "sellAmount": "10",
    "minBuyAmount": "29.7",
    "expiresAtMs": 1700000900000
  }
}
```

---

### Error schema (canonical)
All errors are returned as:
```json
{
  "error": "Human-readable message.",
  "code": "MACHINE_READABLE_CODE",
  "details": { "optional": "object" }
}
```

---

### Tests
Unit tests are **offline-safe** (OpenAI is mocked).
```bash
cd coordinator
npm test
```

---

### Optional: OpenAI integration script (calls the real API)
This is **not** run in CI and will incur OpenAI usage.

#### One-line command (run from repo root)
```bash
NETWORKS_SUPPORTED="devnet,testnet,mainnet,localnet" OPENAI_API_KEY="..." OPENAI_MODEL="gpt-4o-2024-08-06" \
  npm --prefix ./coordinator run test:integration:openai -- --network devnet --text "Swap 10 SUI to USDC"
```

#### Run from `coordinator/`
```bash
cd coordinator
export NETWORKS_SUPPORTED="devnet,testnet,mainnet,localnet"
export OPENAI_API_KEY="..."
export OPENAI_MODEL="gpt-5-mini-2025-08-07"

npm run test:integration:openai -- --network devnet --text "Swap 10 SUI to USDC"
```

Note: only use `--prefix ./coordinator` when you run the command from the **repo root**. If you are already in `coordinator/`, run the `npm run ...` form above (otherwise you’ll end up with `coordinator/coordinator/package.json`).

This prints the final API-shaped JSON (including full `coinType` addresses).


