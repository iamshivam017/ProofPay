# Live testnet verification

Project status remains **Hackathon-ready code complete — live testnet
verification pending** until every item below is captured with real runtime
dependencies. Never paste a private key into an issue, commit, screenshot, or
chat transcript.

## Prerequisites

- Create `.env.local` from `.env.example`.
- Use a dedicated low-balance Base Sepolia burner, not a personal wallet.
- Fund it with enough Base Sepolia USDC for x402 and ETH for value plus gas.
- Set the exact organizer-confirmed live Telegraph endpoint.
- Confirm `.env.local` remains ignored with `git status --ignored`.

## Required proof run

1. Start the app with `npm run dev`.
2. Confirm `GET /api/health` returns `configured: true` and
   `network: "base-sepolia"` without secret values.
3. Submit authentic evidence expected to receive a real `ALLOW`, or run:

   ```bash
   npm run demo:payment -- 0xYourRecipient "Your genuine evidence text"
   ```

4. Capture the Decision Ticket request ID, timestamp, Miner identity/intent,
   risk/confidence, latency, x402 settlement reference, and downstream hash.
   Note any real field the Miner does not supply; never manufacture it.
5. Open `https://sepolia.basescan.org/tx/<hash>` and confirm chain Base Sepolia
   and status `Success`.
6. Submit a real suspicious or incomplete case that produces `BLOCK` or
   `REVIEW`.
7. Confirm the ticket reports `payment.executed: false`, no downstream hash,
   and `$0 moved`. Compare burner nonce/history if an independent check is
   needed.
8. Inspect browser payloads/client bundles and server logs to confirm the
   private key and sensitive evidence are absent.

## Evidence record

Record only non-secret proof:

| Check | Result |
| --- | --- |
| Live Telegraph/x402 completed | Pending |
| Real ALLOW decision | Pending |
| Base Sepolia transaction hash | Pending |
| BaseScan status `Success` | Pending |
| Real non-ALLOW produced no transaction | Pending |
| No private key exposed | Pending |

If any dependency fails, retain the real held/error Decision Ticket. A failure
is not a successful verification and must never be replaced with fixture data.
