import {
  BaseError,
  InsufficientFundsError,
  getAddress,
  isAddress,
  type Hash,
} from "viem";

import {
  getBaseSepoliaClients,
  PAYMENT_CHAIN_ID,
  TRANSACTION_RECEIPT_TIMEOUT_MS,
} from "./config";

export type PaymentFailureReason =
  | "tx_reverted"
  | "network_failure"
  | "insufficient_gas";

export class PaymentExecutionError extends Error {
  readonly code = "PAYMENT_EXECUTION_FAILURE";

  constructor(
    readonly reason: PaymentFailureReason,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "PaymentExecutionError";
  }
}

/** Broadcasts and confirms a native ETH transfer on Base Sepolia only. */
export async function executePayment(
  recipient: string,
  amount: bigint,
): Promise<{ txHash: string }> {
  if (!isAddress(recipient)) {
    throw new PaymentExecutionError("network_failure", "Recipient is not a valid EVM address");
  }
  if (amount <= 0n) {
    throw new PaymentExecutionError("network_failure", "Payment amount must be greater than zero");
  }

  const to = getAddress(recipient);

  try {
    const { account, chain, publicClient, walletClient } = getBaseSepoliaClients();
    const connectedChainId = await publicClient.getChainId();

    // Refuse to sign if the configured RPC is not actually Base Sepolia.
    if (connectedChainId !== PAYMENT_CHAIN_ID || chain.id !== PAYMENT_CHAIN_ID) {
      throw new PaymentExecutionError(
        "network_failure",
        `Refusing payment on unexpected chain ${connectedChainId}`,
      );
    }

    const [balance, gasPrice, gas] = await Promise.all([
      publicClient.getBalance({ address: account.address }),
      publicClient.getGasPrice(),
      publicClient.estimateGas({ account, to, value: amount }),
    ]);

    if (balance < amount + gas * gasPrice) {
      throw new PaymentExecutionError(
        "insufficient_gas",
        "Executor wallet lacks enough ETH for the transfer and estimated gas",
      );
    }

    const txHash: Hash = await walletClient.sendTransaction({
      account,
      chain,
      to,
      value: amount,
    });

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
      confirmations: 1,
      timeout: TRANSACTION_RECEIPT_TIMEOUT_MS,
    });

    if (receipt.status !== "success") {
      throw new PaymentExecutionError("tx_reverted", "Base Sepolia transaction reverted");
    }

    return { txHash };
  } catch (error) {
    if (error instanceof PaymentExecutionError) throw error;
    if (isInsufficientFunds(error)) {
      throw new PaymentExecutionError(
        "insufficient_gas",
        "Executor wallet has insufficient funds for gas",
        { cause: error },
      );
    }
    throw new PaymentExecutionError(
      "network_failure",
      "Base Sepolia transaction could not be confirmed",
      { cause: error },
    );
  }
}

function isInsufficientFunds(error: unknown): boolean {
  if (error instanceof InsufficientFundsError) return true;
  if (error instanceof BaseError) {
    return error.walk((cause) => cause instanceof InsufficientFundsError) !== null;
  }
  return false;
}
