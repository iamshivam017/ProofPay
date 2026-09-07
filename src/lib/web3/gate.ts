import type { PolicyDecision } from "../policy/types";
import {
  executePayment,
  PaymentExecutionError,
  type PaymentFailureReason,
} from "./executor";

export type PaymentGateResult =
  | { status: "EXECUTED"; txHash: string }
  | { status: "BLOCKED"; reason: string }
  | { status: "REVIEW"; reason: string }
  | { status: "ERROR"; reason: PaymentFailureReason };

type PaymentExecutor = (
  recipient: string,
  amount: bigint,
) => Promise<{ txHash: string }>;

/** The production policy gate. Only its ALLOW branch can invoke executePayment. */
export async function executeIfAllowed(
  decision: PolicyDecision,
  recipient: string,
  amount: bigint,
): Promise<PaymentGateResult> {
  return executeIfAllowedUsing(decision, recipient, amount, executePayment);
}

/** @internal Exported only so invariant tests can prove non-ALLOW isolation. */
export async function executeIfAllowedUsing(
  decision: PolicyDecision,
  recipient: string,
  amount: bigint,
  paymentExecutor: PaymentExecutor,
): Promise<PaymentGateResult> {
  const audit = {
    timestamp: new Date().toISOString(),
    decision: readVerdict(decision),
    recipient,
    amount: amount.toString(),
  };

  if (!decision || decision.verdict === "BLOCK") {
    const result = { status: "BLOCKED", reason: decision?.reason ?? "invalid_decision" } as const;
    console.info("proofpay.payment.gated", { ...audit, txHash: null, error: result.reason });
    return result;
  }

  if (decision.verdict === "REVIEW") {
    const result = { status: "REVIEW", reason: decision.reason } as const;
    console.info("proofpay.payment.gated", { ...audit, txHash: null, error: result.reason });
    return result;
  }

  // Runtime-invalid/error verdicts fail closed, even if TypeScript is bypassed.
  if (decision.verdict !== "ALLOW") {
    const result = { status: "BLOCKED", reason: "invalid_decision" } as const;
    console.info("proofpay.payment.gated", { ...audit, txHash: null, error: result.reason });
    return result;
  }

  try {
    const payment = await paymentExecutor(recipient, amount);
    const result = { status: "EXECUTED", txHash: payment.txHash } as const;
    console.info("proofpay.payment.executed", { ...audit, txHash: result.txHash, error: null });
    return result;
  } catch (error) {
    const reason =
      error instanceof PaymentExecutionError ? error.reason : "RPC_FAILURE";
    const result = { status: "ERROR", reason } as const;
    console.error("proofpay.payment.failed", { ...audit, txHash: null, error: reason });
    return result;
  }
}

function readVerdict(decision: PolicyDecision): string {
  if (!decision || typeof decision !== "object") return "INVALID_INPUT";
  return typeof decision.verdict === "string" ? decision.verdict : "INVALID_INPUT";
}
