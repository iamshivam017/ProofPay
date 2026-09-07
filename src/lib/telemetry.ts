import "server-only";

export type TelemetryEvent =
  | "VERIFICATION_ATTEMPT"
  | "ALLOW"
  | "REVIEW"
  | "BLOCK"
  | "ERROR"
  | "MINER_TIMEOUT"
  | "X402_FAILURE"
  | "PAYMENT_SUCCESS"
  | "PAYMENT_FAILURE";

export interface TelemetrySnapshot {
  totalVerifications: number;
  allows: number;
  reviews: number;
  blocks: number;
  errors: number;
  minerTimeouts: number;
  x402Failures: number;
  successfulPayments: number;
  failedPayments: number;
  averageLatencyMs: number;
  totalX402SpendAtomic: string;
  lastUpdatedAt: string | null;
  storage: "process-local";
}

const counters = {
  totalVerifications: 0,
  allows: 0,
  reviews: 0,
  blocks: 0,
  errors: 0,
  minerTimeouts: 0,
  x402Failures: 0,
  successfulPayments: 0,
  failedPayments: 0,
  totalLatencyMs: 0,
  completedWithLatency: 0,
  totalX402SpendAtomic: 0n,
  lastUpdatedAt: null as string | null,
};

export function recordTelemetry(
  event: TelemetryEvent,
  details: { latencyMs?: number; x402SpendAtomic?: bigint } = {},
): void {
  if (event === "VERIFICATION_ATTEMPT") counters.totalVerifications += 1;
  if (event === "ALLOW") counters.allows += 1;
  if (event === "REVIEW") counters.reviews += 1;
  if (event === "BLOCK") counters.blocks += 1;
  if (event === "ERROR") counters.errors += 1;
  if (event === "MINER_TIMEOUT") counters.minerTimeouts += 1;
  if (event === "X402_FAILURE") counters.x402Failures += 1;
  if (event === "PAYMENT_SUCCESS") counters.successfulPayments += 1;
  if (event === "PAYMENT_FAILURE") counters.failedPayments += 1;

  if (typeof details.latencyMs === "number" && Number.isFinite(details.latencyMs)) {
    counters.totalLatencyMs += Math.max(0, details.latencyMs);
    counters.completedWithLatency += 1;
  }
  if (typeof details.x402SpendAtomic === "bigint" && details.x402SpendAtomic >= 0n) {
    counters.totalX402SpendAtomic += details.x402SpendAtomic;
  }
  counters.lastUpdatedAt = new Date().toISOString();

  console.info("proofpay.telemetry", {
    event,
    timestamp: counters.lastUpdatedAt,
    latencyMs: details.latencyMs ?? null,
    x402SpendAtomic: details.x402SpendAtomic?.toString() ?? null,
  });
}

export function getTelemetrySnapshot(): TelemetrySnapshot {
  return {
    totalVerifications: counters.totalVerifications,
    allows: counters.allows,
    reviews: counters.reviews,
    blocks: counters.blocks,
    errors: counters.errors,
    minerTimeouts: counters.minerTimeouts,
    x402Failures: counters.x402Failures,
    successfulPayments: counters.successfulPayments,
    failedPayments: counters.failedPayments,
    averageLatencyMs:
      counters.completedWithLatency === 0
        ? 0
        : Math.round(counters.totalLatencyMs / counters.completedWithLatency),
    totalX402SpendAtomic: counters.totalX402SpendAtomic.toString(),
    lastUpdatedAt: counters.lastUpdatedAt,
    storage: "process-local",
  };
}
