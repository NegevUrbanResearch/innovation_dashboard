import { COPY } from "./copy";
import type { KpiCategory, KpiDisplayFields } from "./types";

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function numericSpan(className: string, text: string): HTMLSpanElement {
  const span = el("span", className, text);
  span.dir = "ltr";
  return span;
}

function deltaClass(deltaValue: string): string {
  if (deltaValue.startsWith("+")) return "exec-kpi-card__delta-value exec-kpi-card__delta-value--positive";
  if (deltaValue.startsWith("-")) return "exec-kpi-card__delta-value exec-kpi-card__delta-value--negative";
  return "exec-kpi-card__delta-value";
}

export function mountKpiCard(
  fields: KpiDisplayFields,
  category: KpiCategory,
): HTMLElement {
  const card = el("article", `exec-kpi-card exec-kpi-card--${category}`);
  card.dataset.category = category;

  const header = el("header", "exec-kpi-card__header");
  header.appendChild(el("h3", "exec-kpi-card__name", fields.kpiName));

  const body = el("div", "exec-kpi-card__body");
  body.appendChild(el("p", "exec-kpi-card__period", fields.periodLabel));
  body.appendChild(numericSpan("exec-kpi-card__value", fields.currentValue));

  const baselineRow = el("div", "exec-kpi-card__baseline");
  baselineRow.appendChild(
    numericSpan(deltaClass(fields.deltaValue), fields.deltaValue),
  );
  baselineRow.append(` ${COPY.vs} `);
  baselineRow.appendChild(
    el("span", "exec-kpi-card__baseline-period", fields.baselinePeriodLabel),
  );
  baselineRow.append(" (");
  baselineRow.appendChild(
    numericSpan("exec-kpi-card__baseline-value", fields.baselineValue),
  );
  baselineRow.append(")");
  body.appendChild(baselineRow);

  const footer = el("footer", "exec-kpi-card__footer");
  const targetLine = el("p", "exec-kpi-card__footer-line exec-kpi-card__footer-line--target");
  targetLine.append(`${COPY.footerTargetPrefix} `);
  targetLine.appendChild(
    numericSpan("exec-kpi-card__footer-value", fields.forecastValueLabel),
  );

  const updateLine = el("p", "exec-kpi-card__footer-line exec-kpi-card__footer-line--next-update");
  updateLine.append(`${COPY.footerNextUpdatePrefix} `);
  updateLine.appendChild(
    numericSpan("exec-kpi-card__footer-date", fields.forecastDateLabel),
  );

  footer.appendChild(targetLine);
  footer.appendChild(updateLine);

  card.appendChild(header);
  card.appendChild(body);
  card.appendChild(footer);
  return card;
}
