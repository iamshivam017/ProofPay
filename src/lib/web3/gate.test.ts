import assert from "node:assert/strict";
import test from "node:test";

import type { PolicyDecision } from "../policy/types";
import { PAYMENT_CHAIN_ID } from "./config";
import { executePayment, PaymentExecutionError } from "./executor";
import { executeIfAllowedUsing } from "./gate";

function decision(verdict: PolicyDecision["verdict"]): PolicyDecision {
  return { verdict, reason: `fixture_${verdict}`, confidence: 0, signals: [] };
}

test("BLOCK and REVIEW never invoke the payment executor", async () => {
  for (const verdict of ["BLOCK", "REVIEW"] as const) {
    let calls = 0;
    const result = await executeIfAllowedUsing(
      decision(verdict),
      "not-evaluated-for-non-allow",
      1n,
      async () => {
        calls += 1;
        throw new Error("non-ALLOW reached executor");
      },
    );

    assert.equal(calls, 0);
    assert.equal(result.status, verdict === "BLOCK" ? "BLOCKED" : "REVIEW");
  }
});

test("unknown error states fail closed and never invoke the executor", async () => {
  for (const verdict of [
    "ERROR",
    "TIMEOUT",
    "INVALID_INPUT",
    "MINER_UNREACHABLE",
    "X402_PAYMENT_FAILURE",
    "LOW_CONFIDENCE",
  ]) {
    let calls = 0;
    const malformed = { ...decision("REVIEW"), verdict } as unknown as PolicyDecision;
    const result = await executeIfAllowedUsing(malformed, "unused", 1n, async () => {
      calls += 1;
      throw new Error("invalid state reached executor");
    });

    assert.equal(calls, 0);
    assert.deepEqual(result, { status: "BLOCKED", reason: "invalid_decision" });
  }
});

test("ALLOW is the only verdict that dispatches to the executor", async () => {
  let calls = 0;
  const result = await executeIfAllowedUsing(
    decision("ALLOW"),
    "recipient",
    1n,
    async () => {
      calls += 1;
      throw new Error("deliberate network fixture");
    },
  );

  assert.equal(calls, 1);
  assert.deepEqual(result, { status: "ERROR", reason: "RPC_FAILURE" });
});

test("executor is pinned to Base Sepolia", () => {
  assert.equal(PAYMENT_CHAIN_ID, 84_532);
});

test("invalid payment input fails before wallet configuration or broadcast", async () => {
  await assert.rejects(executePayment("invalid-recipient", 1n), /valid EVM address/);
  await assert.rejects(
    executePayment("0x0000000000000000000000000000000000000001", 0n),
    /greater than zero/,
  );
});

test("executor failures retain the required auditable error reasons", async () => {
  for (const reason of [
    "TX_REVERTED",
    "RPC_FAILURE",
    "INSUFFICIENT_GAS",
    "MISSING_CONFIG",
    "INVALID_INPUT",
  ] as const) {
    const result = await executeIfAllowedUsing(
      decision("ALLOW"),
      "recipient",
      1n,
      async () => {
        throw new PaymentExecutionError(reason, "deliberate failure fixture");
      },
    );

    assert.deepEqual(result, { status: "ERROR", reason });
  }
});
