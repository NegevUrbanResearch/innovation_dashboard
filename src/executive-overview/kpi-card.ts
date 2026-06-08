import { COPY } from "./copy";
import { NA, type KpiCategory, type KpiDeltaDirection, type KpiDisplayFields } from "./types";

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

function resolveDeltaDirection(
  deltaValue: string,
  explicit?: KpiDeltaDirection,
): KpiDeltaDirection | null {
  if (explicit) return explicit;
  if (deltaValue === NA) return null;
  if (deltaValue.startsWith("+")) return "up";
  if (deltaValue.startsWith("-")) return "down";
  return "flat";
}

function deltaToneClass(direction: KpiDeltaDirection): string {
  if (direction === "up") return "positive";
  if (direction === "down") return "negative";
  return "flat";
}

function deltaModifierClass(direction: KpiDeltaDirection): string {
  return `exec-kpi-card__delta exec-kpi-card__delta--${deltaToneClass(direction)}`;
}

function createDeltaArrowIcon(direction: "up" | "down"): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("class", `exec-kpi-card__delta-arrow exec-kpi-card__delta-arrow--${direction}`);
  svg.setAttribute("aria-hidden", "true");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  if (direction === "up") {
    path.setAttribute("d", "M8 2.75 2.5 9.25h11L8 2.75Z");
  } else {
    path.setAttribute("d", "M8 13.25 13.5 6.75h-11L8 13.25Z");
  }

  svg.appendChild(path);
  return svg;
}

function createDeltaFlatIcon(): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("class", "exec-kpi-card__delta-flat");
  svg.setAttribute("aria-hidden", "true");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M3.5 8h9");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "2");
  path.setAttribute("stroke-linecap", "round");

  svg.appendChild(path);
  return svg;
}

function mountDeltaIndicator(direction: KpiDeltaDirection): SVGSVGElement {
  if (direction === "up" || direction === "down") {
    return createDeltaArrowIcon(direction);
  }
  return createDeltaFlatIcon();
}

function mountDeltaBadge(fields: KpiDisplayFields): HTMLElement | null {
  const direction = resolveDeltaDirection(fields.deltaValue, fields.deltaDirection);
  if (!direction) return null;

  const badge = el("span", deltaModifierClass(direction));
  badge.appendChild(numericSpan("exec-kpi-card__delta-value", fields.deltaValue));
  badge.appendChild(mountDeltaIndicator(direction));
  return badge;
}

function mountValueRow(fields: KpiDisplayFields): HTMLElement {
  const row = el("div", "exec-kpi-card__value-row");
  const wrap = el("span", "exec-kpi-card__value-wrap");
  wrap.appendChild(numericSpan("exec-kpi-card__value", fields.currentValue));

  const deltaBadge = mountDeltaBadge(fields);
  if (deltaBadge) wrap.appendChild(deltaBadge);

  row.appendChild(wrap);
  return row;
}

export function mountKpiCard(
  fields: KpiDisplayFields,
  category: KpiCategory,
): HTMLElement {
  const isEmpty = fields.currentValue === NA;
  const card = el(
    "article",
    `exec-kpi-card exec-kpi-card--${category}${isEmpty ? " exec-kpi-card--empty" : ""}`,
  );
  card.dataset.category = category;

  const header = el("header", "exec-kpi-card__header");
  header.appendChild(el("h3", "exec-kpi-card__name", fields.kpiName));

  const body = el("div", "exec-kpi-card__body");
  body.appendChild(el("p", "exec-kpi-card__period", fields.periodLabel));
  body.appendChild(mountValueRow(fields));

  const baselineRow = el("div", "exec-kpi-card__baseline");
  baselineRow.append(`${COPY.vs} `);
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
