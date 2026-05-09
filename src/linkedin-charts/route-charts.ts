import Chart from "chart.js/auto";
import {
  accentPalette,
  baseChartOptions,
  chartMutedColor,
  chartTextColor,
  viridisRankColors,
  type AppChart,
} from "./chart-theme";
import { mountBguCohortPartition } from "./bgu-cohort-partition";
import { mountBguEmployerTreemap } from "./bgu-employer-treemap";
import { mountJobsMirroredHiring } from "./jobs-mirrored-hiring";
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
            ? { display: true, text: opts.xTitle, color: chartMutedColor(), font: { size: 12 } }
            : undefined,
        },
        y: {
          grid: { display: false },
          ticks: {
            color: chartTextColor(),
            font: { size: 12 },
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
    const employerBarColors = viridisRankColors(topEmp.length);
    tabs = [
      {
        id: "employers",
        label: t("chart.tabBeerShevaEmployers"),
        mount: (canvas) =>
          mkChart(
            canvas,
            hBarConfig(
              topEmp.map((r) => r.label),
              topEmp.map((r) => r.count),
              { xTitle: t("chart.axisMentions"), barColors: employerBarColors, labelTruncate: 36 },
            ),
          ),
      },
      {
        id: "hiring-flow",
        label: t("chart.tabHiringFlows"),
        kind: "custom",
        mountCustom: (box) =>
          mountJobsMirroredHiring(box, {
            inboundEmployers: d.companiesInbound,
            outboundEmployers: d.companiesOutbound,
            inboundTotalMentions: d.companiesInboundTotalN,
            outboundTotalMentions: d.companiesOutboundTotalN,
            feederCities: d.feederCities,
            destinationCities: d.destinationCities,
            topEmployerCount: 14,
            topCityCount: 12,
          }),
      },
    ];
    sample = (tabId: string) => {
      if (tabId === "hiring-flow") {
        return subs("chart.sampleJobsHiringCombined", {
          inbound: formatLocaleInt(d.companiesInboundTotalN),
          outbound: formatLocaleInt(d.companiesOutboundTotalN),
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
