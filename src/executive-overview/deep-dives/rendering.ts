import type { KpiCardModel } from "../types.ts";

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

export function renderUnavailableDeepDive(
  card: KpiCardModel,
  leftSlot: HTMLElement,
  rightSlot: HTMLElement,
): void {
  const unavailable = el("section", "exec-deep-dive__placeholder exec-deep-dive__placeholder--unavailable");
  unavailable.appendChild(el("h3", "exec-deep-dive__placeholder-title", `${card.kpiName} is not available yet`));
  unavailable.appendChild(
    el(
      "p",
      "exec-deep-dive__placeholder-copy",
      "This KPI does not have a deep-dive content module wired into the shell yet.",
    ),
  );
  leftSlot.appendChild(unavailable);
  rightSlot.appendChild(el("div", "exec-deep-dive__loading-state", "Deep-dive content unavailable"));
}
