import { loadEnvConfig } from "@next/env";
import {
  createPublicClient,
  erc20Abi,
  formatEther,
  formatUnits,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

loadEnvConfig(process.cwd());

const [{ getServerConfig }, { parsePaymentRequiredHeader, X402_HEADERS }] =
  await Promise.all([
    import("../src/lib/config"),
    import("../lib/telegraph/x402-client"),
  ]);

const config = getServerConfig();
const account = privateKeyToAccount(config.executorPrivateKey);
const client = createPublicClient({
  chain: baseSepolia,
  transport: http(config.baseSepoliaRpcUrl),
});

const [ethBalance, usdcBalance] = await Promise.all([
  client.getBalance({ address: account.address }),
  client.readContract({
    address: config.baseSepoliaUsdcAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address],
  }),
]);

console.log("Public wallet:", account.address);
console.log("Base Sepolia ETH:", formatEther(ethBalance));
console.log("Base Sepolia USDC:", formatUnits(usdcBalance, 6));
console.log(
  "Configured payment maximum:",
  `${formatUnits(config.x402MaxPaymentAtomic, 6)} USDC`,
);

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), config.telegraphRequestTimeoutMs);

try {
  const response = await fetch(config.telegraphEngineUrl, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      query: "Verify the authenticity and payment risk of this diagnostic request.",
      context: {
        intent: "TEXT_AUTHENTICITY_CHECK",
        source: "proofpay-x402-diagnostic",
      },
    }),
    signal: controller.signal,
  });

  console.log("Initial Telegraph status:", response.status);
  const encoded = response.headers.get(X402_HEADERS.paymentRequired);
  if (response.status !== 402 || !encoded) {
    console.log("Expected a 402 response with PAYMENT-REQUIRED; no payment was made.");
    process.exitCode = 1;
  } else {
    const challenge = parsePaymentRequiredHeader(encoded);
    console.table(
      challenge.accepts.map((requirement) => ({
        scheme: requirement.scheme,
        network: requirement.network,
        asset: requirement.asset,
        amountAtomic: requirement.amount,
        amountUSDC: Number(requirement.amount) / 1_000_000,
        payTo: requirement.payTo,
      })),
    );
  }
} catch (error) {
  console.error(
    "Diagnostic failed safely:",
    error instanceof Error ? error.message : "Unknown error",
  );
  process.exitCode = 1;
} finally {
  clearTimeout(timeout);
}
