/**
 * Alumni residence mix for BGU employer treemap extract: sums row weights (`n`) by
 * `residence_panel`, matching the same aggregate CSV as `mountBguEmployerTreemap`.
 * Expects `South` as a distinct panel slug when the aggregate splits Negev/south
 * from generic “Lives outside BS” (see `scripts/split-bgu-treemap-south-panel.mjs`).
 * Slice colors follow cohort Venn primaries (`cohortVennDonutSliceColors`).
 */
import type { Plugin } from "chart.js";
import Chart from "chart.js/auto";
import type { BguTreemapRow } from "./csv";
import {
  baseChartOptions,
  chartFont,
  chartFontFamily,
  chartMutedColor,
  chartSurfaceColor,
  chartTextColor,
  cohortVennDonutSliceColors,
  type AppChart,
} from "./chart-theme";
import { formatLocaleInt, getLocale, subs, t } from "../i18n";
import {
  treemapResidencePanelKey,
  treemapUnmappedLabelKey,
} from "../messages/industry-labels";

const MAIN_PANELS = ["Lives in BS", "Lives outside BS"] as const;

/** Slice span below this (~10°) skips on-arc labels to avoid clutter. */
const MIN_ARC_LABEL_RAD = 0.18;

function residencePanelSliceLabel(raw: string): string {
  const key = treemapResidencePanelKey(raw);
  return key === treemapUnmappedLabelKey ? subs(t(key), { slug: raw }) : t(key);
}

function isSouthPanel(slug: string): boolean {
  const s = slug.trim();
  return s === "South" || s.toLowerCase() === "south";
}

function shrinkLabelToWidth(
  canvasCtx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (canvasCtx.measureText(text).width <= maxWidth) return text;
  const ell = "…";
  let s = text.trimEnd();
  while (s.length > 1 && canvasCtx.measureText(s + ell).width > maxWidth) {
    s = s.slice(0, -1).trimEnd();
  }
  return s + ell;
}

function residenceDonutPlugins(params: {
  placeholderNoData: boolean;
  countedTotal: number;
  pctFmt: Intl.NumberFormat;
}): Plugin[] {
  const { placeholderNoData, countedTotal, pctFmt } = params;

  return [
    {
      id: "bguResidenceCenterText",
      afterDatasetsDraw(chart) {
        const { ctx, chartArea } = chart;
        const cx = (chartArea.left + chartArea.right) / 2;
        const cy = (chartArea.top + chartArea.bottom) / 2;
        const side = Math.min(chartArea.width, chartArea.height);
        const line = placeholderNoData ? t("chart.emptyDash") : formatLocaleInt(countedTotal);

        ctx.save();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = chartTextColor();
        ctx.font = `600 ${Math.max(15, Math.min(24, Math.round(side * 0.112)))}px ${chartFontFamily()}`;
        ctx.fillText(line, cx, cy);
        ctx.restore();
      },
    },
    {
      id: "bguResidenceArcLabels",
      afterDatasetsDraw(chart) {
        if (placeholderNoData || countedTotal <= 0) return;

        const meta = chart.getDatasetMeta(0);
        if (!meta?.data?.length) return;

        const { ctx } = chart;
        const rtl = typeof document !== "undefined" && document.documentElement.dir === "rtl";

        ctx.save();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.direction = rtl ? "rtl" : "ltr";

        const bodySize = Math.max(11, Math.min(13, Math.round(chart.width / 38)));
        const family = chartFontFamily();
        ctx.font = `${bodySize}px ${family}`;

        const rawVals = chart.data.datasets[0]?.data as unknown;
        const nums = Array.isArray(rawVals) ? rawVals.map((v) => (typeof v === "number" ? v : 0)) : [];

        for (let i = 0; i < meta.data.length; i++) {
          const el = meta.data[i] as unknown as {
            hidden?: boolean;
            startAngle?: number;
            endAngle?: number;
            outerRadius?: number;
            innerRadius?: number;
            x: number;
            y: number;
          };
          if (el.hidden) continue;

          const sa = el.startAngle;
          const ea = el.endAngle;
          if (typeof sa !== "number" || typeof ea !== "number") continue;
          const span = Math.abs(ea - sa);
          if (!Number.isFinite(span) || span < MIN_ARC_LABEL_RAD) continue;

          const n = nums[i] ?? 0;
          const pctStr = pctFmt.format(n / countedTotal);
          const labelRaw = chart.data.labels?.[i];
          const nameStr = typeof labelRaw === "string" ? labelRaw : String(labelRaw ?? "");

          const mid = (sa + ea) / 2;
          const rin = typeof el.innerRadius === "number" ? el.innerRadius : 0;
          const rout = typeof el.outerRadius === "number" ? el.outerRadius : rin + 40;
          const r = rin + Math.max((rout - rin) * 0.52, Math.min(rout, 48));

          const lx = el.x + Math.cos(mid) * r;
          const ly = el.y + Math.sin(mid) * r;

          const maxW = Math.max(56, span * rout * 0.95);
          const line1 = shrinkLabelToWidth(ctx, `${nameStr} ${pctStr}`, maxW);

          ctx.shadowColor = chartSurfaceColor();
          ctx.shadowBlur = 10;
          ctx.fillStyle = chartTextColor();
          ctx.fillText(line1, lx, ly);
          ctx.shadowBlur = 0;
        }
        ctx.restore();
      },
    },
  ];
}

