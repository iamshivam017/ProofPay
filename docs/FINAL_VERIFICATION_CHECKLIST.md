# ProofPay final verification checklist

Audit status: **Hackathon-ready code complete — live testnet verification pending.**

Audited on 2026-09-07 against branch `buildathon-production`. A conditional code path is not treated as a verified live transaction.

| Mark | Meaning |
|---|---|
| ✅ | Verified from source, automated checks, runtime, GitHub, or a retained artifact |
| 🟡 | Partially verified or previously user-confirmed, but required durable/live evidence is absent |
| ⬜ | Pending or not independently verified |
| ➖ | Not applicable to the current product scope |

## Slice 1 — Telegraph integration proof

| # | Check | Status | Evidence / remaining proof |
|---|---|---|---|
| 1.1 | Real HTTP call to a live Telegraph Miner | 🟡 | Previously user-confirmed; production uses real `fetch`, but no retained live response artifact exists. |
| 1.2 | x402 402 → pay → retry confirmed | 🟡 | Previously user-confirmed; implementation/tests exist, but no retained live payment receipt exists. |
| 1.3 | Raw Miner response in terminal/logs | ⬜ | Capture a privacy-reviewed live artifact during Phase A; do not enable unrestricted evidence logging. |
| 1.4 | Miner name/intent captured | ✅ | Normalization and Decision Ticket retain identity/intent when returned. |
| 1.5 | Confidence/risk captured | ✅ | Normalized signals carry both into policy and ticket output. |
| 1.6 | Latency measured/logged | ✅ | The route records `latencyMs` and structured telemetry. |
| 1.7 | Request ID/x402 reference captured | ✅ | Request ID is always generated; x402 references are retained when supplied. |
| 1.8 | Timestamp captured | ✅ | Every Decision Ticket has an ISO timestamp. |
| 1.9 | Miner unavailable fails safely | ✅ | Failure maps to a held decision without invented output. |
| 1.10 | Timeout → `MINER_TIMEOUT` | ✅ | Timeout behavior and tests exist. |
| 1.11 | x402 fail → `X402_PAYMENT_FAILURE` | ✅ | Handshake failures use the canonical fail-closed error. |
| 1.12 | Endpoint comes from config | ✅ | Target URL is server environment configuration. |
| 1.13 | x402 key is server-only | ✅ | Key access is confined to server modules/environment. |
| 1.14 | No production mock response | ✅ | Synthetic fixtures are test-only. |

## Slice 2 — deterministic policy engine

| # | Check | Status | Evidence / remaining proof |
|---|---|---|---|
| 2.1 | Pure TypeScript; no LLM/I/O | ✅ | Engine is synchronous deterministic logic. |
| 2.2 | Deterministic output | ✅ | No time, randomness, I/O, or external mutable state. |
| 2.3 | Invalid evidence/risk ≥ 0.85 → BLOCK | ✅ | Rule and boundary tests pass. |
| 2.4 | Missing required signal → REVIEW | ✅ | Rule and tests pass. |
| 2.5 | Miner timeout → REVIEW | ✅ | Failure-state tests pass. |
| 2.6 | x402 failure → REVIEW | ✅ | Failure-state tests pass. |
| 2.7 | Missing confidence → REVIEW | ✅ | Missing/unparseable confidence cannot ALLOW. |
| 2.8 | Conflict ≥ 0.30 → REVIEW | ✅ | Pairwise boundary tests pass. |
| 2.9 | ALLOW requires all conditions | ✅ | ALLOW is a conjunctive final gate. |
| 2.10 | Default → REVIEW | ✅ | Final branch is fail-closed. |
| 2.11 | High-risk BLOCK test | ✅ | Covered. |
| 2.12 | Invalid-evidence BLOCK test | ✅ | Covered. |
| 2.13 | All-pass ALLOW test | ✅ | Covered. |
| 2.14 | REVIEW trigger tests | ✅ | Missing, timeout/failure, conflict, and missing confidence covered. |
| 2.15 | Default REVIEW test | ✅ | Ambiguous middle band covered. |
| 2.16 | Real Slice 1 response through engine | 🟡 | Live route is wired and prior run was user-confirmed; no retained Miner artifact can be replayed. |
| 2.17 | Locked constants exact | ✅ | `0.85`, `0.35`, `0.80`, `0.30`. |
| 2.18 | No Slice 3/UI imports | ✅ | Policy stays independent. |

