import type { Chart, ChartOptions, ChartTypeRegistry } from "chart.js";

export type AppChart = Chart<keyof ChartTypeRegistry, unknown, unknown>;

function readCssVar(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export function chartTextColor(): string {
  return readCssVar("--text", "#f1f5f9");
}

export function chartMutedColor(): string {
  return readCssVar("--text-secondary", "#94a3b8");
}

export function chartBorderColor(): string {
  return readCssVar("--border-strong", "rgba(148,163,184,0.35)");
}

export function chartSurfaceColor(): string {
  return readCssVar("--surface-raised", "#232b3b");
}

export function accentPalette(): string[] {
  const accent = readCssVar("--accent", "#38bdf8");
  return [
    accent,
    "#f97316",
    "#a78bfa",
    "#34d399",
    "#f472b6",
    "#fbbf24",
    "#22d3ee",
    "#fb7185",
    "#4ade80",
    "#c084fc",
  ];
}

const FIELD_BUCKETS = ["medical", "stem", "non_stem"] as const;

export function orderedFieldBuckets(): readonly string[] {
  return FIELD_BUCKETS;
}

export function fieldBucketColor(bucketKey: string): string {
  const p = accentPalette();
  const k = bucketKey.trim().toLowerCase();
  if (k === "medical") return p[3] ?? p[0];
  if (k === "stem") return p[0] ?? "#38bdf8";
  if (k === "non_stem") return p[1] ?? "#f97316";
  return p[2] ?? "#a78bfa";
}

export function locationColumnColors(): { abroad: string; beerSheva: string; israelOther: string } {
  const p = accentPalette();
  return {
    abroad: p[1] ?? "#f97316",
    beerSheva: p[0] ?? "#38bdf8",
    israelOther: p[2] ?? "#a78bfa",
  };
}

export function baseChartOptions(): ChartOptions {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          color: chartTextColor(),
          boxWidth: 10,
          boxHeight: 10,
          padding: 14,
          font: { family: readCssVar("--font", "system-ui"), size: 11 },
        },
      },
      tooltip: {
        backgroundColor: chartSurfaceColor(),
        titleColor: chartTextColor(),
        bodyColor: chartMutedColor(),
        borderColor: chartBorderColor(),
        borderWidth: 1,
        padding: 10,
        displayColors: true,
      },
    },
    scales: {},
  };
}

export type ChartLayoutTier = 0 | 1 | 2 | 3;

export function layoutTierFromPlotSize(width: number, height: number): ChartLayoutTier {
  if (height < 220 || width < 320) return 0;
  if (height < 280 || width < 400) return 1;
  if (height < 360 || width < 520) return 2;
  return 3;
}

export function applyViewportChartSizing(chart: AppChart, tier: ChartLayoutTier, width: number): void {
  const pl = chart.options.plugins;
  if (!pl) return;

  const legend = pl.legend;
  if (legend && typeof legend === "object") {
    const labels = legend.labels;
    if (labels && typeof labels === "object") {
      const font = (labels.font ?? {}) as { size?: number; family?: string };
      font.size = tier <= 0 ? 8 : tier === 1 ? 9 : tier === 2 ? 10 : 11;
      labels.font = font;
      labels.padding = tier <= 0 ? 4 : tier === 1 ? 6 : tier === 2 ? 10 : 14;
      labels.boxWidth = tier <= 0 ? 6 : tier === 1 ? 7 : tier === 2 ? 9 : 10;
    }
    if ("type" in chart.config && chart.config.type === "doughnut") {
      legend.position = tier >= 3 && width >= 560 ? "right" : "bottom";
    }
  }

  const title = pl.title;
  if (title && typeof title === "object" && title.display) {
    const font = (title.font ?? {}) as { size?: number; weight?: string | number };
    font.size = tier <= 0 ? 11 : tier === 1 ? 11.5 : tier === 2 ? 12 : 13;
    title.font = font as (typeof title)["font"];
    const pad = title.padding;
    const b = tier <= 0 ? 2 : tier === 1 ? 4 : tier === 2 ? 5 : 8;
    title.padding = typeof pad === "object" && pad !== null && !Array.isArray(pad) ? { ...pad, bottom: b } : { bottom: b };
  }

  const scales = chart.options.scales;
  if (scales) {
    const indexAxis = (chart.options as { indexAxis?: "x" | "y" }).indexAxis ?? "x";
    const categoryAxis: "x" | "y" = indexAxis === "y" ? "y" : "x";
    for (const key of ["x", "y"] as const) {
      const s = scales[key];
      if (!s || typeof s !== "object") continue;
      const ticks = (s as {
        ticks?: { font?: { size?: number }; maxTicksLimit?: number; autoSkip?: boolean };
      }).ticks;
      if (!ticks) continue;
      ticks.font = { ...(ticks.font ?? {}), size: tier <= 0 ? 9 : tier === 1 ? 9.5 : tier === 2 ? 10 : 11 };
      if (key === categoryAxis) {
        ticks.autoSkip = false;
        delete ticks.maxTicksLimit;
      } else {
        ticks.maxTicksLimit = tier <= 1 ? 6 : 8;
      }
    }
  }

  for (const ds of chart.data.datasets) {
    if (ds && typeof ds === "object" && "maxBarThickness" in ds) {
      const d = ds as { maxBarThickness?: number };
      if (typeof d.maxBarThickness === "number") {
        const cur = d.maxBarThickness;
        if (cur >= 30) {
          d.maxBarThickness = tier <= 0 ? 20 : tier === 1 ? 24 : tier === 2 ? 30 : 36;
        } else {
          d.maxBarThickness = tier <= 0 ? 12 : tier === 1 ? 16 : tier === 2 ? 19 : 22;
        }
      }
    }
  }
}

export function wireChartTheme(chartUnknown: unknown): () => void {
  const chart = chartUnknown as AppChart;
  const onTheme = () => {
    const text = chartTextColor();
    const muted = chartMutedColor();
    const border = chartBorderColor();
    const root = chart.config.options as ChartOptions & { indexAxis?: "x" | "y" };
    root.plugins = root.plugins ?? {};
    if (root.plugins.legend?.labels) {
      root.plugins.legend.labels.color = text;
    }
    if (root.plugins.tooltip) {
      root.plugins.tooltip.backgroundColor = chartSurfaceColor();
      root.plugins.tooltip.titleColor = text;
      root.plugins.tooltip.bodyColor = muted;
      root.plugins.tooltip.borderColor = border;
    }
    const indexAxis = root.indexAxis ?? "x";
    const categoryAxis: "x" | "y" = indexAxis === "y" ? "y" : "x";
    const valueAxis: "x" | "y" = indexAxis === "y" ? "x" : "y";
    const scales = root.scales ?? {};
    for (const [id, s] of Object.entries(scales)) {
      if (!s || typeof s !== "object") continue;
      const sc = s as {
        ticks?: { color?: string };
        grid?: { color?: string };
        border?: { color?: string };
        title?: { display?: boolean; color?: string };
      };
      const tickColor =
        id === categoryAxis ? text : id === valueAxis ? muted : text;
      if (sc.ticks) sc.ticks.color = tickColor;
      if (sc.grid) sc.grid.color = border;
      if (sc.border) sc.border.color = border;
      if (sc.title?.display) sc.title.color = muted;
    }
    chart.update("none");
  };
  window.addEventListener("bsid-theme-change", onTheme);
  return () => window.removeEventListener("bsid-theme-change", onTheme);
}
