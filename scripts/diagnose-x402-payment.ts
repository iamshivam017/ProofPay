import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

function errorChain(error: unknown): string[] {
  const messages: string[] = [];
  let current: unknown = error;

  for (let depth = 0; depth < 5 && current; depth += 1) {
    if (current instanceof Error) {
      messages.push(`${current.name}: ${current.message}`);
      current = current.cause;
    } else {
      messages.push(String(current));
      break;
    }
  }

  return [...new Set(messages)];
}

async function main(): Promise<void> {
  const [{ getServerConfig }, { postWithX402 }] = await Promise.all([
    import("../src/lib/config"),
    import("../lib/telegraph/x402-client"),
  ]);
  const config = getServerConfig();

  console.log("Starting one real Base Sepolia x402 payment diagnostic...");
  console.log("Maximum permitted charge (atomic USDC):", config.x402MaxPaymentAtomic.toString());

  try {
    const result = await postWithX402<Record<string, unknown>>({
      targetUrl: config.telegraphEngineUrl,
      payload: {
        query: "Verify whether this benign diagnostic payment instruction appears authentic: Pay 0.0001 ETH for completed open-source documentation work.",
        context: {
          intent: "TEXT_AUTHENTICITY_CHECK",
          source: "proofpay-paid-x402-diagnostic",
        },
      },
      privateKey: config.executorPrivateKey,
      rpcUrl: config.baseSepoliaRpcUrl,
      expectedUsdcAddress: config.baseSepoliaUsdcAddress,
      maxPaymentAtomic: config.x402MaxPaymentAtomic,
      timeoutMs: config.telegraphRequestTimeoutMs,
    });

    console.log("X402 PAYMENT SUCCESS");
    console.log("Network:", result.payment.requirement.network);
    console.log("Amount atomic:", result.payment.requirement.amount);
    console.log("Settlement transaction:", result.payment.transactionHash);
    console.log("Miner response keys:", Object.keys(result.data));
  } catch (error) {
    console.error("X402 PAYMENT FAILED SAFELY");
    for (const message of errorChain(error)) console.error("-", message);

    if (
      error &&
      typeof error === "object" &&
      "details" in error &&
      error.details &&
      typeof error.details === "object"
    ) {
      console.error("Safe details:", error.details);
    }
    process.exitCode = 1;
  }
}

void main();
