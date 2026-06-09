import assert from "node:assert/strict";
import test from "node:test";

import { renderUnavailableDeepDive } from "./deep-dive-rendering.ts";
import { NA, type KpiCardModel } from "./types.ts";

class MockNode {
  tagName: string;
  className = "";
  textContent = "";
  children: Array<MockNode | TextNode> = [];
  parent: MockNode | null = null;

  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase();
  }

  appendChild(child: MockNode): MockNode {
    child.parent = this;
    this.children.push(child);
    return child;
  }

  get innerText(): string {
    return `${this.textContent}${this.children.map((child) => child.innerText).join("")}`;
  }
}

class TextNode {
  innerText: string;

  constructor(text: string) {
    this.innerText = text;
  }
}

const documentStub = {
  createElement<K extends keyof HTMLElementTagNameMap>(tag: K): HTMLElementTagNameMap[K] {
    return new MockNode(tag) as unknown as HTMLElementTagNameMap[K];
  },
};

Object.assign(globalThis, { document: documentStub });

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
