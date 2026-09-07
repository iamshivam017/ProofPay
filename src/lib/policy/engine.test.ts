import assert from "node:assert/strict";
import test from "node:test";

import { evaluatePolicy } from "./engine";
import type { MinerSignal } from "./types";

function signal(overrides: Partial<MinerSignal> = {}): MinerSignal {
  return {
    id: "signal-1",
    minerId: "miner-1",
    kind: "synthetic-risk",
    required: true,
    status: "OK",
    risk: 0.1,
    confidence: 0.9,
    ...overrides,
  };
}

test("high deepfake risk at the boundary produces BLOCK", () => {
  const result = evaluatePolicy([signal({ kind: "deepfake-risk", risk: 0.85 })]);
  assert.equal(result.verdict, "BLOCK");
});

test("clean and consistent required signals produce ALLOW", () => {
  const result = evaluatePolicy([
    signal({ id: "text", kind: "synthetic-text", risk: 0.12, confidence: 0.88 }),
    signal({ id: "image", kind: "deepfake-image", risk: 0.2, confidence: 0.82 }),
  ]);
  assert.deepEqual(
    { verdict: result.verdict, confidence: result.confidence },
    { verdict: "ALLOW", confidence: 0.82 },
  );
});

test("materially conflicting signals produce REVIEW", () => {
  const result = evaluatePolicy([
    signal({ id: "text", risk: 0.1 }),
    signal({ id: "image", risk: 0.4 }),
  ]);
  assert.equal(result.verdict, "REVIEW");
  assert.match(result.reason, /conflict/i);
});

test("a missing required signal produces REVIEW and never ALLOW", () => {
  const result = evaluatePolicy([
    signal(),
    signal({ id: "image", status: "MISSING", risk: null, confidence: null }),
  ]);
  assert.equal(result.verdict, "REVIEW");
});

test("empty input produces REVIEW and never ALLOW", () => {
  assert.equal(evaluatePolicy([]).verdict, "REVIEW");
});

test("invalid evidence produces BLOCK", () => {
  const result = evaluatePolicy([
    signal({ status: "INVALID", risk: null, confidence: null }),
  ]);
  assert.equal(result.verdict, "BLOCK");
});

test("unreachable, timeout, and x402 failures each produce REVIEW", () => {
  for (const status of ["UNREACHABLE", "TIMEOUT", "X402_FAILURE"] as const) {
    const result = evaluatePolicy([signal({ status, risk: null, confidence: null })]);
    assert.equal(result.verdict, "REVIEW");
  }
});

test("unavailable confidence produces REVIEW", () => {
  assert.equal(evaluatePolicy([signal({ confidence: null })]).verdict, "REVIEW");
  assert.equal(
    evaluatePolicy([signal({ confidence: "unknown" as unknown as number })]).verdict,
    "REVIEW",
  );
});

test("risk outside 0..1 is invalid input and BLOCKS", () => {
  assert.equal(evaluatePolicy([signal({ risk: 1.1 })]).verdict, "BLOCK");
  assert.equal(evaluatePolicy([signal({ risk: -0.1 })]).verdict, "BLOCK");
});

test("ambiguous middle-band values use the final fail-closed REVIEW", () => {
  const result = evaluatePolicy([signal({ risk: 0.5, confidence: 0.5 })]);
  assert.equal(result.verdict, "REVIEW");
  assert.match(result.reason, /default fail-closed/i);
});

test("an optional high-risk signal does not replace the required-signal contract", () => {
  const result = evaluatePolicy([
    signal({ id: "required", risk: 0.2, confidence: 0.9 }),
    signal({ id: "optional", required: false, risk: 0.9, confidence: 0.95 }),
  ]);
  assert.equal(result.verdict, "ALLOW");
});

test("threshold boundaries are deterministic", () => {
  assert.equal(
    evaluatePolicy([signal({ risk: 0.35, confidence: 0.8 })]).verdict,
    "ALLOW",
  );
  assert.equal(
    evaluatePolicy([signal({ risk: 0.350_001, confidence: 0.8 })]).verdict,
    "REVIEW",
  );
  assert.equal(
    evaluatePolicy([signal({ risk: 0.35, confidence: 0.799_999 })]).verdict,
    "REVIEW",
  );
});

test("the same input always produces the same decision", () => {
  const signals = [
    signal({ id: "text", risk: 0.18, confidence: 0.91 }),
    signal({ id: "image", risk: 0.22, confidence: 0.86 }),
  ];

  assert.deepEqual(evaluatePolicy(signals), evaluatePolicy(signals));
});
