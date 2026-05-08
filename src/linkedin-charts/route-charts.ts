import Chart from "chart.js/auto";
import {
  accentPalette,
  baseChartOptions,
  chartMutedColor,
  chartTextColor,
  type AppChart,
} from "./chart-theme";
import { mountBguCohortPartition } from "./bgu-cohort-partition";
import { mountBguEmployerTreemap } from "./bgu-employer-treemap";
import { loadLinkedInData } from "./load-data";
import { mountChartPanel, type ChartTabDef } from "./chart-panel";
import { formatLocaleInt, t, type MessageKey } from "../i18n";

function subs(templateKey: MessageKey, vars: Record<string, string>): string {
  let out = t(templateKey);
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(`{${k}}`, v);
  }
  return out;
}

function mkChart(canvas: HTMLCanvasElement, cfg: object): AppChart {
  return new Chart(canvas, cfg as never) as AppChart;
}

export type ChartDisposer = () => void;

function truncateLabel(s: string, max = 28): string {
  const trimmed = s.trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}…`;
}

function topN<T extends { count: number }>(rows: T[], n: number): T[] {
  return [...rows].sort((a, b) => b.count - a.count).slice(0, n);
}

function perBarBackgroundColors(
  barCount: number,
  explicit: string[] | undefined,
  palette: string[],
): string[] {
  if (explicit?.length) {
    return Array.from({ length: barCount }, (_, i) => explicit[i % explicit.length]!);
  }
  if (barCount > 5) {
    const c = palette[0]!;
    return Array.from({ length: barCount }, () => c);
  }
  return Array.from({ length: barCount }, (_, i) => palette[i % palette.length]!);
}

function hBarConfig(
  labels: string[],
  values: number[],
  opts: {
    indexAxis?: "x" | "y";
    xTitle?: string;
    barColors?: string[];
    maxBarThickness?: number;
    labelTruncate?: number;
  } = {},
): object {
  const barBg = perBarBackgroundColors(values.length, opts.barColors, accentPalette());
  const maxBar = opts.maxBarThickness ?? 22;
  const labelMax = opts.labelTruncate ?? 34;
  return {
    type: "bar",
    data: {
      labels: labels.map((l) => truncateLabel(l, labelMax)),
      datasets: [
        {
          label: opts.xTitle ?? t("chart.axisCount"),
          data: values,
          backgroundColor: barBg,
          borderRadius: 6,
          maxBarThickness: maxBar,
        },
      ],
    },
    options: {
      indexAxis: opts.indexAxis ?? "y",
      ...baseChartOptions(),
      plugins: {
        ...baseChartOptions().plugins,
        legend: { display: false },
      },
      scales: {
        x: {
          grid: { color: chartMutedColor() + "33" },
          ticks: { color: chartMutedColor(), maxTicksLimit: 8 },
          title: opts.xTitle
            ? { display: true, text: opts.xTitle, color: chartMutedColor(), font: { size: 11 } }
            : undefined,
        },
        y: {
          grid: { display: false },
          ticks: {
            color: chartTextColor(),
            font: { size: 11 },
            autoSkip: false,
          },
        },
      },
    },
  };
}

export async function mountLinkedInCharts(
  root: HTMLElement,
  routeKey: string,
): Promise<ChartDisposer | null> {
  const d = await loadLinkedInData();
  let tabs: ChartTabDef[] = [];
  let title = "";
  let sample: string | ((tabId: string) => string) = "";

  if (routeKey === "network/talent") {
    tabs = [
      {
        id: "cohort-overlap",
        label: t("chart.tabBguCohortOverlap"),
        kind: "custom",
        mountCustom: (box) => mountBguCohortPartition(box, d.cohortVenn),
      },
    ];
    sample = subs("chart.sampleBguCohortOverlap", {
      n: formatLocaleInt(d.cohortVenn.totals.totalProfiles),
    });
  } else if (routeKey === "network/talent-bgu") {
    title = t("chart.titleBguAlumni");
    tabs = [
      {
        id: "bgu-employer-treemap",
        label: t("chart.tabBguEmployerTreemap"),
        kind: "custom",
        mountCustom: (box) => mountBguEmployerTreemap(box, d.bguTreemapRows),
      },
    ];
    sample = subs("chart.sampleBguEmployerTreemap", {
      n: formatLocaleInt(d.bguTreemapRows.length),
    });
  } else if (routeKey === "economy/jobs") {
    title = t("chart.titleJobsHiring");
    const topEmp = topN(d.companiesInBs, 14);
    const topInbound = topN(d.companiesInbound, 14);
    const topOutbound = topN(d.companiesOutbound, 14);
    const feederTop = topN(d.feederCities, 12);
    const destTop = topN(d.destinationCities, 12);
    tabs = [
      {
        id: "employers",
        label: t("chart.tabBeerShevaEmployers"),
        mount: (canvas) =>
          mkChart(
            canvas,
            hBarConfig(
              topEmp.map((r) => truncateLabel(r.label, 36)),
              topEmp.map((r) => r.count),
              { xTitle: t("chart.axisMentions") },
            ),
          ),
      },
      {
        id: "inbound",
        label: t("chart.tabInboundHiring"),
        mount: (canvas) =>
          mkChart(
            canvas,
            hBarConfig(
              topInbound.map((r) => truncateLabel(r.label, 36)),
              topInbound.map((r) => r.count),
              { xTitle: t("chart.axisMentions") },
            ),
          ),
        mountSecondary: (canvas) =>
          mkChart(
            canvas,
            hBarConfig(
              feederTop.map((r) => truncateLabel(r.label, 32)),
              feederTop.map((r) => r.count),
              { xTitle: t("chart.axisMentions") },
            ),
          ),
      },
      {
        id: "outbound",
        label: t("chart.tabOutboundHiring"),
        mount: (canvas) =>
          mkChart(
            canvas,
            hBarConfig(
              topOutbound.map((r) => truncateLabel(r.label, 36)),
              topOutbound.map((r) => r.count),
              { xTitle: t("chart.axisMentions") },
            ),
          ),
        mountSecondary: (canvas) =>
          mkChart(
            canvas,
            hBarConfig(
              destTop.map((r) => truncateLabel(r.label, 32)),
              destTop.map((r) => r.count),
              { xTitle: t("chart.axisMentions") },
            ),
          ),
      },
    ];
    sample = (tabId: string) => {
      if (tabId === "inbound") {
        return subs("chart.sampleJobsInboundTotals", {
          employers: formatLocaleInt(d.companiesInboundTotalN),
          feeders: formatLocaleInt(d.feederTotalN),
        });
      }
      if (tabId === "outbound") {
        return subs("chart.sampleJobsOutboundTotals", {
          employers: formatLocaleInt(d.companiesOutboundTotalN),
          destinations: formatLocaleInt(d.destinationTotalN),
        });
      }
      return subs("chart.sampleJobsEmployersDefault", {
        n: formatLocaleInt(d.companiesInBsTotalN),
      });
    };
  } else {
    return null;
  }

  return mountChartPanel(root, { title, sampleNote: sample, tabs });
}