## Slice 3 — Base Sepolia executor

| # | Check | Status | Evidence / remaining proof |
|---|---|---|---|
| 3.1 | Exact `ALLOW` gate | ✅ | Exact verdict is checked before executor invocation. |
| 3.2 | Non-ALLOW/unknown executes nothing | ✅ | Unit tests cover BLOCK, REVIEW, and runtime-unknown verdicts. |
| 3.3 | Key absent from frontend/Git | ✅ | Security tests and repository scan pass. |
| 3.4 | `.env.local` ignored | ✅ | `.env.*` ignored; `.env.example` allowed. |
| 3.5 | Revert returns safe error | ✅ | Canonical code is `TX_REVERTED`. |
| 3.6 | Network/RPC error is safe | ✅ | Canonical code is `RPC_FAILURE`. |
| 3.7 | Insufficient gas is safe | ✅ | Canonical code is `INSUFFICIENT_GAS`. |
| 3.8 | Missing wallet config is safe | ✅ | Canonical code is `MISSING_CONFIG`. |
| 3.9 | No fake transaction hash | ✅ | Hash originates only from viem submission. |
| 3.10 | No UI imports | ✅ | Web3 modules remain backend-only. |
| 3.11 | Burner funded with test ETH | ⬜ | Wallet-owner action and explorer proof required. |
| 3.12 | Burner funded with test USDC | ⬜ | Wallet-owner action and token-balance proof required. |
| 3.13 | Local `.env.local` has key | ⬜ | File is absent in this workspace. |
| 3.14 | Dev server starts | ✅ | Supervised Next.js preview starts successfully. |
| 3.15 | Real ALLOW transfer/hash | ⬜ | Critical live blocker; intentionally open. |
| 3.16 | Transaction succeeds on BaseScan | ⬜ | Critical live blocker; intentionally open. |
| 3.17 | Real BLOCK/REVIEW has no transfer | ⬜ | Critical live blocker; intentionally open. |
| 3.18 | Live executor-not-called proof | ⬜ | Capture a structured log for the request ID. |
| 3.19 | ALLOW and BaseScan screenshots | ⬜ | No live screenshots exist. |
| 3.20 | Non-ALLOW screenshot | ⬜ | No live screenshot exists. |

## Slice 4 — UI

| # | Check | Status | Evidence / remaining proof |
|---|---|---|---|
| 4.1 | Payment form | ✅ | Amount, recipient, reason, and evidence implemented. |
| 4.2 | Terminal Verification Chamber | ✅ | Loading terminal and animation implemented. |
| 4.3 | Real granular backend stages | 🟡 | States are truthful but coarse/client-timed; API does not stream Miner/x402 milestones. |
| 4.4 | Large color-coded verdict | ✅ | ALLOW/REVIEW/BLOCK/error presentations implemented. |
| 4.5 | Reason shown | ✅ | Returned reason rendered. |
| 4.6 | Signals/confidence shown | ✅ | Returned signals rendered without substitution. |
| 4.7 | Hash and BaseScan link | ✅ | Receipt conditionally renders only a returned real hash/link. |
| 4.8 | Miner identities/scores | ✅ | Ticket fields rendered when available. |
| 4.9 | x402 reference | ✅ | Conditionally rendered when available. |
| 4.10 | Decision Ticket | ✅ | Structured ticket implemented. |
| 4.11 | Miner failure safety message | ✅ | Held-for-safety message implemented. |
| 4.12 | x402 safe failure | ✅ | Maps to held state without fake success. |
| 4.13 | BLOCK shows `$0 moved` | ✅ | Dramatic red state implemented. |
| 4.14 | ALLOW shows real hash | 🟡 | Rendering is correct; live ALLOW is not verified here. |
| 4.15 | REVIEW state/reason | ✅ | Yellow held state implemented. |
| 4.16 | No fake Miner scores | ✅ | Only API ticket data is rendered. |
| 4.17 | No fake hashes | ✅ | Only executor output is rendered. |
| 4.18 | Dark/monospace styling | ✅ | Implemented. |
| 4.19 | Testnet badge | ✅ | Visible disclaimer implemented. |
| 4.20 | No scope-creep navigation | ✅ | No auth/settings/admin UI. |

