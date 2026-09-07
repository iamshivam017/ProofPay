# Slice 5 security audit

Audit date: 2026-09-07

## Verified in code and tests

- Sensitive modules are marked server-only and no credential is returned by
  the health, status, verification, or UI contracts.
- `.env.local` and secret-bearing `.env.*` files are ignored; `.env.example`
  contains placeholders only.
- The x402 client accepts only exact Base Sepolia settlement using the trusted
  USDC address and a configured charge cap.
- The downstream executor confirms chain ID 84532 and a successful receipt.
- The payment gate invokes its executor only for an exact `ALLOW` verdict.
- Invalid input, malformed Miner responses, Miner/x402 failures, unknown states,
  and payment failures cannot be reported as successful execution.
- Evidence length is bounded and raw evidence is excluded from structured logs.
- No simulated-success, fake-hash, dry-run-as-success, or fake telemetry path is
  present in production code.

## Dependency finding

`npm audit --omit=dev --audit-level=high` reports high-severity advisories on the
required Next.js 14 line and its internal PostCSS dependency. The automated fix
proposes Next.js 16.3.4, a breaking framework and React migration. Slice 5 does
not apply that migration because the hackathon stack explicitly requires
Next.js 14 and the instruction is to harden rather than rewrite working slices.

Current exposure is reduced because this repository has no Next.js rewrites,
middleware, remote image configuration, Server Actions, or custom server.
Deployment should still add request/body limits and edge rate limiting, and the
project must migrate to a supported patched framework line before being called
production-ready.

## Live verification boundary

No wallet secret or funded burner is available in this workspace. A real
Telegraph/x402 run, an `ALLOW` transfer confirmed on BaseScan, and a real
non-ALLOW run with no downstream transfer remain pending. See
`LIVE_VERIFICATION.md`.
