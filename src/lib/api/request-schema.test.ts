import assert from "node:assert/strict";
import test from "node:test";

import { parseVerificationRequest, RequestValidationError } from "./request-schema";

const validRequest = {
  amount: "0.0001",
  recipient: "0x0000000000000000000000000000000000000001",
  reason: "Confirmed invoice",
  evidence: "The delivery was received and confirmed.",
  intent: "AUTHENTICITY_GATE",
};

test("valid request input is accepted", () => {
  assert.equal(parseVerificationRequest(validRequest).amount, "0.0001");
});

test("invalid input fails before any external call", () => {
  for (const request of [
    { ...validRequest, amount: "0" },
    { ...validRequest, amount: "0.002" },
    { ...validRequest, recipient: "invalid" },
    { ...validRequest, evidence: "" },
    { ...validRequest, evidence: "x".repeat(20_001) },
  ]) {
    assert.throws(
      () => parseVerificationRequest(request),
      (error) => error instanceof RequestValidationError && error.code === "INVALID_INPUT",
    );
  }
});

test("unsupported intent is explicit and fail-closed", () => {
  assert.throws(
    () => parseVerificationRequest({ ...validRequest, intent: "IGNORE_POLICY" }),
    (error) => error instanceof RequestValidationError && error.code === "UNSUPPORTED_INTENT",
  );
});
