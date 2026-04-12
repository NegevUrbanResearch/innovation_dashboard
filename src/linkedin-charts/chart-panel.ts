import {
  applyViewportChartSizing,
  layoutTierFromPlotSize,
  type AppChart,
  wireChartTheme,
} from "./chart-theme";

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

export type ChartTabDef =
  | {
      id: string;
      label: string;
      kind?: "chart";
      mount: (canvas: HTMLCanvasElement) => AppChart;
      mountSecondary?: (canvas: HTMLCanvasElement) => AppChart;
      viewToggleLabels?: readonly [string, string];
    }
  | {
      id: string;
      label: string;
      kind: "custom";
      mountCustom: (host: HTMLDivElement) => () => void;
    }
  | {
      id: string;
      label: string;
      kind: "placeholder";
      bodyHtml: string;
    };

const DEFAULT_TOGGLE: readonly [string, string] = ["Companies", "Cities"];

export function mountChartPanel(
  host: HTMLElement,
  opts: {
    title: string;
    sampleNote: string | ((tabId: string) => string);
    tabs: ChartTabDef[];
  },
): () => void {
  host.classList.add("chart-page");
  const panel = el("div", "chart-panel");
  const head = el("div", "chart-panel__head");
  const title = el("h2", "chart-panel__title", opts.title);
  head.appendChild(title);
  panel.appendChild(head);

  let tabRow: HTMLElement | null = null;
  if (opts.tabs.length > 1) {
    tabRow = el("div", "chart-panel__tabs");
    tabRow.setAttribute("role", "tablist");
    panel.appendChild(tabRow);
  }

  const plotControls = el("div", "chart-panel__plot-controls");
  plotControls.setAttribute("aria-label", "Chart data view");
  plotControls.hidden = true;
  const toggleTrack = el("div", "chart-panel__toggle-track");
  const btnPrimary = el("button", "chart-panel__view-btn", DEFAULT_TOGGLE[0]);
  btnPrimary.type = "button";
  btnPrimary.dataset.view = "primary";
  const btnSecondary = el("button", "chart-panel__view-btn", DEFAULT_TOGGLE[1]);
  btnSecondary.type = "button";
  btnSecondary.dataset.view = "secondary";
  toggleTrack.appendChild(btnPrimary);
  toggleTrack.appendChild(btnSecondary);
  plotControls.appendChild(toggleTrack);
  panel.appendChild(plotControls);

  const plotWrap = el("div", "chart-panel__plot");
  panel.appendChild(plotWrap);

  const sample = el("div", "chart-panel__sample");
  panel.appendChild(sample);

  host.appendChild(panel);

  let chart: AppChart | null = null;
  let customDispose: (() => void) | null = null;
  const themeUnsubs: (() => void)[] = [];
  let activeId = opts.tabs[0]?.id ?? "";
  let lastLayoutTier: ReturnType<typeof layoutTierFromPlotSize> | null = null;
  let dataView: "primary" | "secondary" = "primary";

  function sampleHtmlForTab(id: string): string {
    return typeof opts.sampleNote === "function" ? opts.sampleNote(id) : opts.sampleNote;
  }

  function syncSample() {
    sample.innerHTML = sampleHtmlForTab(activeId);
  }

  function toggleLabelsForActiveTab(): readonly [string, string] {
    const def = opts.tabs.find((t) => t.id === activeId);
    if (def && def.kind !== "placeholder" && def.kind !== "custom" && def.viewToggleLabels) {
      return def.viewToggleLabels;
    }
    return DEFAULT_TOGGLE;
  }

  function activeTabHasSecondaryView(): boolean {
    const def = opts.tabs.find((t) => t.id === activeId);
    return Boolean(def && def.kind !== "placeholder" && def.kind !== "custom" && def.mountSecondary);
  }

  function syncPlotControls() {
    const show = activeTabHasSecondaryView();
    plotControls.hidden = !show;
    const [la, lb] = toggleLabelsForActiveTab();
    btnPrimary.textContent = la;
    btnSecondary.textContent = lb;
    if (!show) return;
    btnPrimary.classList.toggle("is-active", dataView === "primary");
    btnSecondary.classList.toggle("is-active", dataView === "secondary");
    btnPrimary.setAttribute("aria-pressed", dataView === "primary" ? "true" : "false");
    btnSecondary.setAttribute("aria-pressed", dataView === "secondary" ? "true" : "false");
  }

  function pickMounter(
    def: ChartTabDef,
  ): ((canvas: HTMLCanvasElement) => AppChart) | null {
    if (def.kind === "placeholder" || def.kind === "custom") return null;
    if (def.mountSecondary && dataView === "secondary") return def.mountSecondary;
    return def.mount;
  }

  function onViewBtn(ev: Event) {
    const t = ev.target as HTMLElement;
    const v = t.closest("button")?.dataset.view;
    if (v !== "primary" && v !== "secondary") return;
    const next = v;
    if (dataView === next) return;
    dataView = next;
    syncPlotControls();
    activate(activeId);
  }

  plotControls.addEventListener("click", onViewBtn);

  function syncPlotLayout() {
    if (!chart) return;
    chart.resize();
    const w = plotWrap.clientWidth;
    const h = plotWrap.clientHeight;
    const tier = layoutTierFromPlotSize(w, h);
    if (lastLayoutTier !== tier) {
      lastLayoutTier = tier;
      applyViewportChartSizing(chart, tier, w);
      chart.update("none");
    }
  }

  const ro = new ResizeObserver(() => {
    syncPlotLayout();
  });
  ro.observe(plotWrap);

  function destroyChart() {
    customDispose?.();
    customDispose = null;
    if (chart) {
      chart.destroy();
      chart = null;
    }
    lastLayoutTier = null;
    themeUnsubs.splice(0).forEach((u) => u());
  }

  function activate(id: string) {
    const def = opts.tabs.find((t) => t.id === id);
    if (!def) return;
    activeId = id;
    destroyChart();
    plotWrap.textContent = "";

    if (def.kind === "placeholder") {
      const body = el("div", "chart-panel__tab-body");
      body.innerHTML = def.bodyHtml;
      plotWrap.appendChild(body);
    } else if (def.kind === "custom") {
      const box = el("div", "chart-panel__custom");
      plotWrap.appendChild(box);
      customDispose = def.mountCustom(box);
    } else {
      const mounter = pickMounter(def);
      if (!mounter) return;
      const canvas = document.createElement("canvas");
      canvas.className = "chart-panel__canvas";
      plotWrap.appendChild(canvas);
      chart = mounter(canvas);
      themeUnsubs.push(wireChartTheme(chart));
      lastLayoutTier = null;
      syncPlotLayout();
    }

    syncSample();
    syncPlotControls();

    if (tabRow) {
      for (const btn of tabRow.querySelectorAll<HTMLButtonElement>("button[data-tab]")) {
        const on = btn.dataset.tab === id;
        btn.classList.toggle("is-active", on);
        btn.setAttribute("aria-selected", on ? "true" : "false");
      }
    }
  }

  if (tabRow) {
    for (const t of opts.tabs) {
      const btn = el("button", "chart-panel__tab", t.label);
      btn.type = "button";
      btn.dataset.tab = t.id;
      btn.setAttribute("role", "tab");
      btn.addEventListener("click", () => {
        dataView = "primary";
        activate(t.id);
      });
      tabRow.appendChild(btn);
    }
  }

  if (opts.tabs.length) activate(activeId);

  return () => {
    ro.disconnect();
    plotControls.removeEventListener("click", onViewBtn);
    destroyChart();
    plotWrap.textContent = "";
    host.classList.remove("chart-page");
    host.textContent = "";
  };
}
