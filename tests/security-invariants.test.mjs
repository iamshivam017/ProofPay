import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const clientPath = new URL("../lib/telegraph/x402-client.ts", import.meta.url);
const routePath = new URL("../src/app/api/verify/route.ts", import.meta.url);
const paymentConfigPath = new URL("../src/lib/web3/config.ts", import.meta.url);
const paymentExecutorPath = new URL("../src/lib/web3/executor.ts", import.meta.url);
const demoPath = new URL("../scripts/demo-base-sepolia-payment.ts", import.meta.url);
const gitignorePath = new URL("../.gitignore", import.meta.url);

test("x402 wire headers use the v2 standard names", async () => {
  const source = await readFile(clientPath, "utf8");
  assert.match(source, /paymentRequired:\s*"PAYMENT-REQUIRED"/);
  assert.match(source, /paymentSignature:\s*"PAYMENT-SIGNATURE"/);
  assert.match(source, /paymentResponse:\s*"PAYMENT-RESPONSE"/);
});

test("payment credentials remain server-only", async () => {
  const [client, route, paymentConfig, paymentExecutor] = await Promise.all([
    readFile(clientPath, "utf8"),
    readFile(routePath, "utf8"),
    readFile(paymentConfigPath, "utf8"),
    readFile(paymentExecutorPath, "utf8"),
  ]);
  assert.match(client, /import "server-only"/);
  assert.match(paymentConfig, /import "server-only"/);
  assert.doesNotMatch(client + route + paymentConfig + paymentExecutor, /NEXT_PUBLIC_.*PRIVATE_KEY/);
  assert.match(route, /export const runtime = "nodejs"/);
});

test("downstream payments are pinned to Base Sepolia", async () => {
  const [paymentConfig, paymentExecutor] = await Promise.all([
    readFile(paymentConfigPath, "utf8"),
    readFile(paymentExecutorPath, "utf8"),
  ]);
  assert.match(paymentConfig, /PAYMENT_CHAIN = baseSepolia/);
  assert.match(paymentExecutor, /connectedChainId !== PAYMENT_CHAIN_ID/);
  assert.doesNotMatch(paymentConfig + paymentExecutor, /mainnet/);
});

test("payment and dependency failures fail closed", async () => {
  const [client, route] = await Promise.all([
    readFile(clientPath, "utf8"),
    readFile(routePath, "utf8"),
  ]);
  assert.match(route, /Verification unavailable — action held for safety/);
  assert.match(client, /code = "X402_PAYMENT_FAILURE"/);
  assert.match(route, /error instanceof X402PaymentFailure/);
  assert.match(route, /MINER_UNREACHABLE/);
});

test("the public verification route preserves the policy execution gate", async () => {
  const route = await readFile(routePath, "utf8");
  const policyOffset = route.indexOf("evaluatePolicy(");
  const gateOffset = route.indexOf("executeIfAllowed(");

  assert.ok(policyOffset >= 0, "route must evaluate the deterministic policy");
  assert.ok(gateOffset > policyOffset, "payment gate must run only after policy evaluation");
  assert.match(route, /MAX_REQUEST_AMOUNT_WEI = parseEther\("0\.001"\)/);
});

test("the demo cannot execute a duplicate downstream transfer", async () => {
  const demo = await readFile(demoPath, "utf8");
  assert.doesNotMatch(demo, /executeIfAllowed|executePayment/);
  assert.match(demo, /fetch\(verifyUrl/);
  assert.match(demo, /ticket\.execution\.status/);
});

test("secret-bearing environment files are ignored", async () => {
  const gitignore = await readFile(gitignorePath, "utf8");
  assert.match(gitignore, /^\.env$/m);
  assert.match(gitignore, /^\.env\.\*$/m);
  assert.match(gitignore, /^!\.env\.example$/m);
});
