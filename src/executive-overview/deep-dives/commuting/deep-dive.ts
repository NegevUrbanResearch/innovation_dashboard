import Chart from "chart.js/auto";

import {
  COMMUTING_DESTINATION_LABELS,
  formatHour,
  hourlyForScope,
  loadCommutingData,
  modeSplitForScope,
  totalForScope,
  type CommutingData,
  type CommutingDestination,
  type CommutingScope,
} from "./data.ts";
import { mountCommutingMap, type CommutingMapController } from "./map.ts";

export type CommutingDeepDiveController = {
  destroy(): void;
  onVisible(): void;
};

const PHYSICAL_ACCENT = "#875800";
const SCOPES: CommutingScope[] = ["all", "BGU", "Soroka Hospital", "Gav Yam"];

const MODE_COLORS: Record<string, string> = {
  Car: "#875800",
  Walking: "#0f8e4a",
  "Public Transit": "#4d7c82",
  Train: "#74094a",
  Bike: "#368393",
  "Shared Mobility": "#9b8458",
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
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatCompact(value: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function modeColor(mode: string): string {
  return MODE_COLORS[mode] ?? "#79747e";
}

function renderLoadingState(leftSlot: HTMLElement, rightSlot: HTMLElement): void {
  leftSlot.replaceChildren(el("div", "exec-deep-dive__loading-state", "Loading commuter analysis..."));
  rightSlot.replaceChildren(el("div", "exec-deep-dive__loading-state", "Preparing walking map..."));
}

function renderUnavailableState(leftSlot: HTMLElement, rightSlot: HTMLElement): void {
  const unavailable = el("section", "exec-commuting-unavailable");
  unavailable.appendChild(el("h3", "exec-commuting-unavailable__title", "Commuter deep dive unavailable"));
  unavailable.appendChild(
    el(
      "p",
      "exec-commuting-unavailable__copy",
      "The mobility source files could not be loaded. The shell stays available, but this evidence module needs reachable temporal and mode-split data.",
    ),
  );
  leftSlot.replaceChildren(unavailable);
  rightSlot.replaceChildren(el("div", "exec-deep-dive__loading-state", "Map unavailable"));
}

function segmentLabel(scope: CommutingScope): string {
  if (scope === "all") return "All";
  if (scope === "BGU") return "BGU";
  if (scope === "Soroka Hospital") return "Soroka";
  return "Gav-Yam";
}

function createSegmentedButtons(
  values: readonly CommutingScope[],
  getScope: () => CommutingScope,
  onSelect: (value: CommutingScope) => void,
): { root: HTMLDivElement; sync: () => void } {
  const root = el("div", "exec-commuting__segmented");
  root.setAttribute("role", "group");
  root.setAttribute("aria-label", "Destination");

  const buttons = new Map<CommutingScope, HTMLButtonElement>();

  const sync = () => {
    const current = getScope();
    for (const [value, button] of buttons) {
      const selected = value === current;
      button.dataset.selected = selected ? "true" : "false";
      button.setAttribute("aria-pressed", selected ? "true" : "false");
    }
  };

  for (const value of values) {
    const button = el("button", "exec-commuting__segment", segmentLabel(value));
    button.type = "button";
    button.addEventListener("click", () => onSelect(value));
    buttons.set(value, button);
    root.appendChild(button);
  }

  sync();
  return { root, sync };
}

function buildModeSplitBar(data: CommutingData, scope: CommutingScope): HTMLElement {
  const wrap = el("section", "exec-commuting__modes");
  wrap.appendChild(el("p", "exec-commuting__section-label", "Mode of arrival"));

  const slices = modeSplitForScope(data, scope).filter((slice) => slice.percentage >= 0.05);
  const bar = el("div", "exec-commuting__mode-bar");
  bar.setAttribute("role", "img");
  bar.setAttribute(
    "aria-label",
    slices.map((slice) => `${slice.mode} ${slice.percentage.toFixed(1)} percent`).join(", "),
  );
  for (const slice of slices) {
    const segment = el("span", "exec-commuting__mode-segment");
    segment.style.width = `${slice.percentage}%`;
    segment.style.background = modeColor(slice.mode);
    segment.title = `${slice.mode}: ${slice.percentage.toFixed(1)}%`;
    bar.appendChild(segment);
  }
  wrap.appendChild(bar);

  const legend = el("div", "exec-commuting__mode-legend");
  for (const slice of slices) {
    const item = el("span", "exec-commuting__mode-legend-item");
    const dot = el("span", "exec-commuting__mode-dot");
    dot.style.background = modeColor(slice.mode);
    item.appendChild(dot);
    item.appendChild(el("span", undefined, `${slice.mode} ${slice.percentage.toFixed(0)}%`));
    legend.appendChild(item);
  }
  wrap.appendChild(legend);
  return wrap;
}

function buildInfoModal(anchor: HTMLElement): { open(): void; destroy(): void } {
  let overlay: HTMLDivElement | null = null;

  const sections: Array<{ title: string; items: string[] }> = [
    {
      title: "Primary data source",
      items: [
        "High-precision smartphone GPS data (meter-level accuracy)",
        "Aggregated by Decell and preprocessed by Adalya",
        "Bidirectional Origin-Destination data between statistical zones and POIs",
        "Fully anonymized and privacy-protected",
      ],
    },
    {
      title: "Spatial analysis units",
      items: ["CBS statistical areas for residential zones", "13 key Points of Interest in the Beer Sheva metro"],
    },
    {
      title: "Temporal coverage",
      items: [
        "Stage 1: November 2019 - February 2020",
        "Stage 2: July 2021 (post-COVID comparison)",
        "Average weekday (excluding Sunday and Thursday)",
      ],
    },
    {
      title: "Key features",
      items: [
        "Modes: Car, Bus, Train, Walk, Bike",
        "Work-purpose trips only (Work trip filter applied)",
        "Hourly temporal resolution",
      ],
    },
  ];

  function close(): void {
    document.removeEventListener("keydown", onKeydown, true);
    overlay?.remove();
    overlay = null;
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape" && overlay) {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  }

  function open(): void {
    if (overlay) return;
    overlay = el("div", "exec-commuting-modal");

    const backdrop = el("div", "exec-commuting-modal__backdrop");
    backdrop.addEventListener("click", close);

    const dialog = el("div", "exec-commuting-modal__dialog");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", "Beer Sheva mobility dataset details");

    const head = el("header", "exec-commuting-modal__head");
    head.appendChild(el("h3", "exec-commuting-modal__title", "Beer Sheva Mobility Study"));
    const closeButton = el("button", "exec-commuting-modal__close", "Close");
    closeButton.type = "button";
    closeButton.addEventListener("click", close);
    head.appendChild(closeButton);
    dialog.appendChild(head);

    const grid = el("div", "exec-commuting-modal__grid");
    for (const section of sections) {
      const card = el("section", "exec-commuting-modal__card");
      card.appendChild(el("h4", "exec-commuting-modal__card-title", section.title));
      const list = el("ul", "exec-commuting-modal__list");
      for (const item of section.items) {
        list.appendChild(el("li", undefined, item));
      }
      card.appendChild(list);
      grid.appendChild(card);
    }
    dialog.appendChild(grid);

    dialog.appendChild(
      el(
        "p",
        "exec-commuting-modal__footnote",
        "Sample balancing was applied for demographic representativity. All data validated by Decell and Adalya.",
      ),
    );

    overlay.appendChild(backdrop);
    overlay.appendChild(dialog);
    const host = anchor.closest<HTMLElement>(".executive-overview") ?? document.body;
    host.appendChild(overlay);
    document.addEventListener("keydown", onKeydown, true);
    queueMicrotask(() => closeButton.focus());
  }

  return { open, destroy: close };
}

export function mountCommutingDeepDive(
  leftSlot: HTMLElement,
  rightSlot: HTMLElement,
): CommutingDeepDiveController {
  let destroyed = false;
  let chart: Chart | null = null;
  let chartAllowed = false;
  let deepDiveVisible = false;
  let refresh: (() => void) | null = null;
  let mapController: CommutingMapController | null = null;
  const infoModal = buildInfoModal(leftSlot);

  renderLoadingState(leftSlot, rightSlot);

  void (async () => {
    const loaded = await loadCommutingData();
    if (destroyed) return;
    if (!loaded) {
      renderUnavailableState(leftSlot, rightSlot);
      return;
    }
    const data: CommutingData = loaded;

    const state: { scope: CommutingScope } = { scope: "all" };

    const shell = el("section", "exec-commuting");

    const header = el("header", "exec-commuting__header");
    const titleBlock = el("div", "exec-commuting__title-block");
    titleBlock.appendChild(el("h3", "exec-commuting__title", "Daily inbound commuters"));
    titleBlock.appendChild(
      el(
        "p",
        "exec-commuting__summary",
        "Average weekday work trips arriving at the Innovation District anchors, by hour and mode. Work-purpose trips only.",
      ),
    );
    header.appendChild(titleBlock);
    const infoButton = el("button", "exec-commuting__info", "Dataset details");
    infoButton.type = "button";
    infoButton.addEventListener("click", () => infoModal.open());
    header.appendChild(infoButton);
    shell.appendChild(header);

    const hero = el("section", "exec-commuting__hero");
    const heroTotal = el("div", "exec-commuting__hero-total");
    const heroValue = el("p", "exec-commuting__hero-value");
    const heroLabel = el("p", "exec-commuting__hero-label", "commuters / weekday");
    heroTotal.appendChild(heroValue);
    heroTotal.appendChild(heroLabel);
    hero.appendChild(heroTotal);

    const heroBreakdown = el("div", "exec-commuting__hero-breakdown");
    hero.appendChild(heroBreakdown);
    shell.appendChild(hero);

    const setScope = (scope: CommutingScope): void => {
      state.scope = scope;
      update();
    };

    const controlRow = el("div", "exec-commuting__control-row");
    controlRow.appendChild(el("p", "exec-commuting__section-label", "Destination"));
    const segmented = createSegmentedButtons(SCOPES, () => state.scope, setScope);
    controlRow.appendChild(segmented.root);
    shell.appendChild(controlRow);

    const chartCard = el("div", "exec-commuting__chart-wrap");
    chartCard.appendChild(el("p", "exec-commuting__section-label", "Arrivals by hour"));
    const canvasHost = el("div", "exec-commuting__chart-host");
    const canvas = document.createElement("canvas");
    canvas.className = "exec-commuting__chart";
    canvas.setAttribute("aria-label", "Inbound arrivals by hour of day");
    canvasHost.appendChild(canvas);
    chartCard.appendChild(canvasHost);
    shell.appendChild(chartCard);

    const modesHost = el("div", "exec-commuting__modes-host");
    shell.appendChild(modesHost);

    leftSlot.replaceChildren(shell);
    mapController = mountCommutingMap(rightSlot);
    if (deepDiveVisible) {
      mapController.reveal();
    }

    function update(): void {
      const total = totalForScope(data, state.scope);
      heroValue.textContent = formatCount(Math.round(total));

      heroBreakdown.replaceChildren();
      const breakdownScopes: CommutingDestination[] = ["BGU", "Soroka Hospital", "Gav Yam"];
      for (const scope of breakdownScopes) {
        const item = el("button", "exec-commuting__hero-chip");
        item.type = "button";
        item.dataset.active = state.scope === scope ? "true" : "false";
        item.appendChild(el("span", "exec-commuting__hero-chip-label", COMMUTING_DESTINATION_LABELS[scope]));
        item.appendChild(
          el("span", "exec-commuting__hero-chip-value", formatCompact(data.totalsByDestination[scope])),
        );
        item.addEventListener("click", () => setScope(scope));
        heroBreakdown.appendChild(item);
      }

      const series = hourlyForScope(data, state.scope);
      const peakHour = series.reduce((peak, value, hour) => (value > series[peak] ? hour : peak), 0);
      heroLabel.textContent = `commuters / weekday · peak ${formatHour(peakHour)}`;

      modesHost.replaceChildren(buildModeSplitBar(data, state.scope));
      segmented.sync();
      renderChart(series);
    }

    function renderChart(series: number[]): void {
      const labels = data.hours.map((hour) => formatHour(hour));
      if (!chart) {
        if (!chartAllowed) return;
        chart = new Chart(canvas, {
          type: "line",
          data: { labels, datasets: [] },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  title(items) {
                    return items.length ? `${items[0].label}` : "";
                  },
                  label(context) {
                    return `${formatCount(Math.round((context.parsed.y as number) ?? 0))} arrivals`;
                  },
                },
              },
            },
            scales: {
              x: {
                ticks: { maxRotation: 0, autoSkip: true, color: "#49454f" },
                grid: { display: false },
              },
              y: {
                beginAtZero: true,
                ticks: { color: "#49454f", callback: (value) => formatCount(Number(value)) },
                grid: { color: "rgba(16, 19, 23, 0.08)" },
              },
            },
          },
        });
      }

      chart.data.labels = labels;
      chart.data.datasets = [
        {
          label: "Arrivals",
          data: series,
          borderColor: PHYSICAL_ACCENT,
          backgroundColor: "rgba(135, 88, 0, 0.14)",
          borderWidth: 2.4,
          fill: true,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointBackgroundColor: PHYSICAL_ACCENT,
          tension: 0.3,
        },
      ];
      chart.update();
    }

    refresh = update;
    update();
  })();

  return {
    destroy() {
      destroyed = true;
      chart?.destroy();
      chart = null;
      mapController?.destroy();
      mapController = null;
      infoModal.destroy();
    },
    onVisible() {
      chartAllowed = true;
      deepDiveVisible = true;
      refresh?.();
      chart?.resize();
      mapController?.reveal();
    },
  };
}