## Slice 5 — reliability and demo polish

| # | Check | Status | Evidence / remaining proof |
|---|---|---|---|
| 5.1 | Environment validation | ✅ | Missing/invalid/unsafe config distinguished without values. |
| 5.2 | Safe `/api/health` | ✅ | Only safe health metadata returned. |
| 5.3 | Telegraph failure resilience | ✅ | Bounded timeout/retry and typed errors covered. |
| 5.4 | Policy fails closed | ✅ | Tests/invariants pass. |
| 5.5 | Executor only on ALLOW | ✅ | Gate/invariant tests pass. |
| 5.6 | Zod API validation | ✅ | Body validated before external work. |
| 5.7 | Structured API errors | ✅ | Safe Decision Ticket-shaped errors returned. |
| 5.8 | File upload validation | ➖ | File upload is not implemented; it was optional. Text evidence is validated. |
| 5.9 | Evidence length bounded | ✅ | Schema limit enforced. |
| 5.10 | Request ID always generated | ✅ | Created before validation/external work. |
| 5.11 | No keys in browser/Git/logs | ✅ | Static tests/repository scan pass. |
| 5.12 | No production Miner mocks | ✅ | Fixtures remain test-only. |
| 5.13 | No fake telemetry | ✅ | Counters update from real route events only. |
| 5.14 | Real event telemetry | 🟡 | Attempts, decisions, failures, payments, spend, latency tracked; unique sessions intentionally omitted. |
| 5.15 | Safe user errors | ✅ | No stack traces/secrets returned. |
| 5.16 | Build passes | ✅ | `npm run build`. |
| 5.17 | Typecheck passes | ✅ | `npm run typecheck`. |
| 5.18 | Tests pass | ✅ | 46 automated tests. |
| 5.19 | CI passes | ✅ | Latest GitHub Actions quality-gates run passed. |
| 5.20 | README complete | ✅ | Architecture/setup/Telegraph/safety/demo documented. |
| 5.21 | Safe `.env.example` | ✅ | Placeholder-only template exists. |
| 5.22 | `.env.local` ignored | ✅ | Ignore rule verified. |

## Phase A — live verification

| # | Check | Status | Evidence / remaining proof |
|---|---|---|---|
| A.1 | MetaMask on Base Sepolia | ⬜ | Wallet-owner check required; executor itself is server-side. |
| A.2 | Burner address copied | ⬜ | Wallet-owner action. |
| A.3 | Test ETH funded | ⬜ | Fund and capture explorer balance. |
| A.4 | Test USDC funded | ⬜ | Fund and capture token balance. |
| A.5 | Balance on BaseScan | ⬜ | Explorer evidence required. |
| A.6 | `.env.local` created | ⬜ | Absent here; create locally without sharing value. |
| A.7 | `.env.local` not in Git | ✅ | Absent from tracked files and ignored. |
| A.8 | Backend starts | ✅ | Supervised preview healthy. |
| A.9 | Real ALLOW executed | ⬜ | Critical live blocker. |
| A.10 | Real hash produced | ⬜ | Critical live blocker. |
| A.11 | BaseScan Success | ⬜ | Critical live blocker. |
| A.12 | Real suspicious case | ⬜ | Requires live Miner execution. |
| A.13 | Suspicious case has no hash | ⬜ | Retain ticket/log evidence. |
| A.14 | Executor-not-called proof | ⬜ | Retain structured log for same request ID. |
| A.15 | Live screenshots | ⬜ | No Phase A screenshots exist. |

