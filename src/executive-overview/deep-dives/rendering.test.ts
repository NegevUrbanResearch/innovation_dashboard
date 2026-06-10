import assert from "node:assert/strict";
import test from "node:test";

import { renderUnavailableDeepDive } from "./rendering.ts";
import { NA, type KpiCardModel } from "../types.ts";
import { installMockDocument, MockNode } from "../../test/dom-harness.ts";

const restoreDocument = installMockDocument();
test.after(() => {
  restoreDocument();
});

function sampleCard(overrides: Partial<KpiCardModel> = {}): KpiCardModel {
  return {
    id: "physical-real-estate-deals",
    category: "physical",
    kpiName: "Real Estate Deals",
    dataSource: "real-estate-deals",
    periodLabel: "Q1 2026",
    currentValue: "20",
    baselineValue: "37",
    deltaValue: NA,
    baselinePeriodLabel: "Q1 2025",
    forecastDateLabel: "Q1 2027",
    forecastValueLabel: NA,
    ...overrides,
  };
}

test("renderUnavailableDeepDive renders the unavailable placeholder copy", () => {
  const left = document.createElement("div");
  const right = document.createElement("div");

  renderUnavailableDeepDive(sampleCard({ deepDive: undefined }), left, right);

  assert.match((left as unknown as MockNode).innerText, /Real Estate Deals is not available yet/);
  assert.match((right as unknown as MockNode).innerText, /Deep-dive content unavailable/);
});
