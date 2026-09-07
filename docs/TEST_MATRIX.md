# ProofPay test matrix

Synthetic fixtures below test local logic only. Live rows require actual
Telegraph and Base Sepolia dependencies and are never simulated in CI.

| Area | Test | Expected | Automated |
| --- | --- | --- | --- |
| Invalid input | POST-equivalent schema parse with malformed body | Reject before external call; `BLOCK` envelope | Yes |
| Unsupported intent | Non-`TEXT_AUTHENTICITY_CHECK` input | Explicit rejection; never `ALLOW` | Yes |
| Missing required signal | Required Miner signal is missing | `REVIEW` | Yes |
| Miner timeout/failure | Required signal timeout, unreachable, or x402 failure | `REVIEW` | Yes |
| Missing confidence | Required confidence is absent | `REVIEW` | Yes |
| High risk | Required risk `>= 0.85` | `BLOCK` | Yes |
| Conflict | Required risk delta `>= 0.30` | `REVIEW` | Yes |
| Full pass | All required checks clean and confident | `ALLOW` | Yes |
| Default | Ambiguous middle band | `REVIEW` | Yes |
| Payment gate | `ALLOW` | Executor invoked exactly once | Yes, injected executor |
| Payment gate | `REVIEW`, `BLOCK`, or runtime-unknown state | Executor never invoked | Yes |
| Executor input | Invalid recipient/zero value | `INVALID_INPUT`, no wallet call | Yes |
| Executor failure | RPC, revert, insufficient gas, missing config | Explicit safe error, no fake success | Yes, injected failure |
| Configuration | Missing, malformed, or unsafe values | Safe categorized error; no secret disclosure | Yes |
| API contract | Source-level orchestration invariant | Policy precedes gate; consistent fail-closed envelope | Yes |
| Production path | Simulated/dry-run markers | No simulated-success path | Yes |
| UI | Four views and zero-movement states | ALLOW/REVIEW/BLOCK/error rendered truthfully | Yes |
| Health/status | Safe metadata only | No secret/evidence fields | Yes |
| Live Miner | Real x402 request and settlement | Real Miner payload and settlement hash | Operator check |
| Live ALLOW | Real policy ALLOW | One successful Base Sepolia transfer/hash | Pending |
| Live non-ALLOW | Real `REVIEW` or `BLOCK` | No downstream transaction | Pending |

Run the complete automated quality gate:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```
