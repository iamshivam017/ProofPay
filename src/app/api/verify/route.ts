import { NextResponse } from "next/server";
import { parseEther } from "viem";

import { postWithX402, TelegraphRequestFailure, X402PaymentFailure } from "@/lib/telegraph/x402-client";
import { parseVerificationRequest, RequestValidationError, SUPPORTED_INTENT } from "@/src/lib/api/request-schema";
import { ConfigValidationError, getServerConfig } from "@/src/lib/config";
import { MATERIAL_CONFLICT_DELTA, evaluatePolicy } from "@/src/lib/policy/engine";
import type { MinerSignal } from "@/src/lib/policy/types";
import { recordTelemetry } from "@/src/lib/telemetry";
import { extractMinerIdentity, normalizeRealMinerSignals } from "@/src/lib/telegraph/normalize";
import type { DecisionTicket, PublicError, VerifyFailureResponse } from "@/src/lib/ticket/types";
import { executeIfAllowed } from "@/src/lib/web3/gate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const startedAt = Date.now();
  recordTelemetry("VERIFICATION_ATTEMPT");

  try {
    const input = parseVerificationRequest(await readJson(request));
    const config = getServerConfig();
    const result = await postWithX402({
      targetUrl: config.telegraphEngineUrl,
      // Telegraph's documented auto-routed Engine contract accepts a natural
      // language `query` plus optional structured `context`. Evidence stays in
      // context so it cannot replace the routing instruction itself.
      payload: {
        query:
          "Assess the supplied payment instruction evidence for text authenticity and fraud risk. Return explicit risk and confidence scores when the selected Miner supports them.",
        context: {
          requested_intent: input.intent,
          evidence: input.evidence,
          payment_request: {
            amount_eth: input.amount,
            recipient: input.recipient,
            reason: input.reason,
          },
        },
      },
      privateKey: config.executorPrivateKey,
      rpcUrl: config.baseSepoliaRpcUrl,
      expectedUsdcAddress: config.baseSepoliaUsdcAddress,
      maxPaymentAtomic: config.x402MaxPaymentAtomic,
      timeoutMs: config.telegraphRequestTimeoutMs,
      requestHeaders: { "x-proofpay-request-id": requestId },
    });

    const normalized = normalizeRealMinerSignals(result.data);
    const policy = evaluatePolicy(normalized.signals);
    const execution = await executeIfAllowed(policy, input.recipient, parseEther(input.amount));
    const latencyMs = Date.now() - startedAt;
    const minerIdentity = extractMinerIdentity(result.data);
    const x402Spend = BigInt(result.payment.requirement.amount);
    const errors: PublicError[] = normalized.error ? [normalized.error] : [];

    if (execution.status === "ERROR") {
      errors.push({ code: execution.reason, message: paymentErrorMessage(execution.reason) });
      recordTelemetry("PAYMENT_FAILURE");
    } else if (execution.status === "EXECUTED") {
      recordTelemetry("PAYMENT_SUCCESS");
    }
    recordTelemetry(policy.verdict, { latencyMs, x402SpendAtomic: x402Spend });

    const txHash = execution.status === "EXECUTED" ? execution.txHash : null;
    const status = execution.status === "EXECUTED"
      ? "SUCCESS"
      : execution.status === "ERROR"
        ? "ERROR"
        : "HELD";
    const reason = errors[0]?.message ?? policy.reason;
    const ticket: DecisionTicket = {
      requestId,
      timestamp,
      status,
      decision: policy.verdict,
      reason,
      signals: policy.signals,
      errors,
      request: {
        recipient: input.recipient,
        amountEth: input.amount,
        reason: input.reason,
        evidenceSummary: summarizeEvidence(input.evidence),
      },
      verification: {
        minerIdentity,
        intent: input.intent,
        latencyMs,
        signals: policy.signals,
        conflict: signalConflict(policy.signals),
      },
      policy,
      x402: {
        network: result.payment.requirement.network,
        asset: result.payment.requirement.asset,
        amountAtomic: result.payment.requirement.amount,
        transactionHash: result.payment.transactionHash,
      },
      execution,
      telegraph: {
        miner: minerIdentity,
        intent: input.intent,
        latencyMs,
        x402: {
          status: "SETTLED",
          network: result.payment.requirement.network,
          asset: result.payment.requirement.asset,
          amountAtomic: result.payment.requirement.amount,
          transactionHash: result.payment.transactionHash,
        },
      },
      payment: {
        executed: txHash !== null,
        txHash,
        explorerUrl: txHash ? `https://sepolia.basescan.org/tx/${txHash}` : null,
      },
    };

    console.info("proofpay.decision-ticket.created", redactTicketForLog(ticket));
    return NextResponse.json(ticket);
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    const failure = normalizeError(error);
    recordTelemetry("ERROR", { latencyMs });
    if (failure.code === "MINER_TIMEOUT") recordTelemetry("MINER_TIMEOUT");
    if (failure.code === "X402_PAYMENT_FAILURE") recordTelemetry("X402_FAILURE");

    const response: VerifyFailureResponse = {
      requestId,
      timestamp,
      status: failure.status,
      decision: failure.decision,
      reason: failure.message,
      signals: [],
      telegraph: { miner: null, intent: SUPPORTED_INTENT, latencyMs, x402: null },
      payment: { executed: false, txHash: null, explorerUrl: null },
      errors: [{ code: failure.code, message: failure.message }],
      error: { code: failure.code, message: failure.message },
    };

    console.error("proofpay.verification.failed", {
      requestId,
      timestamp,
      latencyMs,
      code: failure.code,
      status: "FAIL_CLOSED",
    });
    return NextResponse.json(response, { status: failure.httpStatus });
  }
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch (cause) {
    throw new RequestValidationError("INVALID_INPUT", "Payment request is incomplete or invalid.", { cause });
  }
}

