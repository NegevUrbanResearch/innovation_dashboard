import test from "node:test";
import assert from "node:assert/strict";

import { mountKpiCard } from "./kpi-card.ts";
import { NA, type KpiCardModel } from "./types.ts";

class MockNode {
  tagName: string;
  className = "";
  dir = "";
  dataset: Record<string, string> = {};
  textContent = "";
  children: MockNode[] = [];
  attributes: Record<string, string> = {};
  parent: MockNode | null = null;

  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase();
  }

  appendChild(child: MockNode): MockNode {
    child.parent = this;
    this.children.push(child);
    return child;
  }

  append(...nodes: Array<MockNode | string>): void {
    for (const node of nodes) {
      if (typeof node === "string") {
        this.children.push(new TextNode(node));
      } else {
        this.appendChild(node);
      }
    }
  }

  setAttribute(name: string, value: string): void {
    this.attributes[name] = value;
  }

  getAttribute(name: string): string | null {
    return this.attributes[name] ?? null;
  }

  addEventListener(): void {}

  get classList() {
    const classes = new Set(this.className.split(/\s+/).filter(Boolean));
    return {
      contains: (name: string) => classes.has(name),
      add: (...names: string[]) => {
        for (const name of names) classes.add(name);
        this.className = [...classes].join(" ");
      },
    };
  }

  querySelector(selector: string): MockNode | null {
    const match = selector.match(/^\.(.+)$/);
    if (!match) return null;
    const className = match[1];
    const stack = [...this.children];
    while (stack.length) {
      const node = stack.shift()!;
      if (node instanceof TextNode) continue;
      if (node.className.split(/\s+/).includes(className)) return node;
      stack.push(...node.children.filter((child) => child instanceof MockNode));
    }
    return null;
  }

  get innerText(): string {
    return this.collectText();
  }

  private collectText(): string {
    const childText = this.children
      .map((child) => (child instanceof TextNode ? child.text : child.collectText()))
      .join("");
    return `${this.textContent ?? ""}${childText}`;
  }
}

class TextNode {
  text: string;
  constructor(text: string) {
    this.text = text;
  }
}

class MockSVGElement extends MockNode {
  constructor(tagName: string) {
    super(tagName);
  }
}

const documentStub = {
  createElement<K extends keyof HTMLElementTagNameMap>(tag: K): HTMLElementTagNameMap[K] {
    return new MockNode(tag) as unknown as HTMLElementTagNameMap[K];
  },
  createElementNS(_ns: string, tag: string): SVGSVGElement {
    return new MockSVGElement(tag) as unknown as SVGSVGElement;
  },
};

Object.assign(globalThis, { document: documentStub });

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
