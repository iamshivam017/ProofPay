import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routePath = new URL("../src/app/api/verify/route.ts", import.meta.url);
const healthPath = new URL("../src/app/api/health/route.ts", import.meta.url);
const statusPath = new URL("../src/app/api/status/route.ts", import.meta.url);

test("verification responses contain the auditable fail-closed envelope", async () => {
  const route = await readFile(routePath, "utf8");
  for (const field of ["requestId", "timestamp", "decision", "signals", "telegraph", "payment", "errors"]) {
    assert.match(route, new RegExp(`${field}[,:]`));
  }
  assert.match(route, /payment: \{ executed: false, txHash: null, explorerUrl: null \}/);
});

test("health and status endpoints disclose metadata but not secrets", async () => {
  const [health, status] = await Promise.all([
    readFile(healthPath, "utf8"),
    readFile(statusPath, "utf8"),
  ]);
  assert.match(health, /network: "base-sepolia"/);
  assert.match(status, /getTelemetrySnapshot/);
  assert.doesNotMatch(health + status, /executorPrivateKey|EXECUTOR_PRIVATE_KEY/);
});

test("production code contains no dry-run or simulated-success path", async () => {
  const route = await readFile(routePath, "utf8");
  assert.doesNotMatch(route, /dry.?run|mock.*hash|fake.*hash|simulated.*success/i);
});