function signalConflict(signals: MinerSignal[]): boolean | null {
  const risks = signals
    .filter((signal) => signal.required && signal.status === "OK" && typeof signal.risk === "number")
    .map((signal) => signal.risk as number);
  if (risks.length < 2) return null;
  return Math.max(...risks) - Math.min(...risks) >= MATERIAL_CONFLICT_DELTA;
}

function summarizeEvidence(evidence: string): string {
  return evidence.length > 240 ? `${evidence.slice(0, 237)}…` : evidence;
}

function normalizeError(error: unknown): {
  code: string;
  message: string;
  httpStatus: number;
  status: "HELD" | "ERROR";
  decision: "REVIEW" | "BLOCK";
} {
  if (error instanceof RequestValidationError) {
    return {
      code: error.code,
      message: error.message,
      httpStatus: 400,
      status: "HELD",
      decision: error.code === "INVALID_INPUT" ? "BLOCK" : "REVIEW",
    };
  }
  if (error instanceof ConfigValidationError) {
    return {
      code: error.code,
      message: "Server configuration incomplete — verification cannot run.",
      httpStatus: 503,
      status: "ERROR",
      decision: "REVIEW",
    };
  }
  if (error instanceof X402PaymentFailure) {
    return {
      code: error.code,
      message: "Miner payment could not be completed — action held for safety.",
      httpStatus: 502,
      status: "HELD",
      decision: "REVIEW",
    };
  }
  if (error instanceof TelegraphRequestFailure) {
    const message = error.code === "MINER_TIMEOUT"
      ? "Miner timed out — action held for safety."
      : error.code === "INVALID_MINER_RESPONSE"
        ? "Miner response was invalid — action held for safety."
        : "Verification unavailable — action held for safety.";
    return {
      code: error.code,
      message,
      httpStatus: error.status === 429 ? 503 : 502,
      status: "HELD",
      decision: "REVIEW",
    };
  }
  return {
    code: "MINER_UNREACHABLE",
    message: "Network error during verification — action held for safety.",
    httpStatus: 502,
    status: "HELD",
    decision: "REVIEW",
  };
}

function paymentErrorMessage(reason: string): string {
  if (reason === "MISSING_CONFIG") return "Server configuration incomplete — payment cannot run.";
  if (reason === "INSUFFICIENT_GAS") return "Executor has insufficient Base Sepolia gas.";
  if (reason === "TX_REVERTED") return "Base Sepolia transaction reverted — no success reported.";
  if (reason === "INVALID_INPUT") return "Payment request is incomplete or invalid.";
  return "Base Sepolia RPC failure — payment was not confirmed.";
}

function redactTicketForLog(ticket: DecisionTicket) {
  return {
    requestId: ticket.requestId,
    timestamp: ticket.timestamp,
    status: ticket.status,
    decision: ticket.decision,
    recipient: ticket.request.recipient,
    amountEth: ticket.request.amountEth,
    miner: ticket.telegraph.miner,
    latencyMs: ticket.telegraph.latencyMs,
    signalCount: ticket.signals.length,
    x402TransactionHash: ticket.x402.transactionHash,
    paymentTransactionHash: ticket.payment.txHash,
    errors: ticket.errors,
  };
}
