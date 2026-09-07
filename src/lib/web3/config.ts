import "server-only";

import { createPublicClient, createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { z } from "zod";

export const PAYMENT_CHAIN = baseSepolia;
export const PAYMENT_CHAIN_ID = baseSepolia.id;
export const TRANSACTION_RECEIPT_TIMEOUT_MS = 90_000;

const serverEnvSchema = z.object({
  BASE_SEPOLIA_RPC_URL: z.string().url(),
  EXECUTOR_PRIVATE_KEY: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
});

export class PaymentConfigError extends Error {
  readonly code = "PAYMENT_CONFIG_FAILURE";

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "PaymentConfigError";
  }
}

/**
 * Lazily creates server-only clients so builds and policy-only tests never need
 * wallet credentials. No private key is exported or serialized.
 */
export function getBaseSepoliaClients() {
  assertServerRuntime();

  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new PaymentConfigError(
      "BASE_SEPOLIA_RPC_URL or EXECUTOR_PRIVATE_KEY is missing or invalid",
      { cause: parsed.error },
    );
  }

  const account = privateKeyToAccount(parsed.data.EXECUTOR_PRIVATE_KEY as Hex);
  const transport = http(parsed.data.BASE_SEPOLIA_RPC_URL, {
    retryCount: 2,
    timeout: 20_000,
  });

  return {
    account,
    chain: PAYMENT_CHAIN,
    publicClient: createPublicClient({ chain: PAYMENT_CHAIN, transport }),
    walletClient: createWalletClient({ account, chain: PAYMENT_CHAIN, transport }),
  };
}

function assertServerRuntime(): void {
  if (typeof window !== "undefined") {
    throw new PaymentConfigError("Payment wallet configuration is server-only");
  }
}
