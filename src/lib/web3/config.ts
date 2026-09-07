import "server-only";

import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

import { ConfigValidationError, getServerConfig } from "../config";

export const PAYMENT_CHAIN = baseSepolia;
export const PAYMENT_CHAIN_ID = baseSepolia.id;
export const TRANSACTION_RECEIPT_TIMEOUT_MS = 90_000;

export class PaymentConfigError extends Error {
  readonly code = "MISSING_CONFIG";

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

  let config;
  try {
    config = getServerConfig();
  } catch (cause) {
    const message =
      cause instanceof ConfigValidationError
        ? "Payment executor configuration is unavailable"
        : "Payment executor configuration could not be loaded";
    throw new PaymentConfigError(message, { cause });
  }

  const account = privateKeyToAccount(config.executorPrivateKey);
  const transport = http(config.baseSepoliaRpcUrl, { retryCount: 2, timeout: 20_000 });

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
