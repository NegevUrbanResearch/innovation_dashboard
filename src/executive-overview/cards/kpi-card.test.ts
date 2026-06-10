import test from "node:test";
import assert from "node:assert/strict";

import { mountKpiCard } from "./kpi-card.ts";
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
    periodLabel: "Q1 2026",
    currentValue: "20",
    baselineValue: "37",
    deltaValue: "-17",
    deltaDirection: "down",
    baselinePeriodLabel: "Q1 2025",
    forecastDateLabel: "Q1 2027",
    forecastValueLabel: NA,
    ...overrides,
  };
}

test("mountKpiCard places delta pill on baseline row before vs.", () => {
  const card = mountKpiCard(sampleCard()) as unknown as MockNode;

  const valueRow = card.querySelector(".exec-kpi-card__value-row");
  const baseline = card.querySelector(".exec-kpi-card__baseline");
  const delta = baseline?.querySelector(".exec-kpi-card__delta--negative");

  assert.ok(valueRow);
  assert.equal(valueRow?.querySelector(".exec-kpi-card__delta"), null);
  assert.ok(baseline);
  assert.ok(delta);
  assert.equal(delta?.querySelector(".exec-kpi-card__delta-value")?.textContent, "-17");
  assert.match(baseline?.innerText ?? "", /^-17/);
  assert.match(baseline?.innerText ?? "", /compared to Q1 2025 \(37\)/);
});

test("mountKpiCard omits delta pill when delta is unavailable", () => {
  const card = mountKpiCard(
    sampleCard({
      currentValue: NA,
      deltaValue: NA,
      deltaDirection: undefined,
      baselineValue: NA,
      baselinePeriodLabel: NA,
    }),
  ) as unknown as MockNode;

  assert.equal(card.classList.contains("exec-kpi-card--empty"), true);
  assert.equal(card.querySelector(".exec-kpi-card__delta"), null);
});
