import type { Chart, ChartOptions, ChartTypeRegistry, FontSpec } from "chart.js";
import { lab, rgb } from "d3-color";
import { interpolateViridis } from "d3-scale-chromatic";

export type AppChart = Chart<keyof ChartTypeRegistry, unknown, unknown>;

function chartThemeRoot(): Element {
  const overlay =
    document.querySelector(".exec-deep-dive-overlay[data-state='open']") ??
    document.querySelector(".exec-deep-dive-overlay");
  if (overlay) {
    const shell = overlay.querySelector(".exec-deep-dive-overlay__shell");
    if (shell) return shell;
    return overlay;
  }
  return document.querySelector(".executive-overview") ?? document.documentElement;
}

function readCssVar(name: string, fallback: string): string {
  const v = getComputedStyle(chartThemeRoot()).getPropertyValue(name).trim();
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

export function chartFontFamily(): string {
  return readCssVar("--font", "system-ui");
}

export function chartFont(size: number, overrides: Partial<FontSpec> = {}): Partial<FontSpec> {
  return {
    family: chartFontFamily(),
    size,
    ...overrides,
  };
}

/** CSS custom property per `industryBucket` slug — matte, theme-specific (see `alumni-charts.css`). */
const SECTOR_BUCKET_VAR: Record<string, string> = {
  public_sector: "--bgu-treemap-bucket-public",
  high_tech: "--bgu-treemap-bucket-hitech",
  healthcare: "--bgu-treemap-bucket-health",
  self_employed: "--bgu-treemap-bucket-self",
  needs_review: "--bgu-treemap-bucket-review",
  unknown: "--bgu-treemap-bucket-unknown",
};

const SECTOR_BUCKET_FALLBACK: Record<string, string> = {
  public_sector: "#4f6fa8",
  high_tech: "#b8923d",
  healthcare: "#9578ad",
  self_employed: "#4e9d7a",
  needs_review: "#6f7f94",
  unknown: "#5c6678",
};

/** Stable sector color for treemap tiles + legend (reads theme from `:root`). */
export function sectorTreemapBucketColor(slug: string): string {
  const prop = SECTOR_BUCKET_VAR[slug] ?? "--bgu-treemap-bucket-other";
  const fb = SECTOR_BUCKET_FALLBACK[slug] ?? SECTOR_BUCKET_FALLBACK.unknown;
  return readCssVar(prop, fb);
}

/** Cohort Venn primaries — `--venn-cohort-*` in `alumni-charts.css`. */
export function cohortVennPrimaryColors(): { bgu: string; res: string; wrk: string } {
  return {
    bgu: readCssVar("--venn-cohort-bgu", "#4a6fa5"),
    res: readCssVar("--venn-cohort-res", "#47b8a0"),
    wrk: readCssVar("--venn-cohort-wrk", "#e8c84a"),
  };
}

/** Solid primary fill — matches single-set regions on the cohort Venn SVG. */
export function vennPrimaryRgba(hex: string, alpha: number): string {
  const c = rgb(hex).rgb();
  return `rgba(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)},${alpha})`;
}

/** Lab-average blend — matches intersection fills on the cohort Venn SVG. */
export function vennLabAverageRgba(hexes: readonly string[], alpha: number): string {
  let L = 0;
  let a = 0;
  let b = 0;
  const n = hexes.length;
  for (const h of hexes) {
    const c = lab(rgb(h));
    L += c.l;
    a += c.a;
    b += c.b;
  }
  const out = lab(L / n, a / n, b / n).rgb();
  return `rgba(${Math.round(out.r)},${Math.round(out.g)},${Math.round(out.b)},${alpha})`;
}

/**
 * Alumni residence doughnut — cohort Venn palette: three `--venn-cohort-*` primaries,
 * then pairwise Lab mixes, then triple mix (same logic as `bgu-cohort-partition` fills).
 */
export function cohortVennDonutSliceColors(sliceCount: number): string[] {
  const { bgu, res, wrk } = cohortVennPrimaryColors();
  const ordered: string[] = [
    vennPrimaryRgba(bgu, 0.91),
    vennPrimaryRgba(res, 0.91),
    vennPrimaryRgba(wrk, 0.91),
    vennLabAverageRgba([bgu, res], 0.88),
    vennLabAverageRgba([bgu, wrk], 0.88),
    vennLabAverageRgba([res, wrk], 0.88),
    vennLabAverageRgba([bgu, res, wrk], 0.88),
  ];
  if (sliceCount <= 0) return [];
  if (sliceCount <= ordered.length) return ordered.slice(0, sliceCount);
  return [...ordered, ...rankedBarColors(bgu, sliceCount - ordered.length)];
}

/** Legacy residence doughnut palette from `alumni-charts.css` (--chart-residence-donut-*). */
export function residenceDonutSliceColors(sliceCount: number): string[] {
  const d1 = readCssVar("--chart-residence-donut-1", "#22d3ee");
  const d2 = readCssVar("--chart-residence-donut-2", "#818cf8");
  const d3 = readCssVar("--chart-residence-donut-3", "#2dd4bf");
  const d4 = readCssVar("--chart-residence-donut-4", "#c084fc");
  const accent = readCssVar("--accent", "#38bdf8");
  const base = [d1, d2, d3, d4];
  if (sliceCount <= 0) return [];
  if (sliceCount <= base.length) return base.slice(0, sliceCount);
  return [...base, ...rankedBarColors(accent, sliceCount - base.length)];
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

export function jobsFlowBaseColors(): {
  inbound: string;
  outbound: string;
  center: string;
} {
  return {
    inbound: readCssVar("--jobs-flow-inbound", "#9578ad"),
    outbound: readCssVar("--jobs-flow-outbound", "#b8923d"),
    center: readCssVar("--jobs-flow-center", "#64748b"),
  };
}

export function jobsFlowRankColor(
  side: "inbound" | "outbound",
  rank: number,
  totalRanks: number,
): string {
  const base = jobsFlowBaseColors()[side];
  const t = totalRanks <= 1 ? 0 : Math.max(0, Math.min(1, (rank - 1) / (totalRanks - 1)));
  const emphasis = Math.round((0.94 - t * 0.36) * 100);
  return `color-mix(in srgb, ${base} ${emphasis}%, ${chartSurfaceColor()})`;
}

/** Pad or trim a fixed hex palette to `count` slices using `rankedBarColors` off `--accent`. */
export function expandSlicePalette(base: string[], count: number): string[] {
  const accent = readCssVar("--accent", "#38bdf8");
  if (count <= base.length) return base.slice(0, count);
  return [...base, ...rankedBarColors(accent, count - base.length)];
}

export function rankedBarColors(baseColor: string, count: number): string[] {
  return Array.from({ length: Math.max(0, count) }, (_, i) => {
    const t = count <= 1 ? 0 : i / (count - 1);
    const emphasis = Math.round((0.94 - t * 0.36) * 100);
    return `color-mix(in srgb, ${baseColor} ${emphasis}%, ${chartSurfaceColor()})`;
  });
}

/** Used by workforce bar chart; Viridis-style ramp. */
export function viridisRankColors(count: number): string[] {
  return Array.from({ length: Math.max(0, count) }, (_, i) => {
    const t = count <= 1 ? 0.88 : 0.9 - (i / (count - 1)) * 0.62;
    return interpolateViridis(Math.max(0, Math.min(1, t)));
  });
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
    font: {
      family: chartFontFamily(),
    },
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          color: chartTextColor(),
          boxWidth: 10,
          boxHeight: 10,
          padding: 14,
          font: chartFont(12),
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
        titleFont: chartFont(12),
        bodyFont: chartFont(12),
        footerFont: chartFont(12),
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
      font.size = tier <= 0 ? 11 : tier === 1 ? 11 : tier === 2 ? 12 : 12;
      labels.font = font;
      labels.padding = tier <= 0 ? 4 : tier === 1 ? 6 : tier === 2 ? 10 : 14;
      labels.boxWidth = tier <= 0 ? 6 : tier === 1 ? 7 : tier === 2 ? 9 : 10;
    }
    if ("type" in chart.config && chart.config.type === "doughnut") {
      legend.position = tier >= 3 && width >= 560 ? "right" : "bottom";
      const doughnutLabels = legend.labels;
      if (doughnutLabels && typeof doughnutLabels === "object") {
        // Single residence doughnut: keep legend legible vs bar/Venn tiers
        doughnutLabels.font = {
          ...(doughnutLabels.font ?? {}),
          size: tier <= 0 ? 11 : tier === 1 ? 12 : tier === 2 ? 13 : 14,
        };
        doughnutLabels.padding = tier <= 0 ? 10 : tier === 1 ? 12 : tier === 2 ? 14 : 16;
        doughnutLabels.boxWidth = tier <= 0 ? 12 : tier === 1 ? 14 : tier === 2 ? 16 : 17;
        doughnutLabels.boxHeight = tier <= 0 ? 12 : tier === 1 ? 13 : tier === 2 ? 14 : 15;
      }
    }
  }

  const title = pl.title;
  if (title && typeof title === "object" && title.display) {
    const font = (title.font ?? {}) as { size?: number; weight?: string | number };
    font.size = tier <= 0 ? 12 : tier === 1 ? 12.5 : tier === 2 ? 13 : 14;
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
      ticks.font = { ...(ticks.font ?? {}), size: tier <= 0 ? 11 : tier === 1 ? 11 : tier === 2 ? 12 : 12 };
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
    const family = chartFontFamily();
    const root = chart.config.options as ChartOptions & { indexAxis?: "x" | "y" };
    root.plugins = root.plugins ?? {};
    root.font = { ...(root.font ?? {}), family };
    const legendLbl = root.plugins.legend?.labels;
    if (legendLbl && typeof legendLbl === "object") {
      legendLbl.color = text;
      legendLbl.font = { ...(legendLbl.font ?? {}), family };
    }
    if (root.plugins.tooltip) {
      root.plugins.tooltip.backgroundColor = chartSurfaceColor();
      root.plugins.tooltip.titleColor = text;
      root.plugins.tooltip.bodyColor = muted;
      root.plugins.tooltip.borderColor = border;
      root.plugins.tooltip.titleFont = { ...(root.plugins.tooltip.titleFont ?? {}), family };
      root.plugins.tooltip.bodyFont = { ...(root.plugins.tooltip.bodyFont ?? {}), family };
      root.plugins.tooltip.footerFont = { ...(root.plugins.tooltip.footerFont ?? {}), family };
    }
    const indexAxis = root.indexAxis ?? "x";
    const categoryAxis: "x" | "y" = indexAxis === "y" ? "y" : "x";
    const valueAxis: "x" | "y" = indexAxis === "y" ? "x" : "y";
    const scales = root.scales ?? {};
    for (const [id, s] of Object.entries(scales)) {
      if (!s || typeof s !== "object") continue;
      const sc = s as {
        ticks?: { color?: string; font?: Partial<FontSpec> };
        grid?: { color?: string };
        border?: { color?: string };
        title?: { display?: boolean; color?: string; font?: Partial<FontSpec> };
      };
      const tickColor =
        id === categoryAxis ? text : id === valueAxis ? muted : text;
      if (sc.ticks) sc.ticks.color = tickColor;
      if (sc.ticks?.font) sc.ticks.font = { ...sc.ticks.font, family };
      if (sc.grid) sc.grid.color = border;
      if (sc.border) sc.border.color = border;
      if (sc.title?.display) sc.title.color = muted;
      if (sc.title?.font) sc.title.font = { ...sc.title.font, family };
    }
    chart.update("none");
  };
  window.addEventListener("bsid-theme-change", onTheme);
  return () => window.removeEventListener("bsid-theme-change", onTheme);
}
