import type { DecisionTicket, VerifyFailureResponse } from "../src/lib/ticket/types";

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
  body: JSON.stringify({
    amount: "0.0001",
    recipient,
    reason: "ProofPay live Slice 1–4 integration check",
    evidence,
    intent: "TEXT_AUTHENTICITY_CHECK",
  }),
});

if (!response.ok) {
  const failure = await response.json() as VerifyFailureResponse;
  throw new Error(
    failure.error?.message ?? `Real Telegraph verification failed with HTTP ${response.status}`,
  );
}

const ticket = await response.json() as DecisionTicket;
if (!ticket.policy || !ticket.execution || !ticket.x402) {
  throw new Error("Verification response did not contain a complete Decision Ticket");
}

console.info("proofpay.demo.completed", {
  requestId: ticket.requestId,
  timestamp: ticket.timestamp,
  decision: ticket.policy.verdict,
  recipient: ticket.request.recipient,
  amountEth: ticket.request.amountEth,
  x402TransactionHash: ticket.x402.transactionHash,
  execution: ticket.execution,
  explorerUrl:
    ticket.execution.status === "EXECUTED"
      ? `https://sepolia.basescan.org/tx/${ticket.execution.txHash}`
      : null,
});

if (ticket.execution.status !== "EXECUTED") {
  process.exitCode = 1;
}
