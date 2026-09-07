import type { MinerSignal, MinerSignalStatus } from "../policy/types";

const SIGNAL_STATUSES: ReadonlySet<MinerSignalStatus> = new Set([
  "OK",
  "MISSING",
  "UNREACHABLE",
  "TIMEOUT",
  "X402_FAILURE",
  "INVALID",
]);

export interface MinerNormalizationResult {
  signals: MinerSignal[];
  error?: { code: "INVALID_MINER_RESPONSE"; message: string };
}

/** Normalizes only the documented signal envelope; absent fields are never inferred. */
export function normalizeRealMinerSignals(data: unknown): MinerNormalizationResult {
  const candidateSignals = Array.isArray(data)
    ? data
    : data && typeof data === "object" && Array.isArray((data as Record<string, unknown>).signals)
      ? (data as Record<string, unknown>).signals as unknown[]
      : null;

  if (
    !candidateSignals ||
    candidateSignals.length === 0 ||
    !candidateSignals.every(isNormalizedMinerSignal)
  ) {
    return {
      signals: [missingRealSignal(data)],
      error: {
        code: "INVALID_MINER_RESPONSE",
        message: "Miner response was incomplete or malformed — action held for safety.",
      },
    };
  }
  return { signals: candidateSignals };
}

export function extractMinerIdentity(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const value = data as Record<string, unknown>;
  for (const key of ["miner", "minerId", "miner_id", "subnet", "subnetId"]) {
    if (typeof value[key] === "string" || typeof value[key] === "number") return String(value[key]);
  }
  return null;
}

function isNormalizedMinerSignal(value: unknown): value is MinerSignal {
  if (!value || typeof value !== "object") return false;
  const signal = value as Record<string, unknown>;
  if (
    !nonEmpty(signal.id) ||
    !nonEmpty(signal.minerId) ||
    !nonEmpty(signal.kind) ||
    typeof signal.required !== "boolean" ||
    typeof signal.status !== "string" ||
    !SIGNAL_STATUSES.has(signal.status as MinerSignalStatus)
  ) return false;

  if (signal.status !== "OK") return signal.risk === null && signal.confidence === null;
  return validScore(signal.risk) && (signal.confidence === null || validScore(signal.confidence));
}

function missingRealSignal(data: unknown): MinerSignal {
  return {
    id: "telegraph-primary-signal",
    minerId: extractMinerIdentity(data) ?? "unavailable",
    kind: "normalized-authenticity-risk",
    required: true,
    status: "MISSING",
    risk: null,
    confidence: null,
  };
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validScore(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}
