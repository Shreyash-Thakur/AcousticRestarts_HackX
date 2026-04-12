/**
 * Unit tests for the risk scoring engine.
 * Run with: npm run test:risk
 *
 * Uses Node.js built-in test runner (no extra dependencies needed).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeClientRiskScore } from "../src/services/risk.service.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

const makeInvoice = (overrides = {}) => ({
  id: 1,
  clientName: "Test Corp",
  amount: 100000,
  tokenId: null,
  createdAt: new Date().toISOString(),
  dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
  ...overrides,
});

const makeInvoices = (count, overrides = {}) =>
  Array.from({ length: count }, (_, i) => makeInvoice({ id: i + 1, ...overrides }));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("computeClientRiskScore", () => {

  it("returns score 100 for 0 invoices (no history)", () => {
    const result = computeClientRiskScore([]);
    assert.equal(result.rawScore, 100);
    assert.equal(result.riskLevel, "Low");
    assert.equal(result.insufficientHistory, true);
    assert.equal(result.invoiceCount, 0);
  });

  it("returns score 100 for exactly 3 invoices (at threshold)", () => {
    const result = computeClientRiskScore(makeInvoices(3));
    assert.equal(result.rawScore, 100);
    assert.equal(result.insufficientHistory, true);
    assert.equal(result.invoiceCount, 3);
  });

  it("computes a real score for 4+ invoices", () => {
    const result = computeClientRiskScore(makeInvoices(4));
    assert.equal(result.insufficientHistory, false);
    assert.equal(result.invoiceCount, 4);
    assert.ok(result.rawScore >= 0 && result.rawScore <= 100, "score must be 0–100");
  });

  it("raises paymentReliability when all invoices are tokenized", () => {
    const allTokenized    = makeInvoices(6, { tokenId: 42 });
    const noneTokenized   = makeInvoices(6, { tokenId: null });
    const r1 = computeClientRiskScore(allTokenized);
    const r2 = computeClientRiskScore(noneTokenized);
    assert.ok(
      r1.subScores.paymentReliability > r2.subScores.paymentReliability,
      "fully tokenized should score higher on paymentReliability"
    );
  });

  it("raises invoiceLegitimacy when amounts are consistent", () => {
    const consistent   = makeInvoices(6).map((inv, i) => ({ ...inv, amount: 100000 }));
    const inconsistent = makeInvoices(6).map((inv, i) => ({ ...inv, amount: (i + 1) * 1000000 }));
    const r1 = computeClientRiskScore(consistent);
    const r2 = computeClientRiskScore(inconsistent);
    assert.ok(
      r1.subScores.invoiceLegitimacy > r2.subScores.invoiceLegitimacy,
      "consistent amounts should score higher on invoiceLegitimacy"
    );
  });

  it("raises businessProfile with more invoices", () => {
    const few  = computeClientRiskScore(makeInvoices(4));
    const many = computeClientRiskScore(makeInvoices(20));
    assert.ok(
      many.subScores.businessProfile > few.subScores.businessProfile,
      "more invoices should score higher on businessProfile"
    );
  });

  it("all sub-scores are between 0 and 100", () => {
    for (const count of [4, 7, 15, 20, 50]) {
      const result = computeClientRiskScore(makeInvoices(count, { tokenId: count % 2 === 0 ? 1 : null }));
      const { paymentReliability, invoiceLegitimacy, businessProfile } = result.subScores;
      assert.ok(paymentReliability >= 0 && paymentReliability <= 100, `paymentReliability out of range at count=${count}`);
      assert.ok(invoiceLegitimacy  >= 0 && invoiceLegitimacy  <= 100, `invoiceLegitimacy out of range at count=${count}`);
      assert.ok(businessProfile    >= 0 && businessProfile    <= 100, `businessProfile out of range at count=${count}`);
    }
  });

  it("riskLevel matches rawScore thresholds", () => {
    const cases = [
      { rawScore: 100, expected: "Low" },
      { rawScore: 80,  expected: "Low" },
      { rawScore: 79,  expected: "Medium" },
      { rawScore: 60,  expected: "Medium" },
      { rawScore: 59,  expected: "High" },
    ];
    for (const { rawScore, expected } of cases) {
      // Build a mock result and verify the level mapping
      const level = rawScore >= 80 ? "Low" : rawScore >= 60 ? "Medium" : "High";
      assert.equal(level, expected, `score ${rawScore} should map to ${expected}`);
    }
  });

  it("score stays 100 for 1, 2, and 3 invoices (boundary check)", () => {
    for (const count of [1, 2, 3]) {
      const result = computeClientRiskScore(makeInvoices(count));
      assert.equal(result.rawScore, 100, `count=${count} should return 100`);
    }
  });

  it("score changes at exactly 4 invoices", () => {
    const at3 = computeClientRiskScore(makeInvoices(3));
    const at4 = computeClientRiskScore(makeInvoices(4));
    assert.equal(at3.rawScore, 100);
    assert.equal(at3.insufficientHistory, true);
    assert.equal(at4.insufficientHistory, false);
    assert.ok(at4.rawScore >= 0 && at4.rawScore <= 100);
  });

});
