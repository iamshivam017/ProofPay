import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const clientPath = new URL("../lib/telegraph/x402-client.ts", import.meta.url);
const routePath = new URL("../app/api/verify/route.ts", import.meta.url);
const gitignorePath = new URL("../.gitignore", import.meta.url);

test("x402 wire headers use the v2 standard names", async () => {
  const source = await readFile(clientPath, "utf8");
  assert.match(source, /paymentRequired:\s*"PAYMENT-REQUIRED"/);
  assert.match(source, /paymentSignature:\s*"PAYMENT-SIGNATURE"/);
  assert.match(source, /paymentResponse:\s*"PAYMENT-RESPONSE"/);
});

test("payment credentials remain server-only", async () => {
  const [client, route] = await Promise.all([
    readFile(clientPath, "utf8"),
    readFile(routePath, "utf8"),
  ]);
  assert.match(client, /import "server-only"/);
  assert.doesNotMatch(client + route, /NEXT_PUBLIC_.*PRIVATE_KEY/);
  assert.match(route, /export const runtime = "nodejs"/);
});

test("payment and dependency failures fail closed", async () => {
  const [client, route] = await Promise.all([
    readFile(clientPath, "utf8"),
    readFile(routePath, "utf8"),
  ]);
  assert.match(route, /decision:\s*"BLOCK"/);
  assert.match(client, /code = "X402_PAYMENT_FAILURE"/);
  assert.match(route, /error instanceof X402PaymentFailure/);
  assert.match(route, /MINER_UNREACHABLE/);
});

test("secret-bearing environment files are ignored", async () => {
  const gitignore = await readFile(gitignorePath, "utf8");
  assert.match(gitignore, /^\.env$/m);
  assert.match(gitignore, /^\.env\.\*$/m);
  assert.match(gitignore, /^!\.env\.example$/m);
});
