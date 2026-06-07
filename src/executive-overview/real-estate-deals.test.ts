import test from "node:test";
import assert from "node:assert/strict";

import { realEstateDealsFields } from "./real-estate-deals.ts";

test("realEstateDealsFields maps precomputed payload to card fields", () => {
  const fields = realEstateDealsFields("Real Estate Deals", {
    periodLabel: "Q1 2026",
    currentValue: "20",
    deltaValue: "-9",
    deltaDirection: "down",
    baselinePeriodLabel: "Q4 2025",
    baselineValue: "29",
    nextUpdateLabel: "Q2 2026",
  });

  assert.equal(fields.periodLabel, "Q1 2026");
  assert.equal(fields.currentValue, "20");
  assert.equal(fields.deltaValue, "-9");
  assert.equal(fields.deltaDirection, "down");
  assert.equal(fields.baselinePeriodLabel, "Q4 2025");
  assert.equal(fields.baselineValue, "29");
  assert.equal(fields.forecastDateLabel, "Q2 2026");
});

test("realEstateDealsFields returns NA when payload is missing", () => {
  const fields = realEstateDealsFields("Real Estate Deals", null);
  assert.equal(fields.currentValue, "NA");
  assert.equal(fields.forecastDateLabel, "NA");
});
