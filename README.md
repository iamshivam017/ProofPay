# ProofPay

> Verified intelligence before autonomous money moves.

ProofPay is an authenticity-gated agentic payment gateway built for the
**Telegraph Protocol Hackathon — Track 3**. It asks a live Telegraph Miner to
assess submitted evidence through the x402 micropayment protocol, applies a
deterministic policy, and executes a Base Sepolia payment only for an exact
`ALLOW` verdict.

**Status:** Hackathon-ready code complete — live testnet verification pending.

## Safety contract

- Production paths use real Telegraph Miner responses. There are no mocked
  Miner results, scores, x402 settlements, telemetry events, or transaction
  hashes.
- Only `ALLOW` reaches the payment executor. `REVIEW`, `BLOCK`, malformed input,
  dependency failure, and runtime-unknown states move `$0`.
- Both x402 settlement and downstream transfer are pinned to Base Sepolia.
- Secrets remain server-side and must never use a `NEXT_PUBLIC_` prefix.
- Uncertainty fails closed and is made visible in the Decision Ticket.

## Core loop

1. A user submits an ETH amount, Base recipient, reason, and evidence text.
2. The server validates the request and configuration.
3. The x402 client calls the configured Telegraph endpoint, validates the paid
   challenge, signs the EIP-3009 USDC authorization, and captures settlement.
4. The Miner response is normalized without inventing absent fields.
5. The pure policy engine returns exactly `ALLOW`, `REVIEW`, or `BLOCK`.
6. The server calls the Base Sepolia executor only for `ALLOW` and waits for a
   successful receipt.
7. The UI renders the auditable Decision Ticket and real proof fields.

The major modules are deliberately separated:

| Layer | Location | Responsibility |
| --- | --- | --- |
| x402 / Telegraph | `lib/telegraph/x402-client.ts` | Paid HTTP exchange and settlement validation |
| Request/config | `src/lib/api`, `src/lib/config.ts` | Untrusted input and server environment validation |
| Policy | `src/lib/policy` | Pure deterministic decision rules |
| Payment | `src/lib/web3` | Base Sepolia-only gate and executor |
| Orchestration | `src/app/api/verify/route.ts` | Live vertical slice and Decision Ticket |
| UI | `src/app/page.tsx`, `src/components` | Request, chamber, decision, and receipt views |

## Locked policy

| Priority | Rule | Verdict |
| --- | --- | --- |
| 1 | Invalid evidence/input or any required risk `>= 0.85` | `BLOCK` |
| 2 | Missing/failed required signal, missing confidence, or risk conflict `>= 0.30` | `REVIEW` |
| 3 | Every required signal succeeds, risk `<= 0.35`, confidence `>= 0.80`, and conflict `< 0.30` | `ALLOW` |
| 4 | Anything else | `REVIEW` |

The engine contains one `ALLOW` return path. The payment gate independently
checks `decision.verdict === "ALLOW"` before calling the executor.

## Requirements and environment

- Node.js 20 or newer (CI uses Node.js 22)
- A complete paid Telegraph Engine/Miner POST endpoint supplied by Telegraph
- A dedicated, low-balance Base Sepolia burner wallet
- Base Sepolia ETH for downstream value and gas
- Base Sepolia USDC for x402 inference charges

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set these server-only values in `.env.local`:

| Variable | Required | Purpose |
| --- | --- | --- |
| `TELEGRAPH_ENGINE_URL` | Yes | Complete live paid POST endpoint |
| `EXECUTOR_PRIVATE_KEY` | Yes | Dedicated 32-byte burner key |
| `BASE_SEPOLIA_RPC_URL` | Yes | Base Sepolia RPC URL |
| `X402_MAX_PAYMENT_ATOMIC` | Yes | Maximum accepted x402 charge in 6-decimal USDC atoms |
| `BASE_SEPOLIA_USDC_ADDRESS` | No | Trusted USDC contract; defaults to Coinbase Base Sepolia USDC |
| `TELEGRAPH_REQUEST_TIMEOUT_MS` | No | Whole exchange timeout; defaults to 30 seconds |

Configuration validation reports only missing key names and safe warnings; it
never returns secret values. Non-local HTTP endpoints, placeholder Telegraph
hosts, malformed keys, and zero keys are rejected.

## API contract

`POST /api/verify` accepts:

```json
{
  "amount": "0.0001",
  "recipient": "0x1111111111111111111111111111111111111111",
  "reason": "Pay verified delivery invoice",
  "evidence": "Invoice INV-001 references completed delivery and signed receipt.",
  "intent": "AUTHENTICITY_GATE"
}
```

The public envelope caps a request at `0.001 ETH`; reason is capped at 280
characters and evidence at 20,000. Other intents are explicitly unsupported.
The response always has a request ID, timestamp, status, decision, reason,
signals, Telegraph metadata, payment metadata, and errors. Failed dependencies
return `payment.executed: false` and no hash.

