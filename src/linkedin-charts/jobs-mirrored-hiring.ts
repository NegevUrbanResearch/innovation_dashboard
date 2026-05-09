import { formatLocaleInt, getLocale, t } from "../i18n";
import {
  chartBorderColor,
  jobsFlowRankColor,
} from "./chart-theme";
import {
  buildJobsMirroredModel,
  type JobsMirroredEntry,
  type JobsMirroredRow,
} from "./jobs-mirrored-model";

type JobsMirroredHiringMountData = {
  inboundEmployers: JobsMirroredEntry[];
  outboundEmployers: JobsMirroredEntry[];
  inboundTotalMentions: number;
  outboundTotalMentions: number;
  feederCities: JobsMirroredEntry[];
  destinationCities: JobsMirroredEntry[];
  topEmployerCount?: number;
  topCityCount?: number;
};

type FlowView = "companies" | "cities";

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

function formatPercent(p: number): string {
  const loc = getLocale() === "he" ? "he-IL" : "en-US";
  return new Intl.NumberFormat(loc, {
    style: "percent",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(p);
}

function sumCounts(rows: JobsMirroredEntry[]): number {
  return rows.reduce((sum, row) => sum + row.count, 0);
}

function sideLabel(view: FlowView, side: "inbound" | "outbound"): string {
  if (view === "companies") {
    return side === "inbound"
      ? t("chart.jobsFlowInboundEmployers")
      : t("chart.jobsFlowOutboundEmployers");
  }
  return side === "inbound"
    ? t("chart.jobsFlowFeederCities")
    : t("chart.jobsFlowDestinationCities");
}

export function mountJobsMirroredHiring(
  host: HTMLElement,
  data: JobsMirroredHiringMountData,
): () => void {
  const topEmployerCount = data.topEmployerCount ?? 14;
  const topCityCount = data.topCityCount ?? 12;
  let viewMode: FlowView = "companies";

  host.classList.add("jobs-flow", "chart-custom-plot");

  const toolbar = el("div", "jobs-flow__toolbar");
  const toggle = el("div", "jobs-flow__toggle");
  const companiesBtn = el("button", "jobs-flow__toggle-btn");
  const citiesBtn = el("button", "jobs-flow__toggle-btn");
  companiesBtn.type = "button";
  citiesBtn.type = "button";
  companiesBtn.dataset.view = "companies";
  citiesBtn.dataset.view = "cities";
  toggle.append(companiesBtn, citiesBtn);
  toolbar.appendChild(toggle);

  const stage = el("div", "jobs-flow__stage");
  const outboundCol = el("div", "jobs-flow__col jobs-flow__col--outbound");
  const outboundRows = el("div", "jobs-flow__rows jobs-flow__rows--outbound");
  const centerCol = el("div", "jobs-flow__center");
  const inboundCol = el("div", "jobs-flow__col jobs-flow__col--inbound");
  const inboundRows = el("div", "jobs-flow__rows jobs-flow__rows--inbound");
  stage.append(outboundCol, centerCol, inboundCol);

  const tooltip = el("div", "jobs-flow__tooltip");
  tooltip.hidden = true;
  tooltip.setAttribute("aria-hidden", "true");

  host.append(toolbar, stage, tooltip);

  function hideTooltip(): void {
    tooltip.hidden = true;
    tooltip.textContent = "";
  }

  function showTooltip(ev: MouseEvent | FocusEvent, lines: string[]): void {
    tooltip.replaceChildren();
    for (let i = 0; i < lines.length; i++) {
      tooltip.appendChild(el("div", i === 0 ? "jobs-flow__tip-title" : "jobs-flow__tip-line", lines[i]));
    }
    tooltip.hidden = false;
    void tooltip.offsetWidth;
    const gap = 14;
    const point =
      ev instanceof MouseEvent
        ? { x: ev.clientX, y: ev.clientY }
        : (() => {
            const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect();
            return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
          })();
    let left = point.x + gap;
    let top = point.y + gap;
    if (left + tooltip.offsetWidth > window.innerWidth - 8) left = point.x - tooltip.offsetWidth - gap;
    if (top + tooltip.offsetHeight > window.innerHeight - 8) top = point.y - tooltip.offsetHeight - gap;
    tooltip.style.left = `${Math.max(8, left)}px`;
    tooltip.style.top = `${Math.max(8, top)}px`;
  }

  function makeSideHeader(label: string, total: number): HTMLDivElement {
    const head = el("div", "jobs-flow__side-head");
    head.append(
      el("span", "jobs-flow__side-head-label", label),
      el("span", "jobs-flow__side-head-count", formatLocaleInt(total)),
    );
    return head;
  }

  function makeRow(
    side: "inbound" | "outbound",
    labelText: string,
    row: JobsMirroredRow,
    maxVisibleCount: number,
    totalRanks: number,
  ): HTMLDivElement {
    const rowEl = el("div", `jobs-flow__row jobs-flow__row--${side}`);
    rowEl.tabIndex = 0;
    rowEl.setAttribute("role", "group");

    const text = el("span", "jobs-flow__row-text");
    const line = el("span", "jobs-flow__row-line");
    line.append(
      el("span", "jobs-flow__row-label", row.label),
      el("span", "jobs-flow__row-count", formatLocaleInt(row.count)),
    );
    text.appendChild(line);

    const barWrap = el("span", "jobs-flow__bar-wrap");
    const bar = el("span", "jobs-flow__bar");
    const widthPct = maxVisibleCount > 0 ? (row.count / maxVisibleCount) * 100 : 0;
    bar.style.width = `${Math.max(0, Math.min(100, widthPct))}%`;
    bar.style.background = jobsFlowRankColor(side, row.rank, totalRanks);
    bar.style.borderColor = chartBorderColor();
    barWrap.appendChild(bar);

    if (side === "outbound") rowEl.append(text, barWrap);
    else rowEl.append(barWrap, text);

    const tipLines = [
      row.label,
      `${formatLocaleInt(row.count)} · ${formatPercent(row.shareOfSide)}`,
      labelText,
    ];
    rowEl.setAttribute("aria-label", tipLines.join(". "));
    rowEl.addEventListener("mousemove", (ev) => showTooltip(ev, tipLines));
    rowEl.addEventListener("mouseleave", hideTooltip);
    rowEl.addEventListener("focus", (ev) => showTooltip(ev, tipLines));
    rowEl.addEventListener("blur", hideTooltip);
    return rowEl;
  }

  function render(): void {
    hideTooltip();
    const showingCompanies = viewMode === "companies";
    const outboundEntries = showingCompanies ? data.outboundEmployers : data.destinationCities;
    const inboundEntries = showingCompanies ? data.inboundEmployers : data.feederCities;
    const outboundTotal = showingCompanies ? data.outboundTotalMentions : sumCounts(data.destinationCities);
    const inboundTotal = showingCompanies ? data.inboundTotalMentions : sumCounts(data.feederCities);
    const model = buildJobsMirroredModel({
      inboundEmployers: inboundEntries,
      outboundEmployers: outboundEntries,
      inboundTotalMentions: inboundTotal,
      outboundTotalMentions: outboundTotal,
      topN: showingCompanies ? topEmployerCount : topCityCount,
    });
    const outboundLabel = sideLabel(viewMode, "outbound");
    const inboundLabel = sideLabel(viewMode, "inbound");
    const rtl = getLocale() === "he";

    host.setAttribute("dir", rtl ? "rtl" : "ltr");
    tooltip.setAttribute("dir", rtl ? "rtl" : "ltr");

    companiesBtn.textContent = t("chart.toggleCompanies");
    citiesBtn.textContent = t("chart.toggleCities");
    companiesBtn.classList.toggle("is-active", showingCompanies);
    citiesBtn.classList.toggle("is-active", !showingCompanies);
    companiesBtn.setAttribute("aria-pressed", showingCompanies ? "true" : "false");
    citiesBtn.setAttribute("aria-pressed", !showingCompanies ? "true" : "false");

    outboundRows.replaceChildren();
    inboundRows.replaceChildren();
    outboundCol.replaceChildren(makeSideHeader(outboundLabel, model.outboundTotalMentions), outboundRows);
    inboundCol.replaceChildren(makeSideHeader(inboundLabel, model.inboundTotalMentions), inboundRows);
    centerCol.replaceChildren(el("div", "jobs-flow__center-rail"));

    for (const row of model.outboundRows) {
      outboundRows.appendChild(
        makeRow("outbound", outboundLabel, row, model.maxVisibleCount, model.outboundRows.length),
      );
    }
    for (const row of model.inboundRows) {
      inboundRows.appendChild(
        makeRow("inbound", inboundLabel, row, model.maxVisibleCount, model.inboundRows.length),
      );
    }
  }

  const onExternal = (): void => render();
  const onKeyDown = (ev: KeyboardEvent): void => {
    if (ev.key === "Escape") hideTooltip();
  };
  const onToggleClick = (ev: Event): void => {
    const btn = (ev.target as HTMLElement).closest<HTMLButtonElement>("button[data-view]");
    if (!btn) return;
    const next = btn.dataset.view;
    if (next !== "companies" && next !== "cities") return;
    if (next === viewMode) return;
    viewMode = next;
    render();
  };

  window.addEventListener("bsid-theme-change", onExternal);
  window.addEventListener("bsid-locale-change", onExternal);
  host.addEventListener("keydown", onKeyDown);
  toolbar.addEventListener("click", onToggleClick);

  render();

  return () => {
    window.removeEventListener("bsid-theme-change", onExternal);
    window.removeEventListener("bsid-locale-change", onExternal);
    host.removeEventListener("keydown", onKeyDown);
    toolbar.removeEventListener("click", onToggleClick);
    host.removeAttribute("dir");
    host.replaceChildren();
    host.classList.remove("jobs-flow", "chart-custom-plot");
  };
}
