import { NextResponse } from "next/server";
import { parseEther, type Address, type Hex } from "viem";
import { z } from "zod";

import {
  DEFAULT_BASE_SEPOLIA_USDC,
  postWithX402,
  TelegraphRequestFailure,
  X402PaymentFailure,
} from "@/lib/telegraph/x402-client";
import { evaluatePolicy } from "@/src/lib/policy/engine";
import type { MinerSignal, MinerSignalStatus } from "@/src/lib/policy/types";
import type { DecisionTicket } from "@/src/lib/ticket/types";
import { executeIfAllowed } from "@/src/lib/web3/gate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_REQUEST_AMOUNT_WEI = parseEther("0.001");

const amountSchema = z.string().trim().refine((value) => {
  try {
    const amount = parseEther(value);
    return amount > 0n && amount <= MAX_REQUEST_AMOUNT_WEI;
  } catch {
    return false;
  }
}, "Amount must be greater than 0 and no more than 0.001 ETH");

const requestSchema = z.object({
  amount: amountSchema,
  recipient: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "Invalid recipient wallet"),
  reason: z.string().trim().min(3).max(280),
  evidence: z.string().trim().min(3).max(20_000),
  intent: z.string().trim().min(1).max(100).default("AUTHENTICITY_GATE"),
});

const envSchema = z.object({
  TELEGRAPH_ENGINE_URL: z.string().url(),
  EXECUTOR_PRIVATE_KEY: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  BASE_SEPOLIA_RPC_URL: z.string().url(),
  BASE_SEPOLIA_USDC_ADDRESS: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/)
    .default(DEFAULT_BASE_SEPOLIA_USDC),
  X402_MAX_PAYMENT_ATOMIC: z.coerce.bigint().positive(),
  TELEGRAPH_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(120_000).default(30_000),
});

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const startedAt = Date.now();

  try {
    const input = requestSchema.parse(await request.json());
    const env = envSchema.parse(process.env);

    const result = await postWithX402({
      targetUrl: env.TELEGRAPH_ENGINE_URL,
      payload: {
        evidence: input.evidence,
        intent: input.intent,
        paymentRequest: {
          amountEth: input.amount,
          recipient: input.recipient,
          reason: input.reason,
        },
      },
      privateKey: env.EXECUTOR_PRIVATE_KEY as Hex,
      rpcUrl: env.BASE_SEPOLIA_RPC_URL,
      expectedUsdcAddress: env.BASE_SEPOLIA_USDC_ADDRESS as Address,
      maxPaymentAtomic: env.X402_MAX_PAYMENT_ATOMIC,
      timeoutMs: env.TELEGRAPH_REQUEST_TIMEOUT_MS,
      requestHeaders: { "x-proofpay-request-id": requestId },
    });

    const policy = evaluatePolicy(normalizeRealMinerSignals(result.data));
    const execution = await executeIfAllowed(
      policy,
      input.recipient,
      parseEther(input.amount),
    );
    const latencyMs = Date.now() - startedAt;

    const ticket: DecisionTicket = {
      requestId,
      timestamp,
      request: {
        recipient: input.recipient,
        amountEth: input.amount,
        reason: input.reason,
        evidenceSummary: summarizeEvidence(input.evidence),
      },
      verification: {
        minerIdentity: extractMinerIdentity(result.data),
        intent: input.intent,
        latencyMs,
        signals: policy.signals,
      },
      policy,
      x402: {
        network: result.payment.requirement.network,
        asset: result.payment.requirement.asset,
        amountAtomic: result.payment.requirement.amount,
        transactionHash: result.payment.transactionHash,
      },
      execution,
    };

    console.info("proofpay.decision-ticket.created", ticket);
    return NextResponse.json(ticket);
  } catch (error) {
    const failure = normalizeError(error);

    console.error("proofpay.verification.failed", {
      requestId,
      timestamp,
      latencyMs: Date.now() - startedAt,
      code: failure.code,
      status: "FAIL_CLOSED",
      message: failure.message,
    });

    return NextResponse.json(
      { requestId, timestamp, error: { code: failure.code, message: failure.message } },
      { status: failure.httpStatus },
    );
  }
}

function normalizeRealMinerSignals(data: unknown): MinerSignal[] {
  const candidateSignals = Array.isArray(data)
    ? data
    : data && typeof data === "object" && Array.isArray((data as Record<string, unknown>).signals)
      ? ((data as Record<string, unknown>).signals as unknown[])
      : null;

  if (!candidateSignals || candidateSignals.length === 0) {
    return [missingRealSignal(data)];
  }

  // Values remain verbatim; the policy engine owns runtime validation.
  return candidateSignals.map((value) => value as MinerSignal);
}

function missingRealSignal(data: unknown): MinerSignal {
  return {
    id: "telegraph-primary-signal",
    minerId: extractMinerIdentity(data) ?? "unavailable",
    kind: "normalized-authenticity-risk",
    required: true,
    status: "MISSING" satisfies MinerSignalStatus,
    risk: null,
    confidence: null,
  };
}

function extractMinerIdentity(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const value = data as Record<string, unknown>;
  for (const key of ["miner", "minerId", "miner_id", "subnet", "subnetId"]) {
    if (typeof value[key] === "string" || typeof value[key] === "number") {
      return String(value[key]);
    }
  }
  return null;
}

function summarizeEvidence(evidence: string): string {
  return evidence.length > 240 ? `${evidence.slice(0, 237)}…` : evidence;
}

function normalizeError(error: unknown): {
  code: string;
  message: string;
  httpStatus: number;
} {
  if (error instanceof X402PaymentFailure) {
    return {
      code: error.code,
      message: "Verification unavailable — action held for safety.",
      httpStatus: 502,
    };
  }
  if (error instanceof TelegraphRequestFailure) {
    return {
      code: error.code,
      message: "Verification unavailable — action held for safety.",
      httpStatus: 502,
    };
  }
  if (error instanceof z.ZodError) {
    return {
      code: "INVALID_INPUT_OR_CONFIG",
      message: "Payment request or server configuration is invalid.",
      httpStatus: 400,
    };
  }
  return {
    code: "MINER_UNREACHABLE",
    message: "Verification unavailable — action held for safety.",
    httpStatus: 502,
  };
}
