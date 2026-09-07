import { parseEther } from "viem";

import type { PolicyDecision } from "../src/lib/policy/types";
import { executeIfAllowed } from "../src/lib/web3/gate";

const [recipient, evidence] = process.argv.slice(2);
const verifyUrl = process.env.PROOFPAY_VERIFY_URL ?? "http://localhost:3000/api/verify";

if (!recipient || !evidence) {
  throw new Error(
    'Usage: npm run demo:payment -- <recipient> "<real evidence text>"',
  );
}

const response = await fetch(verifyUrl, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ evidence, intent: "AUTHENTICITY_GATE" }),
});

if (!response.ok) {
  throw new Error(`Real Telegraph verification failed with HTTP ${response.status}`);
}

const body = await response.json() as { policyDecision?: PolicyDecision };
if (!body.policyDecision) {
  throw new Error("Verification response did not contain a PolicyDecision");
}

const result = await executeIfAllowed(
  body.policyDecision,
  recipient,
  parseEther("0.0001"),
);

console.info("proofpay.demo.completed", {
  timestamp: new Date().toISOString(),
  decision: body.policyDecision.verdict,
  recipient,
  amountWei: parseEther("0.0001").toString(),
  result,
  explorerUrl:
    result.status === "EXECUTED"
      ? `https://sepolia.basescan.org/tx/${result.txHash}`
      : null,
});

if (result.status !== "EXECUTED") {
  process.exitCode = 1;
}
