import Chart from "chart.js/auto";
import type { ScriptableContext } from "chart.js";

import {
  loadRealEstateTimeseriesData,
  REAL_ESTATE_CURRENCY,
  REAL_ESTATE_CURRENCY_LABEL,
  REAL_ESTATE_OUTSIDE_MARKET_COLOR,
  type RealEstateMetric,
  type RealEstatePeriodRange,
  type RealEstateResolution,
  type RealEstateTimeseriesRow,
} from "./real-estate-deep-dive-data";
import { mountRealEstateDeepDiveMap, type RealEstateDeepDiveMapController } from "./real-estate-deep-dive-map";

export type RealEstateDeepDiveController = {
  destroy(): void;
  onVisible(): void;
};

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

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatCurrency(value: number | null, fractionDigits = 0): string {
  if (value === null) return "NA";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: REAL_ESTATE_CURRENCY,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

function renderLoadingState(leftSlot: HTMLElement, rightSlot: HTMLElement): void {
  leftSlot.replaceChildren(el("div", "exec-deep-dive__loading-state", "Loading real estate analysis..."));
  rightSlot.replaceChildren(el("div", "exec-deep-dive__loading-state", "Preparing deal map..."));
}

function renderUnavailableState(leftSlot: HTMLElement, rightSlot: HTMLElement): void {
  const unavailable = el("section", "exec-real-estate-unavailable");
  unavailable.appendChild(el("h3", "exec-real-estate-unavailable__title", "Real estate deep dive unavailable"));
  unavailable.appendChild(
    el(
      "p",
      "exec-real-estate-unavailable__copy",
      "The chart source could not be loaded for this executive file. The shell remains available, but this evidence module needs regenerated or reachable data.",
    ),
  );

  const aside = el("section", "exec-real-estate-unavailable exec-real-estate-unavailable--map");
  aside.appendChild(el("h3", "exec-real-estate-unavailable__title", "Spatial view unavailable"));
  aside.appendChild(
    el(
      "p",
      "exec-real-estate-unavailable__copy",
      "The spatial view stays offline until the time-series evidence is available again.",
    ),
  );

  leftSlot.replaceChildren(unavailable);
  rightSlot.replaceChildren(aside);
}

function createSegmentedButtons<T extends string>(
  values: readonly T[],
  labelForValue: Record<T, string>,
  initialValue: T,
  groupLabel: string,
  onChange: (value: T) => void,
): HTMLDivElement {
  const root = el("div", "exec-real-estate__segmented");
  root.setAttribute("role", "group");
  root.setAttribute("aria-label", groupLabel);

  const buttons = new Map<T, HTMLButtonElement>();
  let currentValue = initialValue;

  const syncButtons = () => {
    for (const [value, button] of buttons) {
      const selected = value === currentValue;
      button.dataset.selected = selected ? "true" : "false";
      button.setAttribute("aria-pressed", selected ? "true" : "false");
    }
  };

  for (const value of values) {
    const button = el("button", "exec-real-estate__segment", labelForValue[value]);
    button.type = "button";
    button.addEventListener("click", () => {
      if (currentValue === value) return;
      currentValue = value;
      syncButtons();
      onChange(value);
    });
    buttons.set(value, button);
    root.appendChild(button);
  }

  syncButtons();
  return root;
}

function buildDataset(
  rows: RealEstateTimeseriesRow[],
  metric: RealEstateMetric,
  district: boolean,
): Array<number | null> {
  return rows.map((row) => {
    if (metric === "deals") {
      return district ? row.districtDeals : row.nonDistrictDeals;
    }
    return district ? row.districtMedianPricePerSqm : row.nonDistrictMedianPricePerSqm;
  });
}

function completeRowsForResolution(
  timeseriesData: { monthly: RealEstateTimeseriesRow[]; quarterly: RealEstateTimeseriesRow[] },
  resolution: RealEstateResolution,
): RealEstateTimeseriesRow[] {
  const rows = resolution === "monthly" ? timeseriesData.monthly : timeseriesData.quarterly;
  return rows.filter((row) => row.complete);
}

function defaultRangeForRows(rows: RealEstateTimeseriesRow[], resolution: RealEstateResolution): RealEstatePeriodRange {
  if (rows.length === 0) {
    return { start: "", end: "" };
  }

  const windowSize = resolution === "monthly" ? 36 : 12;
  const startIndex = Math.max(0, rows.length - windowSize);
  return {
    start: rows[startIndex].period,
    end: rows[rows.length - 1].period,
  };
}

function findIndexForPeriod(
  rows: RealEstateTimeseriesRow[],
  period: string,
  fallback: "start" | "end" = "start",
): number {
  const index = rows.findIndex((row) => row.period === period);
  if (index >= 0) return index;
  return fallback === "end" ? Math.max(0, rows.length - 1) : 0;
}

function clampIndex(value: number, max: number): number {
  return Math.max(0, Math.min(max, value));
}

function rangeBubbleOffset(percent: number): string {
  if (percent <= 10) return "0%";
  if (percent >= 90) return "-100%";
  return "-50%";
}

function rangeValueText(
  rows: RealEstateTimeseriesRow[],
  index: number,
  role: "start" | "end",
  resolution: RealEstateResolution,
): string {
  const label = rows[index]?.label ?? "";
  const position = `${index + 1} of ${rows.length}`;
  const resolutionLabel = resolution === "monthly" ? "month" : "quarter";
  return `${role === "start" ? "Start" : "End"} ${resolutionLabel}: ${label} (${position})`;
}

function normalizeRange(
  rows: RealEstateTimeseriesRow[],
  range: RealEstatePeriodRange,
): { startIndex: number; endIndex: number; range: RealEstatePeriodRange } {
  if (rows.length === 0) {
    return {
      startIndex: 0,
      endIndex: 0,
      range: { start: "", end: "" },
    };
  }

  const maxIndex = rows.length - 1;
  const rawStart = clampIndex(findIndexForPeriod(rows, range.start, "start"), maxIndex);
  const rawEnd = clampIndex(findIndexForPeriod(rows, range.end, "end"), maxIndex);
  const startIndex = Math.min(rawStart, rawEnd);
  const endIndex = Math.max(rawStart, rawEnd);
  return {
    startIndex,
    endIndex,
    range: {
      start: rows[startIndex].period,
      end: rows[endIndex].period,
    },
  };
}

export function mountRealEstateDeepDive(
  leftSlot: HTMLElement,
  rightSlot: HTMLElement,
): RealEstateDeepDiveController {
  let destroyed = false;
  let chart: Chart | null = null;
  let mapController: RealEstateDeepDiveMapController | null = null;

  renderLoadingState(leftSlot, rightSlot);

  void (async () => {
    const data = await loadRealEstateTimeseriesData();
    if (destroyed) return;

    if (!data) {
      renderUnavailableState(leftSlot, rightSlot);
      return;
    }
    const timeseriesData = data;

    const state: {
      metric: RealEstateMetric;
      resolution: RealEstateResolution;
      range: RealEstatePeriodRange;
    } = {
      metric: "deals",
      resolution: "quarterly",
      range: defaultRangeForRows(completeRowsForResolution(timeseriesData, "quarterly"), "quarterly"),
    };

    const shell = el("section", "exec-real-estate");
    const header = el("header", "exec-real-estate__header");
    const titleBlock = el("div", "exec-real-estate__title-block");
    titleBlock.appendChild(el("h3", "exec-real-estate__title", "Market activity and pricing"));
    titleBlock.appendChild(
      el(
        "p",
        "exec-real-estate__summary",
        "Compare deal volume and median price per square meter inside the Innovation District against the surrounding Beer Sheva market by month or quarter.",
      ),
    );
    header.appendChild(titleBlock);

    const controls = el("div", "exec-real-estate__controls");
    const metricGroup = el("section", "exec-real-estate__control-group");
    metricGroup.appendChild(el("p", "exec-real-estate__control-label", "Metric"));
    metricGroup.appendChild(
      createSegmentedButtons(
        ["deals", "pricePerSqm"] as const,
        {
          deals: "Number of deals",
          pricePerSqm: `${REAL_ESTATE_CURRENCY_LABEL} per SQM`,
        },
        state.metric,
        "Metric",
        (value) => {
          state.metric = value;
          updateChart();
        },
      ),
    );

    const resolutionGroup = el("section", "exec-real-estate__control-group");
    resolutionGroup.appendChild(el("p", "exec-real-estate__control-label", "Resolution"));
    resolutionGroup.appendChild(
      createSegmentedButtons(
        ["monthly", "quarterly"] as const,
        {
          monthly: "Monthly",
          quarterly: "Quarterly",
        },
        state.resolution,
        "Resolution",
        (value) => {
          state.resolution = value;
          state.range = defaultRangeForRows(currentRows(), state.resolution);
          syncRangeUi();
          updateChart();
          mapController?.setPeriodRange(state.range, state.resolution);
        },
      ),
    );

    controls.appendChild(metricGroup);
    controls.appendChild(resolutionGroup);

    const legend = el("div", "exec-real-estate__legend");
    legend.appendChild(
      el(
        "span",
        "exec-real-estate__legend-item exec-real-estate__legend-item--district",
        "Innovation District",
      ),
    );
    legend.appendChild(
      el(
        "span",
        "exec-real-estate__legend-item exec-real-estate__legend-item--outside",
        "Outside Innovation District",
      ),
    );

    const rangeSection = el("section", "exec-real-estate__range-section");
    const rangeHeader = el("div", "exec-real-estate__range-header");
    rangeHeader.appendChild(el("p", "exec-real-estate__control-label", "Visible range"));
    const rangeLabel = el("p", "exec-real-estate__range-label");
    rangeHeader.appendChild(rangeLabel);

    const rangeControls = el("div", "exec-real-estate__range-controls");
    rangeControls.setAttribute("role", "group");
    rangeControls.setAttribute("aria-label", "Visible range");
    const rangeTrack = el("div", "exec-real-estate__range-track");
    const rangeFill = el("div", "exec-real-estate__range-fill");
    rangeTrack.appendChild(rangeFill);

    const startBubble = el("output", "exec-real-estate__range-bubble exec-real-estate__range-bubble--start");
    startBubble.setAttribute("aria-hidden", "true");
    const startInput = document.createElement("input");
    startInput.type = "range";
    startInput.className = "exec-real-estate__range-input exec-real-estate__range-input--start";
    startInput.step = "1";
    startInput.setAttribute("aria-label", "Range start");

    const endBubble = el("output", "exec-real-estate__range-bubble exec-real-estate__range-bubble--end");
    endBubble.setAttribute("aria-hidden", "true");
    const endInput = document.createElement("input");
    endInput.type = "range";
    endInput.className = "exec-real-estate__range-input exec-real-estate__range-input--end";
    endInput.step = "1";
    endInput.setAttribute("aria-label", "Range end");

    rangeControls.appendChild(rangeTrack);
    rangeControls.appendChild(startBubble);
    rangeControls.appendChild(endBubble);
    rangeControls.appendChild(startInput);
    rangeControls.appendChild(endInput);
    rangeSection.appendChild(rangeHeader);
    rangeSection.appendChild(rangeControls);

    const chartCard = el("div", "exec-real-estate__chart-wrap");
    const canvas = document.createElement("canvas");
    canvas.className = "exec-real-estate__chart";
    canvas.setAttribute("aria-label", "Real estate chart comparing Innovation District and outside district activity");
    chartCard.appendChild(canvas);

    shell.appendChild(header);
    shell.appendChild(controls);
    shell.appendChild(legend);
    shell.appendChild(rangeSection);
    shell.appendChild(chartCard);
    leftSlot.replaceChildren(shell);

    mapController = mountRealEstateDeepDiveMap(rightSlot, state.resolution, state.range);

    function currentRows(): RealEstateTimeseriesRow[] {
      return completeRowsForResolution(timeseriesData, state.resolution);
    }

    function currentVisibleRows(): RealEstateTimeseriesRow[] {
      const rows = currentRows();
      const normalized = normalizeRange(rows, state.range);
      state.range = normalized.range;
      return rows.slice(normalized.startIndex, normalized.endIndex + 1);
    }

    function syncRangeUi(): void {
      const rows = currentRows();
      const normalized = normalizeRange(rows, state.range);
      state.range = normalized.range;
      const maxIndex = rows.length - 1;
      const denominator = Math.max(maxIndex, 1);
      const startPercent = maxIndex === 0 ? 0 : (normalized.startIndex / denominator) * 100;
      const endPercent = maxIndex === 0 ? 100 : (normalized.endIndex / denominator) * 100;
      const fillWidth = Math.max(0, endPercent - startPercent);

      startInput.min = "0";
      startInput.max = String(maxIndex);
      endInput.min = "0";
      endInput.max = String(maxIndex);
      startInput.value = String(normalized.startIndex);
      endInput.value = String(normalized.endIndex);
      startInput.setAttribute("aria-valuemin", "0");
      startInput.setAttribute("aria-valuemax", String(maxIndex));
      startInput.setAttribute("aria-valuenow", String(normalized.startIndex));
      startInput.setAttribute("aria-valuetext", rangeValueText(rows, normalized.startIndex, "start", state.resolution));
      endInput.setAttribute("aria-valuemin", "0");
      endInput.setAttribute("aria-valuemax", String(maxIndex));
      endInput.setAttribute("aria-valuenow", String(normalized.endIndex));
      endInput.setAttribute("aria-valuetext", rangeValueText(rows, normalized.endIndex, "end", state.resolution));
      startBubble.value = rows[normalized.startIndex].label;
      startBubble.textContent = rows[normalized.startIndex].label;
      endBubble.value = rows[normalized.endIndex].label;
      endBubble.textContent = rows[normalized.endIndex].label;
      rangeControls.style.setProperty("--range-start-pct", `${startPercent}%`);
      rangeControls.style.setProperty("--range-end-pct", `${endPercent}%`);
      rangeControls.style.setProperty("--range-fill-left", `${startPercent}%`);
      rangeControls.style.setProperty("--range-fill-width", `${fillWidth}%`);
      rangeControls.style.setProperty("--range-start-ratio", String(startPercent / 100));
      rangeControls.style.setProperty("--range-end-ratio", String(endPercent / 100));
      rangeControls.style.setProperty("--range-start-bubble-x", rangeBubbleOffset(startPercent));
      rangeControls.style.setProperty("--range-end-bubble-x", rangeBubbleOffset(endPercent));
      rangeControls.dataset.overlap = fillWidth <= 12 ? "true" : "false";

      rangeLabel.textContent = `${rows[normalized.startIndex].label} - ${rows[normalized.endIndex].label}`;
    }

    function applyRangeFromInputs(changedBy: "start" | "end"): void {
      const rows = currentRows();
      const maxIndex = rows.length - 1;
      let startIndex = clampIndex(Number(startInput.value), maxIndex);
      let endIndex = clampIndex(Number(endInput.value), maxIndex);

      if (changedBy === "start" && startIndex > endIndex) {
        endIndex = startIndex;
        endInput.value = String(endIndex);
      }

      if (changedBy === "end" && endIndex < startIndex) {
        startIndex = endIndex;
        startInput.value = String(startIndex);
      }

      state.range = {
        start: rows[startIndex].period,
        end: rows[endIndex].period,
      };

      syncRangeUi();
      updateChart();
      mapController?.setPeriodRange(state.range, state.resolution);
    }

    startInput.addEventListener("input", () => {
      applyRangeFromInputs("start");
    });

    endInput.addEventListener("input", () => {
      applyRangeFromInputs("end");
    });

    function updateChart(): void {
      const rows = currentVisibleRows();

      if (!chart) {
        chart = new Chart(canvas, {
          type: "line",
          data: {
            labels: rows.map((row) => row.label),
            datasets: [],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
              mode: "nearest",
              intersect: false,
            },
            plugins: {
              legend: {
                display: false,
              },
              tooltip: {
                callbacks: {
                  label(context) {
                    const label = context.dataset.label ?? "";
                    const value = context.parsed.y as number | null;
                    return `${label}: ${
                      state.metric === "pricePerSqm" ? formatCurrency(value, 0) : formatCount(value ?? 0)
                    }`;
                  },
                },
              },
            },
            scales: {
              x: {
                ticks: {
                  maxRotation: 0,
                  autoSkip: true,
                  color: "#49454f",
                },
                grid: {
                  display: false,
                },
              },
              y: {
                beginAtZero: state.metric === "deals",
                ticks: {
                  color: "#49454f",
                  callback(value) {
                    return state.metric === "pricePerSqm"
                      ? formatCurrency(Number(value), 0)
                      : formatCount(Number(value));
                  },
                },
                grid: {
                  color: "rgba(16, 19, 23, 0.08)",
                },
              },
            },
          },
        });
      }

      chart.data.labels = rows.map((row) => row.label);
      if (chart.options.scales?.y) {
        (chart.options.scales.y as { beginAtZero?: boolean }).beginAtZero = state.metric === "deals";
      }
      chart.data.datasets = [
        {
          label: "Innovation District",
          data: buildDataset(rows, state.metric, true),
          borderColor: "#875800",
          backgroundColor: "rgba(135, 88, 0, 0.12)",
          borderWidth: 2.6,
          pointRadius: (_context: ScriptableContext<"line">) => 3,
          pointHoverRadius: 5,
          pointBackgroundColor: "#875800",
          pointBorderColor: "#fff8ea",
          pointBorderWidth: 1.4,
          spanGaps: false,
          tension: 0.22,
        },
        {
          label: "Outside Innovation District",
          data: buildDataset(rows, state.metric, false),
          borderColor: REAL_ESTATE_OUTSIDE_MARKET_COLOR,
          backgroundColor: "rgba(77, 124, 130, 0.1)",
          borderWidth: 2.2,
          pointRadius: (_context: ScriptableContext<"line">) => 3,
          pointHoverRadius: 5,
          pointBackgroundColor: REAL_ESTATE_OUTSIDE_MARKET_COLOR,
          pointBorderColor: "#f5fbfc",
          pointBorderWidth: 1.2,
          spanGaps: false,
          tension: 0.18,
        },
      ];

      syncRangeUi();
      chart.update();
    }

    syncRangeUi();
    updateChart();
  })();

  return {
    destroy() {
      destroyed = true;
      chart?.destroy();
      chart = null;
      mapController?.destroy();
      mapController = null;
    },
    onVisible() {
      chart?.resize();
      mapController?.resize();
    },
  };
}
