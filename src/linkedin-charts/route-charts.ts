import Chart from "chart.js/auto";
import {
  accentPalette,
  baseChartOptions,
  chartMutedColor,
  chartSurfaceColor,
  chartTextColor,
  fieldBucketColor,
  locationColumnColors,
  orderedFieldBuckets,
  type AppChart,
} from "./chart-theme";
import {
  isUnspecifiedToken,
  type BguEducationDetailRow,
  type EducationFieldDetailRow,
  type EducationRetentionWideRow,
} from "./csv";
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

function humanSnake(s: string): string {
  return s
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

const EDU_BUCKET_MESSAGE: Record<string, MessageKey> = {
  stem: "chart.educationStem",
  non_stem: "chart.educationNonStem",
  medical: "chart.educationMedical",
};

const LIVE_WORK_KV_MESSAGE: Record<string, MessageKey> = {
  "work in beer sheva": "chart.liveWork.workInBeerSheva",
  "work outside beer sheva": "chart.liveWork.workOutsideBeerSheva",
  "live in beer sheva": "chart.liveWork.liveInBeerSheva",
  "live outside beer sheva": "chart.liveWork.liveOutsideBeerSheva",
};

const INDUSTRY_BUCKET_MESSAGE: Record<string, MessageKey> = {
  unknown: "chart.industry.unknown",
  high_tech: "chart.industry.high_tech",
  healthcare: "chart.industry.healthcare",
  self_employed: "chart.industry.self_employed",
};

/** Every distinct `education_field_fine` in public/linkedin-data/education_fields_detailed.csv */
const FIELD_FINE_MESSAGE: Record<string, MessageKey> = {
  accounting_and_finance: "chart.field.accounting_and_finance",
  behavioral_sciences: "chart.field.behavioral_sciences",
  biology: "chart.field.biology",
  biomedical_engineering: "chart.field.biomedical_engineering",
  biotechnology: "chart.field.biotechnology",
  business_administration: "chart.field.business_administration",
  chemical_engineering: "chart.field.chemical_engineering",
  civil_engineering: "chart.field.civil_engineering",
  computer_science: "chart.field.computer_science",
  data_science: "chart.field.data_science",
  economics: "chart.field.economics",
  electrical_and_computer_engineering: "chart.field.electrical_and_computer_engineering",
  electrical_engineering: "chart.field.electrical_engineering",
  geography: "chart.field.geography",
  health_care_administration: "chart.field.health_care_administration",
  hospitality_management: "chart.field.hospitality_management",
  industrial_engineering: "chart.field.industrial_engineering",
  linguistics: "chart.field.linguistics",
  management_information_systems: "chart.field.management_information_systems",
  materials_engineering: "chart.field.materials_engineering",
  mechanical_engineering: "chart.field.mechanical_engineering",
  medicine: "chart.field.medicine",
  nursing: "chart.field.nursing",
  physics: "chart.field.physics",
  political_science: "chart.field.political_science",
  psychology: "chart.field.psychology",
  public_policy: "chart.field.public_policy",
  social_work: "chart.field.social_work",
  software_engineering: "chart.field.software_engineering",
};

function humanEducationBucket(s: string): string {
  const k = s.trim().toLowerCase();
  const msgKey = EDU_BUCKET_MESSAGE[k];
  if (msgKey) return t(msgKey);
  return humanSnake(s);
}

function humanIndustryBucket(s: string): string {
  const k = s.trim().toLowerCase();
  const msgKey = INDUSTRY_BUCKET_MESSAGE[k];
  if (msgKey) return t(msgKey);
  return humanSnake(s);
}

function humanFieldFine(s: string): string {
  const k = s.trim().toLowerCase();
  const msgKey = FIELD_FINE_MESSAGE[k];
  if (msgKey) return t(msgKey);
  return humanSnake(s);
}

function humanLiveWorkKvKey(raw: string): string {
  const k = raw.trim().toLowerCase();
  const msgKey = LIVE_WORK_KV_MESSAGE[k];
  if (msgKey) return t(msgKey);
  return humanSnake(raw);
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

function groupedHBarConfig(
  yLabels: string[],
  series: { label: string; data: number[] }[],
  opts: { xTitle?: string },
): object {
  const colors = accentPalette();
  const base = baseChartOptions();
  return {
    type: "bar",
    data: {
      labels: yLabels.map((l) => truncateLabel(l, 28)),
      datasets: series.map((s, i) => ({
        label: s.label,
        data: s.data,
        backgroundColor: colors[i % colors.length],
        borderRadius: 5,
        maxBarThickness: 20,
      })),
    },
    options: {
      indexAxis: "y" as const,
      ...base,
      plugins: {
        ...base.plugins,
        legend: {
          display: true,
          position: "bottom" as const,
          labels: {
            ...base.plugins?.legend?.labels,
            color: chartTextColor(),
          },
        },
      },
      scales: {
        x: {
          stacked: false,
          grid: { color: chartMutedColor() + "33" },
          ticks: { color: chartMutedColor(), maxTicksLimit: 10 },
          title: opts.xTitle
            ? { display: true, text: opts.xTitle, color: chartMutedColor(), font: { size: 11 } }
            : undefined,
        },
        y: {
          stacked: false,
          grid: { display: false },
          ticks: { color: chartTextColor(), font: { size: 11 } },
        },
      },
    },
  };
}

function integerPercentsThree(a: number, b: number, c: number): [number, number, number] {
  const known = a + b + c;
  if (known <= 0) return [0, 0, 0];
  const vals = [a, b, c];
  const exact = vals.map((v) => (100 * v) / known);
  const floor = exact.map((e) => Math.floor(e));
  let rem = 100 - floor.reduce((x, y) => x + y, 0);
  const order = exact.map((e, i) => ({ i, frac: e - floor[i]! })).sort((p, q) => q.frac - p.frac);
  const out: [number, number, number] = [floor[0]!, floor[1]!, floor[2]!];
  for (let k = 0; k < rem; k++) {
    const i = order[k]!.i;
    out[i] = (out[i] ?? 0) + 1;
  }
  return out;
}

function majorsAggregatedFromFields(rows: EducationFieldDetailRow[]): { label: string; count: number }[] {
  const byKey = new Map<string, number>();
  const keys: string[] = [];
  for (const r of rows) {
    const k = r.field.trim().toLowerCase();
    if (!k || isUnspecifiedToken(k)) continue;
    if (!byKey.has(k)) keys.push(k);
    byKey.set(k, (byKey.get(k) ?? 0) + r.count);
  }
  return keys
    .map((k) => ({
      label: truncateLabel(humanFieldFine(k), 36),
      count: byKey.get(k) ?? 0,
    }))
    .sort((a, b) => b.count - a.count);
}

function aggregateBguByBuckets(
  rows: BguEducationDetailRow[],
  degreeFilter: (deg: string) => boolean,
): { keys: string[]; values: number[] } {
  const acc = new Map<string, number>();
  for (const r of rows) {
    const d = r.degree.trim().toLowerCase();
    const b = r.bucket.trim().toLowerCase();
    if (!degreeFilter(d) || isUnspecifiedToken(b) || isUnspecifiedToken(d)) continue;
    acc.set(b, (acc.get(b) ?? 0) + r.count);
  }
  const keys = orderedFieldBuckets().filter((k) => (acc.get(k) ?? 0) > 0);
  return { keys, values: keys.map((k) => acc.get(k) ?? 0) };
}

function mountBguRetentionHeatmap(parent: HTMLElement, rows: EducationRetentionWideRow[]): () => void {
  function paint() {
    parent.replaceChildren();
    const colDefs = [
      { key: "abroad" as const, label: t("chart.locationAbroad") },
      { key: "beerSheva" as const, label: t("chart.locationBeerSheva") },
      { key: "israelOther" as const, label: t("chart.locationIsraelOther") },
    ];
    const loc = locationColumnColors();
    const surface = chartSurfaceColor();
    const text = chartTextColor();
    const wrap = document.createElement("div");
    wrap.className = "retention-heatmap";
    const table = document.createElement("table");
    table.className = "retention-heatmap__table";
    const thead = document.createElement("thead");
    const hr = document.createElement("tr");
    const corner = document.createElement("th");
    corner.className = "retention-heatmap__corner";
    corner.textContent = t("chart.heatmapFieldHeader");
    hr.appendChild(corner);
    for (const c of colDefs) {
      const th = document.createElement("th");
      th.className = "retention-heatmap__colhead";
      th.textContent = c.label;
      th.style.borderBottomColor = loc[c.key];
      hr.appendChild(th);
    }
    thead.appendChild(hr);
    table.appendChild(thead);
    const tb = document.createElement("tbody");
    const ordered = orderedFieldBuckets()
      .map((k) => rows.find((r) => r.bucket.trim().toLowerCase() === k))
      .filter((r): r is EducationRetentionWideRow => Boolean(r));
    for (const r of ordered) {
      const known = r.abroad + r.beerSheva + r.israelOther;
      const pcts = integerPercentsThree(r.abroad, r.beerSheva, r.israelOther);
      const tr = document.createElement("tr");
      const th = document.createElement("th");
      th.className = "retention-heatmap__rowhead";
      th.textContent = humanEducationBucket(r.bucket);
      tr.appendChild(th);
      colDefs.forEach((c, j) => {
        const td = document.createElement("td");
        td.className = "retention-heatmap__cell";
        const raw = r[c.key];
        const pct = pcts[j] ?? 0;
        const col = loc[c.key];
        td.style.color = text;
        td.style.background = `color-mix(in srgb, ${col} ${pct}%, ${surface})`;
        td.textContent = `${pct}%`;
        td.title = subs("chart.heatmapCellTitle", {
          label: c.label,
          raw: formatLocaleInt(raw),
          known: formatLocaleInt(known),
          pct: String(pct),
        });
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    }
    table.appendChild(tb);
    wrap.appendChild(table);
    parent.appendChild(wrap);
  }

  paint();
  const onTheme = () => paint();
  window.addEventListener("bsid-theme-change", onTheme);
  return () => window.removeEventListener("bsid-theme-change", onTheme);
}

function mapToBarSeries(m: Map<string, number>, take: number): { labels: string[]; values: number[] } {
  const entries = [...m.entries()]
    .filter(([k]) => !isUnspecifiedToken(k))
    .sort((a, b) => b[1] - a[1])
    .slice(0, take);
  return {
    labels: entries.map(([k]) => truncateLabel(humanLiveWorkKvKey(k), 34)),
    values: entries.map(([, v]) => v),
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
    title = t("chart.titleTalentEducation");
    const rw = mapToBarSeries(d.residentsWorkN, 14);
    const wr = mapToBarSeries(d.workersResidenceN, 14);
    tabs = [
      {
        id: "live-work",
        label: t("chart.tabResidentsWorkplaces"),
        mount: (canvas) =>
          mkChart(
            canvas,
            hBarConfig(rw.labels, rw.values, { xTitle: t("chart.axisPeople") }),
          ),
      },
      {
        id: "work-live",
        label: t("chart.tabWorkersHomes"),
        mount: (canvas) =>
          mkChart(
            canvas,
            hBarConfig(wr.labels, wr.values, { xTitle: t("chart.axisPeople") }),
          ),
      },
    ];
    sample = subs("chart.sampleTalentOverview", {
      r: formatLocaleInt(d.residentsWorkTotalN),
      w: formatLocaleInt(d.workersTotalN),
    });
  } else if (routeKey === "network/talent-bgu") {
    title = t("chart.titleBguAlumni");
    const stemRows = topN(d.stemOverall, 8);
    const stemBarColors = stemRows.map((r) => fieldBucketColor(r.label));
    const majorsAll = majorsAggregatedFromFields(d.educationFieldsDetailed);
    const pal = accentPalette();
    const degreeFieldBarColor = pal[0]!;
    const majorBarColors = majorsAll.length
      ? majorsAll.map(() => degreeFieldBarColor)
      : [chartMutedColor()];
    const retRows = d.educationRetentionWide.filter(
      (r) => r.abroad + r.beerSheva + r.israelOther > 0,
    );
    const ugSet = new Set(["undergrad"]);
    const gradSet = new Set(["graduate", "doctoral", "professional"]);
    const ugHist = aggregateBguByBuckets(d.bguEducationDetailed, (deg) => ugSet.has(deg));
    const grHist = aggregateBguByBuckets(d.bguEducationDetailed, (deg) => gradSet.has(deg));
    tabs = [
      {
        id: "bgu-cohort-overlap",
        label: t("chart.tabBguCohortOverlap"),
        kind: "custom",
        mountCustom: (box) => mountBguCohortPartition(box, d.cohortVenn),
      },
      {
        id: "bgu-employer-treemap",
        label: t("chart.tabBguEmployerTreemap"),
        kind: "custom",
        mountCustom: (box) => mountBguEmployerTreemap(box, d.bguTreemapRows),
      },
      {
        id: "bgu-field-mix",
        label: t("chart.tabFieldMix"),
        mount: (canvas) =>
          mkChart(
            canvas,
            hBarConfig(
              stemRows.map((r) => humanEducationBucket(r.label)),
              stemRows.map((r) => r.count),
              {
                xTitle: t("chart.axisPeople"),
                barColors: stemBarColors,
              },
            ),
          ),
      },
      {
        id: "bgu-residence",
        label: t("chart.tabWhereTheyLive"),
        kind: "custom",
        mountCustom: (box) => mountBguRetentionHeatmap(box, retRows),
      },
      {
        id: "bgu-edu",
        label: t("chart.tabDegreeField"),
        viewToggleLabels: [
          t("chart.toggleUndergraduate"),
          t("chart.toggleGraduate"),
        ],
        mount: (canvas) =>
          mkChart(
            canvas,
            hBarConfig(
              ugHist.keys.length
                ? ugHist.keys.map((k) => humanEducationBucket(k))
                : [t("chart.emptyDash")],
              ugHist.keys.length ? ugHist.values : [0],
              {
                xTitle: t("chart.axisPeople"),
                barColors: ugHist.keys.length
                  ? ugHist.keys.map((_, i) => pal[i % pal.length]!)
                  : [chartMutedColor()],
                maxBarThickness: 36,
              },
            ),
          ),
        mountSecondary: (canvas) =>
          mkChart(
            canvas,
            hBarConfig(
              grHist.keys.length
                ? grHist.keys.map((k) => humanEducationBucket(k))
                : [t("chart.emptyDash")],
              grHist.keys.length ? grHist.values : [0],
              {
                xTitle: t("chart.axisPeople"),
                barColors: grHist.keys.length
                  ? grHist.keys.map((_, i) => pal[i % pal.length]!)
                  : [chartMutedColor()],
                maxBarThickness: 36,
              },
            ),
          ),
      },
      {
        id: "bgu-degree-major",
        label: t("chart.tabDegreeMajor"),
        mount: (canvas) =>
          mkChart(
            canvas,
            hBarConfig(
              majorsAll.map((r) => r.label),
              majorsAll.map((r) => r.count),
              {
                xTitle: t("chart.axisPeople"),
                barColors: majorBarColors,
                maxBarThickness: 18,
                labelTruncate: 36,
              },
            ),
          ),
      },
    ];
    sample = (tabId: string) => {
      const bf = formatLocaleInt(d.stemOverallTotalN);
      if (tabId === "bgu-cohort-overlap") {
        return subs("chart.sampleBguCohortOverlap", {
          n: formatLocaleInt(d.cohortVenn.totals.totalProfiles),
        });
      }
      if (tabId === "bgu-employer-treemap") {
        return subs("chart.sampleBguEmployerTreemap", {
          n: formatLocaleInt(d.bguTreemapRows.length),
        });
      }
      if (tabId === "bgu-field-mix") {
        return subs("chart.sampleBguFieldMix", { bf });
      }
      if (tabId === "bgu-degree-major") {
        return subs("chart.sampleBguDegreeMajor", {
          n: formatLocaleInt(d.educationFieldsPeopleSum),
        });
      }
      if (tabId === "bgu-residence") {
        const n = formatLocaleInt(d.bguRetentionLocationKnownN);
        return subs("chart.sampleBguResidence", { n });
      }
      return subs("chart.sampleBguDegreeField", {
        n: formatLocaleInt(d.bguBguDegreeFieldKnownSum),
      });
    };
  } else if (routeKey === "economy/jobs") {
    title = t("chart.titleJobsHiring");
    const topEmp = topN(d.companiesInBs, 14);
    const topInbound = topN(d.companiesInbound, 14);
    const topOutbound = topN(d.companiesOutbound, 14);
    const feederTop = topN(d.feederCities, 12);
    const destTop = topN(d.destinationCities, 12);
    const jobTypes = topN(
      d.jobTypesInBs.map((r) => ({
        label: humanIndustryBucket(r.label),
        count: r.count,
      })),
      10,
    );
    const indHome = d.jobTypeVsResidence.map((r) => ({
      label: humanIndustryBucket(r.industry),
      inBs: r.inBs,
      outsideBs: r.outsideBs,
    }));
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
      {
        id: "job_types",
        label: t("chart.tabJobTypes"),
        mount: (canvas) =>
          mkChart(
            canvas,
            hBarConfig(
              jobTypes.map((r) => r.label),
              jobTypes.map((r) => r.count),
              { xTitle: t("chart.axisPeople") },
            ),
          ),
      },
      {
        id: "industry_home",
        label: t("chart.tabIndustryVsHome"),
        mount: (canvas) =>
          mkChart(
            canvas,
            groupedHBarConfig(
              indHome.map((r) => r.label),
              [
                {
                  label: t("chart.legendLivesInBeerSheva"),
                  data: indHome.map((r) => r.inBs),
                },
                {
                  label: t("chart.legendLivesOutsideBeerSheva"),
                  data: indHome.map((r) => r.outsideBs),
                },
              ],
              { xTitle: t("chart.axisPeople") },
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
      if (tabId === "job_types") {
        return subs("chart.sampleJobsJobTypes", {
          n: formatLocaleInt(d.jobTypesInBsTotalN),
        });
      }
      if (tabId === "industry_home") {
        return t("chart.sampleJobsIndustryHome");
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
