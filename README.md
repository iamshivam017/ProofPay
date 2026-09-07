# ProofPay

> No verified intelligence, no payment.

ProofPay is an authenticity-gated agentic payment gateway for the Telegraph
Protocol Hackathon, Track 3. It sends evidence to a live Telegraph Miner through
x402 and will eventually allow a Base Sepolia transfer only when a deterministic
policy permits it.

## Current status: Slices 1–2

Slice 1 provides the server-side Telegraph x402 client and a test API route. It:

- sends evidence to the configured Telegraph endpoint;
- handles the standard x402 v2 `402` challenge;
- accepts only the `exact` scheme on Base Sepolia (`eip155:84532`);
- verifies that the requested asset is the configured Base Sepolia USDC;
- enforces a hard payment cap and checks the burner wallet's USDC balance;
- signs the EIP-3009 authorization with a server-only viem account;
- captures the real `PAYMENT-RESPONSE` settlement proof and transaction hash;
- fails closed on malformed challenges, timeouts, insufficient funds, payment
  failures, invalid JSON, or unavailable Miners.

No Miner output, confidence value, x402 proof, or transaction hash is mocked.

## Prerequisites

- Node.js 20+
- A full paid Telegraph Engine/Miner endpoint supplied by the organizers
- A dedicated Base Sepolia burner wallet with enough Base Sepolia USDC
- A Base Sepolia RPC endpoint

Never use a personal or mainnet wallet.

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Configure these server-only variables in `.env.local`:

| Variable | Purpose |
| --- | --- |
| `TELEGRAPH_ENGINE_URL` | Complete paid POST endpoint |
| `EXECUTOR_PRIVATE_KEY` | Dedicated Base Sepolia burner-wallet private key |
| `BASE_SEPOLIA_RPC_URL` | RPC used for the pre-signature USDC balance check |
| `BASE_SEPOLIA_USDC_ADDRESS` | Trusted Base Sepolia USDC contract |
| `X402_MAX_PAYMENT_ATOMIC` | Maximum permitted charge in 6-decimal USDC units |
| `TELEGRAPH_REQUEST_TIMEOUT_MS` | Timeout for the complete x402 exchange |

Do not prefix any secret with `NEXT_PUBLIC_` and never commit `.env.local`.

## Exercise Slice 1

```bash
curl -X POST http://localhost:3000/api/verify \
  -H "Content-Type: application/json" \
  -d '{
    "evidence": "Invoice INV-001 requests payment for completed delivery.",
    "intent": "FRAUD_DETECTION"
  }'
```

A valid proof run must return:

- real Telegraph Miner JSON under `data`;
- the accepted payment requirement;
- a successful settlement response;
- a real Base Sepolia transaction hash under `payment.transactionHash`.

Verify the transaction independently on BaseScan. The server log event is
`proofpay.telegraph.completed`. Every error response includes `decision: BLOCK`.

## Quality gate

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

GitHub Actions runs the same checks on pushes and pull requests.

## Protocol compatibility

The implementation follows x402 v2's `PAYMENT-REQUIRED`, `PAYMENT-SIGNATURE`,
and `PAYMENT-RESPONSE` headers. It intentionally does not send a separate ERC-20
transfer before retrying because the standard `exact` EVM scheme uses a signed
authorization that the facilitator settles. Header names are centralized in
`X402_HEADERS` so a confirmed Telegraph-specific transport can be adopted with a
small, auditable change.

## Scope boundaries

Not implemented through Slice 2:

- downstream Base Sepolia ProofPay transfer;
- evidence-upload UI and Decision Ticket;
- authentication or database persistence.

Those belong to subsequent vertical slices and must not be simulated.

## Slice 2: deterministic policy engine

The pure TypeScript policy engine consumes normalized Miner signals and returns
exactly one `ALLOW`, `REVIEW`, or `BLOCK` verdict. It does not call an LLM or any
external service.

Policy defaults:

| Rule | Threshold |
| --- | --- |
| BLOCK risk | `risk >= 0.85` |
| ALLOW risk | every required risk `<= 0.35` |
| ALLOW confidence | every required confidence `>= 0.80` |
| Material conflict | risk range `>= 0.30` |

Invalid evidence or malformed score input BLOCKS. Missing required signals,
unavailable confidence, Miner/x402 availability failures, uncertain scores, and
material conflicts REVIEW. ALLOW has a single return path and requires at least
one explicitly required, successful signal.

The existing paid `/api/verify` route sends only its real Telegraph response to
the policy adapter and logs `proofpay.policy.evaluated`. If the response does not
contain normalized signals, the adapter records a required `MISSING` signal and
the engine returns REVIEW; it never invents a score.

The repository intentionally does not persist raw Miner evidence or runtime
logs. No real response artifact is currently checked in, so the integration is
exercised through the live paid route. A submission proof run should retain the
request ID, timestamp, Miner identity/intent, latency, raw response, risk and
confidence values, and x402 settlement reference in an appropriately redacted
demo log or Decision Ticket.
