import assert from "node:assert/strict";
import test from "node:test";

import { ConfigValidationError, getConfigStatus, getServerConfig } from "./config";

const validEnv = {
  BASE_SEPOLIA_RPC_URL: "https://sepolia.base.org",
  EXECUTOR_PRIVATE_KEY: `0x${"1".repeat(64)}`,
  TELEGRAPH_ENGINE_URL: "https://miner.telegraph.test/verify",
  BASE_SEPOLIA_USDC_ADDRESS: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  X402_MAX_PAYMENT_ATOMIC: "100000",
  TELEGRAPH_REQUEST_TIMEOUT_MS: "30000",
};

test("config status reports missing names without exposing values", () => {
  const status = getConfigStatus({});
  assert.equal(status.configured, false);
  assert.deepEqual(status.missing, [
    "BASE_SEPOLIA_RPC_URL",
    "EXECUTOR_PRIVATE_KEY",
    "TELEGRAPH_ENGINE_URL",
    "X402_MAX_PAYMENT_ATOMIC",
  ]);
  assert.deepEqual(status.warnings, []);
});

test("valid server configuration is normalized", () => {
  assert.deepEqual(getConfigStatus(validEnv), {
    configured: true,
    missing: [],
    warnings: [],
  });
  const config = getServerConfig(validEnv);
  assert.equal(config.telegraphRequestTimeoutMs, 30_000);
  assert.equal(config.x402MaxPaymentAtomic, 100_000n);
});

test("invalid and unsafe configuration are distinguished", () => {
  assert.throws(
    () => getServerConfig({ ...validEnv, BASE_SEPOLIA_RPC_URL: "not-a-url" }),
    (error) => error instanceof ConfigValidationError && error.code === "INVALID_CONFIG",
  );
  assert.throws(
    () => getServerConfig({ ...validEnv, TELEGRAPH_ENGINE_URL: "http://miner.example.com" }),
    (error) => error instanceof ConfigValidationError && error.code === "UNSAFE_CONFIG",
  );
});
