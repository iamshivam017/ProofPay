export type PolicyVerdict = "ALLOW" | "REVIEW" | "BLOCK";

export type MinerSignalStatus =
  | "OK"
  | "MISSING"
  | "UNREACHABLE"
  | "TIMEOUT"
  | "X402_FAILURE"
  | "INVALID";

/**
 * A normalized Miner signal. All scores use a 0..1 scale, and risk always
 * means "probability/strength of synthetic, deepfake, fraud, or invalid data".
 * Higher risk is worse. Adapters must not invent or default either score.
 */
export interface MinerSignal {
  id: string;
  minerId: string;
  kind: string;
  required: boolean;
  status: MinerSignalStatus;
  risk: number | null;
  confidence: number | null;
}

/** A validated evidence envelope ready for deterministic policy evaluation. */
export interface NormalizedEvidence {
  id: string;
  valid: boolean;
  signals: MinerSignal[];
  validationErrors: string[];
}

export interface PolicyDecision {
  verdict: PolicyVerdict;
  reason: string;
  confidence: number;
  signals: MinerSignal[];
}
