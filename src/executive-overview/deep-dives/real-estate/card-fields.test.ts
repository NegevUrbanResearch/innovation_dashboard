import test from "node:test";
import assert from "node:assert/strict";

import { loadRealEstateDealsKpi, realEstateDealsFields } from "./card-fields.ts";

test("realEstateDealsFields maps precomputed payload to card fields", () => {
  const fields = realEstateDealsFields("Real Estate Deals", {
    periodLabel: "Q1 2026",
    currentValue: "20",
    deltaValue: "-17",
    deltaDirection: "down",
    baselinePeriodLabel: "Q1 2025",
    baselineValue: "37",
    nextUpdateLabel: "Q1 2027",
  });

  assert.equal(fields.periodLabel, "Q1 2026");
  assert.equal(fields.currentValue, "20");
  assert.equal(fields.deltaValue, "-17");
  assert.equal(fields.deltaDirection, "down");
  assert.equal(fields.baselinePeriodLabel, "Q1 2025");
  assert.equal(fields.baselineValue, "37");
  assert.equal(fields.forecastDateLabel, "Q1 2027");
});

test("realEstateDealsFields returns NA when payload is missing", () => {
  const fields = realEstateDealsFields("Real Estate Deals", null);
  assert.equal(fields.currentValue, "NA");
  assert.equal(fields.forecastDateLabel, "NA");
});

test("loadRealEstateDealsKpi returns null for malformed payloads", async () => {
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = async () =>
      Response.json({
        periodLabel: "Q1 2026",
        currentValue: "20",
        deltaValue: "-17",
        deltaDirection: "sideways",
        baselinePeriodLabel: "Q1 2025",
        baselineValue: "37",
        nextUpdateLabel: "Q1 2027",
      });

    assert.equal(await loadRealEstateDealsKpi(), null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