Operational endpoints:

- `GET /api/health` — liveness, safe configuration boolean, network, timestamp.
- `GET /api/status` — safe configuration metadata and honest process-local
  counters. Counters reset on restart/cold start and are not durable analytics.

## x402 behavior and resilience

The client follows x402 v2 `PAYMENT-REQUIRED`, `PAYMENT-SIGNATURE`, and
`PAYMENT-RESPONSE`. It accepts only the `exact` scheme on `eip155:84532`, checks
the configured USDC asset, validates recipient/amount, enforces the charge cap,
checks balance, and requires successful settlement with a real transaction hash.

The whole exchange has a bounded timeout. HTTP 429/500/502/503 and network
failures map to Miner-unavailable states; timeout, malformed JSON, and x402
failures remain distinct. ProofPay adds no application-level blind retry because
the live endpoint has no confirmed idempotency contract; the x402 SDK may perform
only its protocol-defined payment recovery. Silently risking a duplicate
inference charge is less safe than holding the action.

## Commands

```bash
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

Unit tests use synthetic fixtures only for local decision, validation, error,
and gate logic. They never represent those fixtures as live Miner or chain
results. CI runs lint, typecheck, unit tests, and build without credentials;
live integration is intentionally opt-in.

## Judge demo

The landing screen includes legitimate and suspicious evidence presets. They
prefill only user inputs: both still call the live Miner, pay x402, run the real
policy, and respect the production payment gate.

1. Configure and fund a dedicated Base Sepolia burner.
2. Open the app and confirm the testnet badge.
3. Enter a recipient and choose a preset or provide evidence.
4. Submit and narrate the real chamber status.
5. For `ALLOW`, open the returned BaseScan link and confirm status `Success`.
6. For `REVIEW` or `BLOCK`, show `$0 moved` and confirm no downstream hash.

The CLI live check uses that same API route:

```bash
npm run demo:payment -- \
  0xYourBaseSepoliaRecipient \
  "Authentic evidence expected to pass the configured Miner policy"
```

It requests exactly `0.0001 ETH`. It never fabricates an `ALLOW`; a real
`REVIEW`, `BLOCK`, or integration failure exits without broadcasting.

## Deployment

Deploy as a Node.js Next.js application (for example, Vercel), add the variables
from `.env.example` as encrypted runtime secrets, and do not expose them to
preview logs or the client bundle. Use a dedicated funded burner with a strict
operational balance. Run the quality gate before deployment and smoke-check
`/api/health` afterward. The current process-local status counters are useful
for a single demo instance, not horizontally scaled production telemetry.

## Troubleshooting

| Symptom | Safe outcome / action |
| --- | --- |
| Configuration incomplete | `/api/health` reports `configured: false`; set missing runtime variables |
| Miner unavailable or timed out | Action is held; verify the exact endpoint and upstream health |
| x402 payment failed | Action is held; verify USDC balance, asset, cap, RPC, and organizer requirements |
| Invalid Miner payload | Action is held; reconcile the real response adapter without inventing fields |
| `INSUFFICIENT_GAS` | No success is reported; fund the burner with Base Sepolia ETH |
| `RPC_FAILURE` / `TX_REVERTED` | No success is reported; inspect server logs and BaseScan |
| Decision is `REVIEW` | Inspect missing confidence/signals or conflict; no payment is executed |

## Security and compliance notes

- Evidence is untrusted, length-limited text and is never allowed to alter the
  deterministic policy. Image upload is intentionally not enabled.
- Raw evidence and private keys are excluded from structured server logs.
- `.env.local` and all `.env.*` files except `.env.example` are ignored by Git.
- The executor validates chain ID 84532, recipient, amount, balance, gas, and
  confirmed receipt. It never creates a local/fake transaction hash.
- Base Sepolia is testnet-only and has no intended real economic value.
- ProofPay provides a deterministic safety gate, not legal, compliance, fraud,
  or financial advice. Production use would require durable idempotency, rate
  limiting, access control, privacy retention policy, monitoring, and review of
  jurisdiction-specific obligations.
- The required Next.js 14 dependency line has current high-severity advisories.
  `npm audit` offers only a breaking Next.js 16 upgrade. This app does not use
  rewrites, middleware, remote image optimization, or Server Actions, but a
  framework migration and renewed security review remain required before a
  production launch.

## Verification boundary

Code, tests, and CI can prove the decision invariant and fail-closed behavior,
but they cannot prove a live funded-wallet result without runtime secrets and
funds. See `docs/LIVE_VERIFICATION.md` for the remaining operator checklist and
`docs/TEST_MATRIX.md` for the audited coverage.
