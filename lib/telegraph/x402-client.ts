import "server-only";

import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { ExactEvmScheme, toClientEvmSigner } from "@x402/evm";
import {
  createPublicClient,
  erc20Abi,
  getAddress,
  http,
  isAddress,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

export const BASE_SEPOLIA_CAIP2 = "eip155:84532" as const;
export const DEFAULT_BASE_SEPOLIA_USDC =
  "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const;

/**
 * x402 v2 wire headers. Keep these names centralized so an organizer-specific
 * transport can be adopted without touching payment or request logic.
 */
export const X402_HEADERS = {
  paymentRequired: "PAYMENT-REQUIRED",
  paymentSignature: "PAYMENT-SIGNATURE",
  paymentResponse: "PAYMENT-RESPONSE",
} as const;

type JsonObject = Record<string, unknown>;

export interface X402PaymentRequirement {
  scheme: string;
  network: string;
  amount: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds?: number;
  extra?: JsonObject;
}

export interface X402PaymentRequired {
  x402Version: number;
  error?: string;
  resource?: JsonObject;
  accepts: X402PaymentRequirement[];
  extensions?: JsonObject;
}

export interface X402SettlementResponse extends JsonObject {
  success?: boolean;
  transaction?: string;
  network?: string;
  errorReason?: string;
}

export interface X402Result<T> {
  data: T;
  payment: {
    requirement: X402PaymentRequirement;
    settlement: X402SettlementResponse;
    transactionHash: string;
  };
}

export interface X402ClientOptions {
  targetUrl: string;
  payload: unknown;
  privateKey: Hex;
  rpcUrl: string;
  expectedUsdcAddress?: Address;
  maxPaymentAtomic: bigint;
  timeoutMs?: number;
  requestHeaders?: HeadersInit;
  fetchImpl?: typeof fetch;
}

export class X402PaymentFailure extends Error {
  readonly code = "X402_PAYMENT_FAILURE" as const;
  readonly cause?: unknown;
  readonly details?: JsonObject;

  constructor(message: string, options?: { cause?: unknown; details?: JsonObject }) {
    super(message);
    this.name = "X402PaymentFailure";
    this.cause = options?.cause;
    this.details = options?.details;
  }
}

export class TelegraphRequestFailure extends Error {
  readonly code:
    | "TELEGRAPH_REQUEST_FAILURE"
    | "MINER_UNREACHABLE"
    | "MINER_TIMEOUT"
    | "INVALID_MINER_RESPONSE";
  readonly status?: number;

  constructor(
    message: string,
    status?: number,
    code: TelegraphRequestFailure["code"] = "TELEGRAPH_REQUEST_FAILURE",
  ) {
    super(message);
    this.name = "TelegraphRequestFailure";
    this.status = status;
    this.code = code;
  }
}

function decodeBase64Json<T>(encoded: string, label: string): T {
  try {
    const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(Buffer.from(normalized, "base64").toString("utf8")) as T;
  } catch (cause) {
    throw new X402PaymentFailure(`Invalid ${label} header`, { cause });
  }
}

function isPaymentRequirement(value: unknown): value is X402PaymentRequirement {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.scheme === "string" &&
    typeof item.network === "string" &&
    typeof item.amount === "string" &&
    typeof item.asset === "string" &&
    typeof item.payTo === "string"
  );
}

export function parsePaymentRequiredHeader(encoded: string): X402PaymentRequired {
  const decoded = decodeBase64Json<X402PaymentRequired>(
    encoded,
    X402_HEADERS.paymentRequired,
  );

  if (
    !decoded ||
    typeof decoded !== "object" ||
    decoded.x402Version !== 2 ||
    !Array.isArray(decoded.accepts) ||
    !decoded.accepts.every(isPaymentRequirement)
  ) {
    throw new X402PaymentFailure("Unsupported or malformed x402 payment requirements");
  }

  return decoded;
}

function selectAndValidateRequirement(
  paymentRequired: X402PaymentRequired,
  expectedUsdcAddress: Address,
  maxPaymentAtomic: bigint,
): X402PaymentRequirement {
  const requirement = paymentRequired.accepts.find(
    (candidate) =>
      candidate.scheme === "exact" && candidate.network === BASE_SEPOLIA_CAIP2,
  );

  if (!requirement) {
    throw new X402PaymentFailure("Server does not offer exact payment on Base Sepolia");
  }

  if (!isAddress(requirement.asset) || !isAddress(requirement.payTo)) {
    throw new X402PaymentFailure("Payment requirement contains an invalid EVM address");
  }

  if (getAddress(requirement.asset) !== getAddress(expectedUsdcAddress)) {
    throw new X402PaymentFailure("Payment asset is not the configured Base Sepolia USDC", {
      details: { requestedAsset: requirement.asset },
    });
  }

  if (!/^\d+$/.test(requirement.amount)) {
    throw new X402PaymentFailure("Payment amount is not an unsigned atomic-unit integer");
  }

  const amount = BigInt(requirement.amount);
  if (amount <= 0n || amount > maxPaymentAtomic) {
    throw new X402PaymentFailure("Requested payment is zero or exceeds the configured cap", {
      details: {
        requestedAtomic: requirement.amount,
        maximumAtomic: maxPaymentAtomic.toString(),
      },
    });
  }

  return requirement;
}

