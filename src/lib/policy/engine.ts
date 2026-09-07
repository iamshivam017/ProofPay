import type { MinerSignal, MinerSignalStatus, PolicyDecision } from "./types";

// BLOCK rules: the boundary itself blocks to remain fail-closed.
export const BLOCK_RISK_THRESHOLD = 0.85;

// ALLOW rules: every usable signal must be clean, and every required signal
// must meet the minimum confidence.
export const ALLOW_MAX_RISK = 0.35;
export const ALLOW_MIN_CONFIDENCE = 0.8;

// REVIEW when otherwise usable signals differ by this amount or more.
export const MATERIAL_CONFLICT_DELTA = 0.3;

const KNOWN_STATUSES: ReadonlySet<MinerSignalStatus> = new Set([
  "OK",
  "MISSING",
  "UNREACHABLE",
  "TIMEOUT",
  "X402_FAILURE",
  "INVALID",
]);

const OPERATIONAL_FAILURES: ReadonlySet<MinerSignalStatus> = new Set([
  "UNREACHABLE",
  "TIMEOUT",
  "X402_FAILURE",
]);

/**
 * Evaluates normalized Miner signals using pure, ordered rules.
 *
 * Rule precedence is deliberate: invalid input and decisive high risk BLOCK;
 * incomplete, unavailable, uncertain, or conflicting evidence REVIEW; only a
 * complete set of clean and confident required signals can ALLOW.
 */
export function evaluatePolicy(signals: MinerSignal[]): PolicyDecision {
  // No evidence can never authorize a payment.
  if (!Array.isArray(signals) || signals.length === 0) {
    return decision("REVIEW", "No Miner signals were provided", 0, []);
  }

  // Malformed scores or identifiers are input-validation failures and BLOCK.
  if (signals.some(isStructurallyInvalid)) {
    return decision("BLOCK", "Miner signal input validation failed", 0, signals);
  }

  // An explicit INVALID status means the submitted evidence failed validation.
  if (signals.some((signal) => signal.status === "INVALID")) {
    return decision("BLOCK", "Evidence is invalid", aggregateConfidence(signals), signals);
  }

  // Unknown states are never interpreted as success.
  if (signals.some((signal) => !KNOWN_STATUSES.has(signal.status))) {
    return decision("REVIEW", "A Miner signal has an unknown state", 0, signals);
  }

  const required = signals.filter((signal) => signal.required);
  const requiredUsable = required.filter((signal) => signal.status === "OK");

  // A decisive high-risk required signal always wins, including at the boundary.
  if (requiredUsable.some((signal) => signal.risk! >= BLOCK_RISK_THRESHOLD)) {
    return decision(
      "BLOCK",
      `A Miner risk score met or exceeded ${BLOCK_RISK_THRESHOLD}`,
      aggregateConfidence(signals),
      signals,
    );
  }

  // Transport/payment failures mean the intelligence is unavailable.
  if (required.some((signal) => OPERATIONAL_FAILURES.has(signal.status))) {
    return decision(
      "REVIEW",
      "A Miner was unreachable, timed out, or its x402 payment failed",
      aggregateConfidence(signals),
      signals,
    );
  }

  // At least one explicitly required check is necessary; avoid vacuous ALLOW.
  if (required.length === 0) {
    return decision("REVIEW", "Default fail-closed: no required Miner signal was declared", 0, signals);
  }

  // A required placeholder marked MISSING or otherwise non-OK cannot ALLOW.
  if (required.some((signal) => signal.status !== "OK")) {
    return decision(
      "REVIEW",
      "A required Miner signal is missing",
      aggregateConfidence(signals),
      signals,
    );
  }

  // Confidence must be supplied for every signal that participates in policy.
  if (requiredUsable.some((signal) => !scoreIsValid(signal.confidence))) {
    return decision(
      "REVIEW",
      "Confidence is unavailable for a Miner signal",
      aggregateConfidence(signals),
      signals,
    );
  }

  // Material disagreement is evaluated before the ordinary uncertain band.
  const risks = requiredUsable.map((signal) => signal.risk!);
  if (risks.length > 1 && Math.max(...risks) - Math.min(...risks) >= MATERIAL_CONFLICT_DELTA) {
    return decision(
      "REVIEW",
      `Miner signals materially conflict by at least ${MATERIAL_CONFLICT_DELTA}`,
      aggregateConfidence(signals),
      signals,
    );
  }

  // Use the minimum required confidence, not an average that could hide a weak check.
  const requiredConfidence = Math.min(...required.map((signal) => signal.confidence!));
  const meetsEveryAllowCondition =
    requiredUsable.length === required.length &&
    requiredUsable.every((signal) => signal.risk! <= ALLOW_MAX_RISK) &&
    requiredUsable.every((signal) => signal.confidence! >= ALLOW_MIN_CONFIDENCE);

  if (meetsEveryAllowCondition) {
    // This is the only ALLOW return path in the module.
    return decision(
      "ALLOW",
      "All required Miner signals are present, consistent, clean, and confident",
      requiredConfidence,
      signals,
    );
  }

  // Final fail-closed rule: ambiguous middle-band states can never fall through
  // to ALLOW merely because they did not match a named REVIEW trigger.
  return decision(
    "REVIEW",
    "Default fail-closed: required signals did not satisfy every ALLOW condition",
    requiredConfidence,
    signals,
  );
}

function isStructurallyInvalid(signal: MinerSignal): boolean {
  if (!signal || typeof signal !== "object") return true;
  if (!nonEmpty(signal.id) || !nonEmpty(signal.minerId) || !nonEmpty(signal.kind)) return true;
  if (typeof signal.required !== "boolean" || typeof signal.status !== "string") return true;

  // Missing/failed signals must retain null scores rather than fabricated defaults.
  if (signal.status !== "OK") {
    return signal.risk !== null || signal.confidence !== null;
  }

  // An unparseable risk is invalid input and BLOCKS. Confidence is checked
  // separately because unavailable/unparseable confidence must REVIEW.
  return !scoreIsValid(signal.risk);
}

function scoreIsValid(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function nonEmpty(value: string): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/** Conservative aggregate: the weakest available required confidence. */
function aggregateConfidence(signals: MinerSignal[]): number {
  const requiredAvailable = signals
    .filter((signal) => signal.required && signal.status === "OK" && scoreIsValid(signal.confidence))
    .map((signal) => signal.confidence!);

  return requiredAvailable.length > 0 ? Math.min(...requiredAvailable) : 0;
}

function decision(
  verdict: PolicyDecision["verdict"],
  reason: string,
  confidence: number,
  signals: MinerSignal[],
): PolicyDecision {
  return { verdict, reason, confidence, signals };
}