export function mountBguResidencePie(canvas: HTMLCanvasElement, rows: BguTreemapRow[]): AppChart {
  const byPanel = new Map<string, number>();
  for (const r of rows) {
    const k = r.residencePanel?.trim() ?? "";
    if (!k) continue;
    byPanel.set(k, (byPanel.get(k) ?? 0) + r.n);
  }

  let southTotal = 0;
  let southLabelKey: string | null = null;
  let otherTotal = 0;
  for (const [panel, sum] of byPanel) {
    if ((MAIN_PANELS as readonly string[]).includes(panel)) continue;
    if (isSouthPanel(panel)) {
      southTotal += sum;
      southLabelKey ??= panel;
    } else {
      otherTotal += sum;
    }
  }

  const labels: string[] = [];
  const data: number[] = [];

  const livesInBs = byPanel.get("Lives in BS") ?? 0;
  const livesOutsideBs = byPanel.get("Lives outside BS") ?? 0;

  if (livesInBs > 0) {
    labels.push(residencePanelSliceLabel("Lives in BS"));
    data.push(livesInBs);
  }
  if (southTotal > 0) {
    labels.push(residencePanelSliceLabel(southLabelKey ?? "South"));
    data.push(southTotal);
  }
  if (livesOutsideBs > 0) {
    labels.push(residencePanelSliceLabel("Lives outside BS"));
    data.push(livesOutsideBs);
  }
  if (otherTotal > 0) {
    labels.push(t("chart.bguResidencePieOther"));
    data.push(otherTotal);
  }

  const placeholderNoData = data.length === 0;
  if (placeholderNoData) {
    labels.push(t("chart.emptyDash"));
    data.push(1);
  }

  const sliceCount = data.length;
  const placeholderRingColor = `color-mix(in srgb, ${chartMutedColor()} 32%, ${chartSurfaceColor()})`;
  const colors = placeholderNoData
    ? [placeholderRingColor]
    : cohortVennDonutSliceColors(sliceCount);

  const countedTotal = placeholderNoData
    ? 0
    : data.reduce((a, b) => a + b, 0);
  const loc = getLocale() === "he" ? "he-IL" : "en-US";
  const pctFmt = new Intl.NumberFormat(loc, {
    style: "percent",
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  });

  const opts = baseChartOptions();
  const rtl = getLocale() === "he";

  return new Chart(canvas, {
    type: "doughnut",
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: colors,
          borderWidth: placeholderNoData ? 0 : 1,
        },
      ],
    },
    options: {
      ...opts,
      cutout: "52%",
      plugins: {
        ...opts.plugins,
        tooltip: {
          ...opts.plugins?.tooltip,
          callbacks: {
            label(ctx: { label?: string; raw: unknown; dataIndex: number }) {
              if (placeholderNoData && ctx.dataIndex === 0) {
                return ctx.label ? String(ctx.label) : t("chart.emptyDash");
              }
              const raw = ctx.raw;
              const n = typeof raw === "number" ? raw : 0;
              const pct = countedTotal > 0 ? n / countedTotal : 0;
              const label = ctx.label ? `${ctx.label}: ` : "";
              return `${label}${formatLocaleInt(n)} (${pctFmt.format(pct)})`;
            },
          },
        },
        legend: {
          ...opts.plugins?.legend,
          rtl,
          labels: {
            ...opts.plugins?.legend?.labels,
            font: chartFont(14),
            boxWidth: 16,
            boxHeight: 14,
            padding: 14,
          },
        },
      },
    } as never,
    plugins: residenceDonutPlugins({ placeholderNoData, countedTotal, pctFmt }),
  }) as AppChart;
}
