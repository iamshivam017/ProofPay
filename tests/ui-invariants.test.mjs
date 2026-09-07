import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pagePath = new URL("../src/app/page.tsx", import.meta.url);
const chamberPath = new URL("../src/components/VerificationChamber.tsx", import.meta.url);
const decisionPath = new URL("../src/components/DecisionPanel.tsx", import.meta.url);
const receiptPath = new URL("../src/components/ProofReceipt.tsx", import.meta.url);

test("the UI implements the four requested workflow views", async () => {
  const [page, chamber, decision, receipt] = await Promise.all([
    readFile(pagePath, "utf8"),
    readFile(chamberPath, "utf8"),
    readFile(decisionPath, "utf8"),
    readFile(receiptPath, "utf8"),
  ]);

  assert.match(page, /Payment reason/);
  assert.match(page, /Evidence message/);
  assert.match(chamber, /Verification chamber/);
  assert.match(decision, /Deterministic policy outcome/);
  assert.match(receipt, /Decision proof/);
});

test("blocked and unavailable states visibly preserve zero movement", async () => {
  const [decision, receipt] = await Promise.all([
    readFile(decisionPath, "utf8"),
    readFile(receiptPath, "utf8"),
  ]);

  assert.match(decision, /\$0 moved/);
  assert.match(receipt, /\$0 moved — no downstream transaction was produced/);
});

test("receipt links are derived from returned hashes and never hardcoded", async () => {
  const receipt = await readFile(receiptPath, "utf8");
  assert.match(receipt, /sepolia\.basescan\.org\/tx\/\$\{ticket\.x402\.transactionHash\}/);
  assert.match(receipt, /sepolia\.basescan\.org\/tx\/\$\{baseTxHash\}/);
  assert.doesNotMatch(receipt, /0x[0-9a-fA-F]{64}/);
});
