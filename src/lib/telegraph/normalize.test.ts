import assert from "node:assert/strict";
import test from "node:test";

import { normalizeRealMinerSignals } from "./normalize";

test("a complete real-shaped signal envelope is preserved", () => {
  const signal = {
    id: "signal-1",
    minerId: "miner-1",
    kind: "deepfake-risk",
    required: true,
    status: "OK" as const,
    risk: 0.1,
    confidence: 0.9,
  };
  assert.deepEqual(normalizeRealMinerSignals({ signals: [signal] }), { signals: [signal] });
});

test("documented Engine result envelopes preserve normalized Miner signals", () => {
  const signal = {
    id: "authenticity",
    minerId: "32",
    kind: "text-authenticity-risk",
    required: true,
    status: "OK",
    risk: 0.12,
    confidence: 0.91,
  } as const;

  const normalized = normalizeRealMinerSignals({
    miner_id: "32",
    miner_name: "example-miner",
    result: { signals: [signal] },
  });

  assert.deepEqual(normalized, { signals: [signal] });
});

test("missing or malformed Miner signals map to INVALID_MINER_RESPONSE", () => {
  for (const payload of [{}, { signals: [] }, { signals: [{ status: "UNKNOWN" }] }]) {
    const result = normalizeRealMinerSignals(payload);
    assert.equal(result.error?.code, "INVALID_MINER_RESPONSE");
    assert.equal(result.signals[0]?.status, "MISSING");
    assert.equal(result.signals[0]?.required, true);
  }
});

test("missing confidence remains absent for fail-closed policy review", () => {
  const result = normalizeRealMinerSignals({
    signals: [{
      id: "signal-1",
      minerId: "miner-1",
      kind: "deepfake-risk",
      required: true,
      status: "OK",
      risk: 0.1,
      confidence: null,
    }],
  });
  assert.equal(result.error, undefined);
  assert.equal(result.signals[0]?.confidence, null);
});
