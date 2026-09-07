import assert from "node:assert/strict";
import test from "node:test";

import {
  parsePaymentRequiredHeader,
  postWithX402,
  TelegraphRequestFailure,
  X402PaymentFailure,
} from "./x402-client";

const privateKey = `0x${"1".repeat(64)}` as `0x${string}`;
const common = {
  targetUrl: "https://miner.telegraph.test/verify",
  payload: { evidence: "local transport fixture" },
  privateKey,
  rpcUrl: "https://sepolia.base.org",
  maxPaymentAtomic: 100_000n,
};

test("standard x402 v2 payment requirements parse without legacy header guesses", () => {
  const encoded = Buffer.from(JSON.stringify({
    x402Version: 2,
    accepts: [{
      scheme: "exact",
      network: "eip155:84532",
      amount: "1000",
      asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      payTo: "0x1111111111111111111111111111111111111111",
    }],
  })).toString("base64");

  const parsed = parsePaymentRequiredHeader(encoded);
  assert.equal(parsed.x402Version, 2);
  assert.equal(parsed.accepts[0]?.amount, "1000");
});

test("malformed x402 challenge fails as a payment failure", () => {
  assert.throws(
    () => parsePaymentRequiredHeader(Buffer.from("{}").toString("base64")),
    (error) => error instanceof X402PaymentFailure,
  );
});

test("upstream 503 maps to MINER_UNREACHABLE", async () => {
  await assert.rejects(
    postWithX402({
      ...common,
      fetchImpl: async () => new Response("unavailable", { status: 503 }),
    }),
    (error) =>
      error instanceof TelegraphRequestFailure &&
      error.code === "MINER_UNREACHABLE" &&
      error.status === 503,
  );
});

test("aborted upstream request maps to MINER_TIMEOUT", async () => {
  const fetchImpl: typeof fetch = async (input, init) => new Promise((_resolve, reject) => {
    const signal = input instanceof Request ? input.signal : init?.signal;
    signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), {
      once: true,
    });
  });

  await assert.rejects(
    postWithX402({ ...common, timeoutMs: 5, fetchImpl }),
    (error) => error instanceof TelegraphRequestFailure && error.code === "MINER_TIMEOUT",
  );
});

test("an unpaid 200 response cannot be accepted as Miner success", async () => {
  await assert.rejects(
    postWithX402({
      ...common,
      fetchImpl: async () => Response.json({ signals: [] }),
    }),
    (error) => error instanceof X402PaymentFailure,
  );
});