## Phase B — demo and assets

| # | Check | Status | Evidence / remaining proof |
|---|---|---|---|
| B.1 | Backup demo video | ⬜ | No video artifact. |
| B.2 | Video: suspicious → BLOCK | ⬜ | Requires live capture. |
| B.3 | Video: legitimate → ALLOW | ⬜ | Depends on Phase A. |
| B.4 | Video: Decision Ticket | ⬜ | Depends on live capture. |
| B.5 | Genuine usage only | ⬜ | Include only if genuine data exists. |
| B.6 | Recording quality checked | ⬜ | Recording unavailable. |
| B.7 | BLOCK screenshot | ⬜ | Not present. |
| B.8 | ALLOW screenshot | ⬜ | Depends on Phase A. |
| B.9 | BaseScan screenshot | ⬜ | Depends on Phase A. |
| B.10 | Decision Ticket screenshot | ⬜ | Not present. |
| B.11 | Architecture diagram | ✅ | See `docs/ARCHITECTURE.md`. |

## Phase C — marketing and submission

| # | Check | Status | Evidence / remaining proof |
|---|---|---|---|
| C.1 | App deployed | ⬜ | No production deployment evidence. |
| C.2 | Live URL tested end-to-end | ⬜ | Requires deployment and live config. |
| C.3 | GitHub repository pushed | ✅ | `iamshivam017/ProofPay`, `buildathon-production`, updated through GitHub integration. |
| C.4 | `.env.local` absent from Git | ✅ | Repository scan/ignore verified. |
| C.5 | README submission content | ✅ | Required material is present. |
| C.6 | README screenshots | ⬜ | Wait for genuine live captures. |
| C.7 | X technical thread | ⬜ | No evidence. |
| C.8 | X tags `@Telegraphprotoc` | ⬜ | Pending. |
| C.9 | X media BLOCK → ALLOW | ⬜ | Depends on real assets. |
| C.10 | Discord live URL | ⬜ | Pending deployment/community action. |
| C.11 | Discord feedback request | ⬜ | Pending. |
| C.12 | Genuine testers | ⬜ | No evidence; never fabricate. |
| C.13 | Submission form | ⬜ | Depends on remaining assets. |
| C.14 | Submitted before deadline | ⬜ | Explicitly reserved for later verification. |
| C.15 | Submission confirmation | ⬜ | Pending. |

## Status summary

| Phase | Total | Verified | Partial | Pending | N/A |
|---|---:|---:|---:|---:|---:|
| Slice 1 | 14 | 11 | 2 | 1 | 0 |
| Slice 2 | 18 | 17 | 1 | 0 | 0 |
| Slice 3 | 20 | 11 | 0 | 9 | 0 |
| Slice 4 | 20 | 18 | 2 | 0 | 0 |
| Slice 5 | 22 | 20 | 1 | 0 | 1 |
| Phase A | 15 | 2 | 0 | 13 | 0 |
| Phase B | 11 | 1 | 0 | 10 | 0 |
| Phase C | 15 | 3 | 0 | 12 | 0 |
| **Total** | **135** | **83** | **6** | **45** | **1** |

## Critical blockers

- `3.15`, `3.16`, `3.17`: prove one real ALLOW transfer and one real non-ALLOW hold.
- `A.9`–`A.11`: retain the transaction hash and successful BaseScan evidence.
- `C.14`: submit before the deadline and retain confirmation.

Phase A is mandatory. Run it with a dedicated funded burner wallet and local server-only secrets, then capture artifacts keyed by the Decision Ticket request ID. Until then, the correct release statement remains: **Hackathon-ready code complete — live testnet verification pending.**