function parseSettlement(response: Response): X402SettlementResponse {
  const encoded = response.headers.get(X402_HEADERS.paymentResponse);
  if (!encoded) {
    throw new X402PaymentFailure("Paid response is missing PAYMENT-RESPONSE settlement proof");
  }

  const settlement = decodeBase64Json<X402SettlementResponse>(
    encoded,
    X402_HEADERS.paymentResponse,
  );

  if (settlement.success !== true) {
    throw new X402PaymentFailure("x402 settlement was not successful", {
      details: settlement,
    });
  }

  if (typeof settlement.transaction !== "string" || !settlement.transaction) {
    throw new X402PaymentFailure("x402 settlement did not return a transaction hash", {
      details: settlement,
    });
  }

  return settlement;
}

function safeErrorMessage(value: unknown): string {
  return value instanceof Error ? value.message : "Unknown payment error";
}

/**
 * Executes one standards-compliant x402 v2 HTTP exchange.
 *
 * The viem account signs the EIP-3009 authorization. Telegraph's facilitator
 * verifies and settles the USDC transfer, then returns PAYMENT-RESPONSE. This
 * intentionally does not send a separate ERC-20 transfer before retrying,
 * which would risk double payment and is not the x402 v2 `exact` scheme.
 */
export async function postWithX402<T = unknown>(
  options: X402ClientOptions,
): Promise<X402Result<T>> {
  const {
    targetUrl,
    payload,
    privateKey,
    rpcUrl,
    expectedUsdcAddress = DEFAULT_BASE_SEPOLIA_USDC,
    maxPaymentAtomic,
    timeoutMs = 30_000,
    requestHeaders,
    fetchImpl = fetch,
  } = options;

  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new X402PaymentFailure("Executor private key is malformed");
  }
  if (!/^https?:\/\//.test(targetUrl)) {
    throw new TelegraphRequestFailure("Telegraph target URL must use HTTP or HTTPS");
  }

  const account = privateKeyToAccount(privateKey);
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(rpcUrl),
  });

  let selectedRequirement: X402PaymentRequirement | undefined;
  let sawPaymentSignature = false;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  // Observe and validate the challenge before the official wrapper signs it.
  const guardedFetch: typeof fetch = async (input, init) => {
    const outgoingHeaders = new Headers(init?.headers);
    if (outgoingHeaders.has(X402_HEADERS.paymentSignature)) {
      sawPaymentSignature = true;
    }

    const response = await fetchImpl(input, init);
    if (response.status === 402) {
      const encoded = response.headers.get(X402_HEADERS.paymentRequired);
      if (!encoded) {
        throw new X402PaymentFailure("402 response is missing PAYMENT-REQUIRED header");
      }
      const paymentRequired = parsePaymentRequiredHeader(encoded);
      selectedRequirement = selectAndValidateRequirement(
        paymentRequired,
        expectedUsdcAddress,
        maxPaymentAtomic,
      );

      // Check the actual advertised amount before allowing the SDK to sign.
      try {
        const balance = await publicClient.readContract({
          address: expectedUsdcAddress,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [account.address],
        });
        if (balance < BigInt(selectedRequirement.amount)) {
          throw new X402PaymentFailure("Executor wallet has insufficient USDC", {
            details: {
              balanceAtomic: balance.toString(),
              requiredAtomic: selectedRequirement.amount,
            },
          });
        }
      } catch (cause) {
        if (cause instanceof X402PaymentFailure) throw cause;
        throw new X402PaymentFailure("Unable to verify executor USDC balance", { cause });
      }
    }
    return response;
  };

  try {
    const signer = toClientEvmSigner(account);
    const client = x402Client.fromConfig({
      schemes: [
        {
          network: BASE_SEPOLIA_CAIP2,
          client: new ExactEvmScheme(signer),
        },
      ],
    });
    const paidFetch = wrapFetchWithPayment(guardedFetch, client);

    const response = await paidFetch(targetUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        ...Object.fromEntries(new Headers(requestHeaders).entries()),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (response.status === 402 || (selectedRequirement && !sawPaymentSignature)) {
      throw new X402PaymentFailure("x402 challenge was not successfully paid");
    }
    if (!response.ok) {
      const unavailable = [429, 500, 502, 503].includes(response.status);
      throw new TelegraphRequestFailure(
        `Telegraph returned HTTP ${response.status}`,
        response.status,
        unavailable ? "MINER_UNREACHABLE" : "TELEGRAPH_REQUEST_FAILURE",
      );
    }
    if (!selectedRequirement) {
      throw new X402PaymentFailure("Telegraph response did not perform an x402 handshake");
    }

    const settlement = parseSettlement(response);
    let data: T;
    try {
      data = (await response.json()) as T;
    } catch (cause) {
      throw new TelegraphRequestFailure(
        `Telegraph returned invalid JSON: ${safeErrorMessage(cause)}`,
        response.status,
        "INVALID_MINER_RESPONSE",
      );
    }

    return {
      data,
      payment: {
        requirement: selectedRequirement,
        settlement,
        transactionHash: settlement.transaction!,
      },
    };
  } catch (cause) {
    if (cause instanceof X402PaymentFailure || cause instanceof TelegraphRequestFailure) {
      throw cause;
    }
    if (controller.signal.aborted) {
      throw new TelegraphRequestFailure("Telegraph request timed out", undefined, "MINER_TIMEOUT");
    }
    if (!selectedRequirement && !sawPaymentSignature) {
      throw new TelegraphRequestFailure(
        `Telegraph Miner is unreachable: ${safeErrorMessage(cause)}`,
        undefined,
        "MINER_UNREACHABLE",
      );
    }
    throw new X402PaymentFailure(`x402 exchange failed: ${safeErrorMessage(cause)}`, {
      cause,
    });
  } finally {
    clearTimeout(timeout);
  }
}
