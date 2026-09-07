import { NextResponse } from "next/server";
import { z } from "zod";
import type { Address, Hex } from "viem";

import {
  DEFAULT_BASE_SEPOLIA_USDC,
  postWithX402,
  TelegraphRequestFailure,
  X402PaymentFailure,
} from "@/lib/telegraph/x402-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  evidence: z.union([
    z.string().trim().min(1).max(20_000),
    z.record(z.unknown()),
  ]),
  intent: z.string().trim().min(1).max(100).optional(),
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
  const startedAt = Date.now();

  try {
    const input = requestSchema.parse(await request.json());
    const env = envSchema.parse(process.env);

    const result = await postWithX402({
      targetUrl: env.TELEGRAPH_ENGINE_URL,
      payload: input,
      privateKey: env.EXECUTOR_PRIVATE_KEY as Hex,
      rpcUrl: env.BASE_SEPOLIA_RPC_URL,
      expectedUsdcAddress: env.BASE_SEPOLIA_USDC_ADDRESS as Address,
      maxPaymentAtomic: env.X402_MAX_PAYMENT_ATOMIC,
      timeoutMs: env.TELEGRAPH_REQUEST_TIMEOUT_MS,
      requestHeaders: { "x-proofpay-request-id": requestId },
    });

    console.info("proofpay.telegraph.completed", {
      requestId,
      timestamp: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      intent: input.intent ?? null,
      miner: extractMinerIdentity(result.data),
      status: "SUCCESS",
      x402TransactionHash: result.payment.transactionHash,
      rawResponse: result.data,
    });

    return NextResponse.json({
      requestId,
      timestamp: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      ...result,
    });
  } catch (error) {
    const failure = normalizeError(error);

    console.error("proofpay.telegraph.failed", {
      requestId,
      timestamp: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      code: failure.code,
      status: "FAIL_CLOSED",
      message: failure.message,
    });

    return NextResponse.json(
      {
        requestId,
        timestamp: new Date().toISOString(),
        decision: "BLOCK",
        error: failure,
      },
      { status: failure.httpStatus },
    );
  }
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

function normalizeError(error: unknown): {
  code: string;
  message: string;
  httpStatus: number;
} {
  if (error instanceof X402PaymentFailure) {
    return { code: error.code, message: error.message, httpStatus: 502 };
  }
  if (error instanceof TelegraphRequestFailure) {
    return { code: error.code, message: error.message, httpStatus: 502 };
  }
  if (error instanceof z.ZodError) {
    return {
      code: "INVALID_INPUT_OR_CONFIG",
      message: "Request input or server configuration is invalid",
      httpStatus: 400,
    };
  }
  return {
    code: "MINER_UNREACHABLE",
    message: "Miner unreachable - action halted",
    httpStatus: 502,
  };
}
