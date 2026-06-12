import Chart from "chart.js/auto";
import type { EducationFieldGraduationRow } from "../../../alumni-charts/csv.ts";
import {
  baseChartOptions,
  chartBorderColor,
  chartFont,
  chartMutedColor,
  chartTextColor,
  viridisRankColors,
  type AppChart,
} from "../../../alumni-charts/chart-theme.ts";
import { formatLocaleInt, subs, t } from "../../../i18n.ts";
import { treemapEducationKey, treemapUnmappedLabelKey } from "../../../messages/industry-labels.ts";

export const YEAR_MIN = 1995;
export const YEAR_MAX = 2026;
export const TOP_FIELDS = 8;

const OTHER_FIELD = "other";

function fieldLabel(slug: string): string {
  const key = treemapEducationKey(slug);
  const template = t(key);
  return key === treemapUnmappedLabelKey ? subs(template, { slug }) : template;
}

function prepareGraduationStackData(rows: EducationFieldGraduationRow[]): {
  years: number[];
  stackKeys: string[];
  byYearField: Map<number, Map<string, number>>;
} {
  const filtered = rows.filter((row) => row.year >= YEAR_MIN && row.year <= YEAR_MAX);

  const fieldTotals = new Map<string, number>();
  for (const row of filtered) {
    fieldTotals.set(row.field, (fieldTotals.get(row.field) ?? 0) + row.count);
  }

  const topFields = [...fieldTotals.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, TOP_FIELDS)
    .map(([field]) => field);
  const topSet = new Set(topFields);

  const yearSet = new Set<number>();
  const byYearField = new Map<number, Map<string, number>>();
  let hasOther = false;

  for (const row of filtered) {
    yearSet.add(row.year);
    let yearMap = byYearField.get(row.year);
    if (!yearMap) {
      yearMap = new Map();
      byYearField.set(row.year, yearMap);
    }
    const bucket = topSet.has(row.field) ? row.field : OTHER_FIELD;
    if (bucket === OTHER_FIELD) hasOther = true;
    yearMap.set(bucket, (yearMap.get(bucket) ?? 0) + row.count);
  }

  const years = [...yearSet].sort((a, b) => a - b);
  const stackKeys = hasOther ? [...topFields, OTHER_FIELD] : topFields;

  return { years, stackKeys, byYearField };
}

export function mountGraduationFieldChart(
  canvas: HTMLCanvasElement,
  rows: EducationFieldGraduationRow[],
): { chart: AppChart; destroy: () => void } {
  const { years, stackKeys, byYearField } = prepareGraduationStackData(rows);
  const colors = viridisRankColors(stackKeys.length);
  const base = baseChartOptions();

  const chart = new Chart(canvas, {
    type: "bar",
    data: {
      labels: years.map(String),
      datasets: stackKeys.map((field, index) => ({
        label: fieldLabel(field),
        data: years.map((year) => byYearField.get(year)?.get(field) ?? 0),
        backgroundColor: colors[index],
        borderColor: chartBorderColor(),
        borderWidth: 1,
        stack: "graduation",
      })),
    },
    options: {
      ...base,
      plugins: {
        ...base.plugins,
        legend: {
          ...base.plugins?.legend,
          labels: {
            ...base.plugins?.legend?.labels,
            color: chartTextColor(),
            font: chartFont(11),
            padding: 12,
          },
        },
        tooltip: {
          ...base.plugins?.tooltip,
          callbacks: {
            label(context) {
              const label = context.dataset.label ?? "";
              const value = Math.round((context.parsed.y as number) ?? 0);
              return `${label}: ${formatLocaleInt(value)}`;
            },
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          ticks: {
            color: chartTextColor(),
            font: chartFont(11),
            maxRotation: years.length > 14 ? 45 : 0,
            autoSkip: years.length > 18,
            maxTicksLimit: years.length > 18 ? 14 : undefined,
          },
          grid: { color: chartBorderColor() },
        },
        y: {
          stacked: true,
          beginAtZero: true,
          ticks: {
            color: chartMutedColor(),
            font: chartFont(11),
            callback: (value) => formatLocaleInt(Number(value)),
          },
          grid: { color: chartBorderColor() },
        },
      },
    },
  }) as AppChart;

  return {
    chart,
    destroy: () => chart.destroy(),
  };
}
