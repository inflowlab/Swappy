## Demo Safety Checklist (Frontend)

### Trust Boundaries (always true)
- **Frontend is untrusted**: it only displays information and triggers wallet-signed actions.
- **Backend is informational**: outages and inconsistent responses must be visible.
- **On-chain is authoritative**: any finality claims require on-chain evidence (tx digest).

### Quick QA (judges can be shown this live)
- **Dashboard**
  - Wallet disconnected: no backend calls, clear connect CTA.
  - Wallet connected: one fetch per load/reconnect, explicit loading + error states.
  - Empty list: “No intents yet…” message + Create Intent CTA.
- **Create Intent**
  - No wallet: inputs disabled + “Connect your wallet…” warning.
  - Parse failures: input preserved; error explains next step.
  - Preview shown before signing; escrow warning is visible.
  - Confirm requires explicit click; no automatic signing.
  - Wallet rejection shows “Transaction was rejected in wallet.” and is retryable without re-parsing.
- **Intent Detail**
  - Exactly one status block visible.
  - `OPEN_ESCROWED`: cancel button only here; tx pending disables button.
  - Terminal state without tx digest: **warning** “Status pending on-chain confirmation…” (non-blocking).
  - Explorer links only shown when digest exists (no fabricated links).
- **Auction Detail**
  - Single fetch per load; explicit not-found and unavailable errors.
  - OPEN: “Waiting for settlement” message with deadline.
  - SETTLED: settlement proof section; missing digest triggers pending-confirmation warning.
- **Token Registry**
  - Fetches once per app load (in-memory).
  - Failure shows non-blocking warning; UI still renders with fallback labels.


