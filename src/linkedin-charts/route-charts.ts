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
import { loadLinkedInData } from "./load-data";
import { mountChartPanel, type ChartTabDef } from "./chart-panel";

function mkChart(canvas: HTMLCanvasElement, cfg: object): AppChart {
  return new Chart(canvas, cfg as never) as AppChart;
}

export type ChartDisposer = () => void;

function truncateLabel(s: string, max = 28): string {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function humanSnake(s: string): string {
  return s
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function humanEducationBucket(s: string): string {
  const k = s.trim().toLowerCase();
  const m: Record<string, string> = {
    stem: "STEM",
    non_stem: "Non-STEM",
    medical: "Medical",
  };
  return m[k] ?? humanSnake(s);
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
  } = {},
): object {
  const barBg = perBarBackgroundColors(values.length, opts.barColors, accentPalette());
  const maxBar = opts.maxBarThickness ?? 22;
  return {
    type: "bar",
    data: {
      labels: labels.map((l) => truncateLabel(l, 34)),
      datasets: [
        {
          label: opts.xTitle ?? "Count",
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
    .map((k) => ({ label: truncateLabel(humanSnake(k), 36), count: byKey.get(k) ?? 0 }))
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
  const colDefs = [
    { key: "abroad" as const, label: "Abroad" },
    { key: "beerSheva" as const, label: "Beer Sheva" },
    { key: "israelOther" as const, label: "Elsewhere in Israel" },
  ];

  function paint() {
    parent.replaceChildren();
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
    corner.textContent = "Field";
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
        td.title = `${c.label}: ${raw.toLocaleString()} of ${known.toLocaleString()} with a known location (${pct}% of row)`;
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
    labels: entries.map(([k]) => truncateLabel(humanSnake(k), 34)),
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
    title = "Talent and education";
    const rw = mapToBarSeries(d.residentsWorkN, 14);
    const wr = mapToBarSeries(d.workersResidenceN, 14);
    tabs = [
      {
        id: "live-work",
        label: "Residents → workplaces",
        mount: (canvas) =>
          mkChart(
            canvas,
            hBarConfig(rw.labels, rw.values, { xTitle: "People" }),
          ),
      },
      {
        id: "work-live",
        label: "Workers → homes",
        mount: (canvas) =>
          mkChart(
            canvas,
            hBarConfig(wr.labels, wr.values, { xTitle: "People" }),
          ),
      },
    ];
    sample = `Residents in this view: ${d.residentsWorkTotalN.toLocaleString()} · People working in Beer Sheva: ${d.workersTotalN.toLocaleString()}`;
  } else if (routeKey === "network/talent-bgu") {
    title = "BGU alumni";
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
        id: "bgu-field-mix",
        label: "Field mix",
        mount: (canvas) =>
          mkChart(
            canvas,
            hBarConfig(
              stemRows.map((r) => humanEducationBucket(r.label)),
              stemRows.map((r) => r.count),
              {
                xTitle: "People",
                barColors: stemBarColors,
              },
            ),
          ),
      },
      {
        id: "bgu-residence",
        label: "Where they live",
        kind: "custom",
        mountCustom: (box) => mountBguRetentionHeatmap(box, retRows),
      },
      {
        id: "bgu-edu",
        label: "Degree × field",
        viewToggleLabels: ["Undergraduate", "Graduate"],
        mount: (canvas) =>
          mkChart(
            canvas,
            hBarConfig(
              ugHist.keys.length
                ? ugHist.keys.map((k) => humanEducationBucket(k))
                : ["—"],
              ugHist.keys.length ? ugHist.values : [0],
              {
                xTitle: "People",
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
                : ["—"],
              grHist.keys.length ? grHist.values : [0],
              {
                xTitle: "People",
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
        label: "Degree × Major",
        mount: (canvas) =>
          mkChart(
            canvas,
            hBarConfig(
              majorsAll.map((r) => r.label),
              majorsAll.map((r) => r.count),
              {
                xTitle: "People",
                barColors: majorBarColors,
                maxBarThickness: 18,
              },
            ),
          ),
      },
    ];
    sample = (tabId: string) => {
      const bf = d.stemOverallTotalN.toLocaleString();
      if (tabId === "bgu-field-mix") {
        return `Counts ${bf} people with a medical, STEM, or non-STEM field label in the export—everyone without that classification is excluded.`;
      }
      if (tabId === "bgu-degree-major") {
        return `${d.educationFieldsPeopleSum.toLocaleString()} people with a known major on file; each bar adds STEM and non-STEM rows that share the same major name.`;
      }
      if (tabId === "bgu-residence") {
        const n = d.bguRetentionLocationKnownN.toLocaleString();
        return `${n} people in this extract: specified medical, STEM, or non-STEM field (not unspecified) and a known residence abroad, in Beer Sheva, or elsewhere in Israel. Unknown location is excluded from the table and from each row's percentages.`;
      }
      return `${d.bguBguDegreeFieldKnownSum.toLocaleString()} people sit in known BGU degree × field cells; the toggles split undergraduate from graduate, doctoral, and professional without implying the full graduate list.`;
    };
  } else if (routeKey === "economy/jobs") {
    title = "Jobs and hiring";
    const topEmp = topN(d.companiesInBs, 14);
    const topInbound = topN(d.companiesInbound, 14);
    const topOutbound = topN(d.companiesOutbound, 14);
    const feederTop = topN(d.feederCities, 12);
    const destTop = topN(d.destinationCities, 12);
    const jobTypes = topN(
      d.jobTypesInBs.map((r) => ({ label: humanSnake(r.label), count: r.count })),
      10,
    );
    const indHome = d.jobTypeVsResidence.map((r) => ({
      label: humanSnake(r.industry),
      inBs: r.inBs,
      outsideBs: r.outsideBs,
    }));
    tabs = [
      {
        id: "employers",
        label: "Beer Sheva employers",
        mount: (canvas) =>
          mkChart(
            canvas,
            hBarConfig(
              topEmp.map((r) => truncateLabel(r.label, 36)),
              topEmp.map((r) => r.count),
              { xTitle: "Mentions" },
            ),
          ),
      },
      {
        id: "inbound",
        label: "Inbound hiring",
        mount: (canvas) =>
          mkChart(
            canvas,
            hBarConfig(
              topInbound.map((r) => truncateLabel(r.label, 36)),
              topInbound.map((r) => r.count),
              { xTitle: "Mentions" },
            ),
          ),
        mountSecondary: (canvas) =>
          mkChart(
            canvas,
            hBarConfig(
              feederTop.map((r) => truncateLabel(r.label, 32)),
              feederTop.map((r) => r.count),
              { xTitle: "Mentions" },
            ),
          ),
      },
      {
        id: "outbound",
        label: "Outbound hiring",
        mount: (canvas) =>
          mkChart(
            canvas,
            hBarConfig(
              topOutbound.map((r) => truncateLabel(r.label, 36)),
              topOutbound.map((r) => r.count),
              { xTitle: "Mentions" },
            ),
          ),
        mountSecondary: (canvas) =>
          mkChart(
            canvas,
            hBarConfig(
              destTop.map((r) => truncateLabel(r.label, 32)),
              destTop.map((r) => r.count),
              { xTitle: "Mentions" },
            ),
          ),
      },
      {
        id: "job_types",
        label: "Job types",
        mount: (canvas) =>
          mkChart(
            canvas,
            hBarConfig(
              jobTypes.map((r) => r.label),
              jobTypes.map((r) => r.count),
              { xTitle: "People" },
            ),
          ),
      },
      {
        id: "industry_home",
        label: "Industry vs home",
        mount: (canvas) =>
          mkChart(
            canvas,
            groupedHBarConfig(
              indHome.map((r) => r.label),
              [
                { label: "Lives in Beer Sheva", data: indHome.map((r) => r.inBs) },
                { label: "Lives outside Beer Sheva", data: indHome.map((r) => r.outsideBs) },
              ],
              { xTitle: "People" },
            ),
          ),
      },
    ];
    sample = (tabId: string) => {
      if (tabId === "inbound") {
        return `Total mentions: ${d.companiesInboundTotalN.toLocaleString()} (employers) and ${d.feederTotalN.toLocaleString()} (where people live).`;
      }
      if (tabId === "outbound") {
        return `Total mentions: ${d.companiesOutboundTotalN.toLocaleString()} (employers) and ${d.destinationTotalN.toLocaleString()} (where people work).`;
      }
      if (tabId === "job_types") {
        return `People counted in job-type buckets: ${d.jobTypesInBsTotalN.toLocaleString()}.`;
      }
      if (tabId === "industry_home") {
        return "Industry compared to living in or outside Beer Sheva.";
      }
      return `Total employer mentions in Beer Sheva: ${d.companiesInBsTotalN.toLocaleString()}.`;
    };
  } else {
    return null;
  }

  return mountChartPanel(root, { title, sampleNote: sample, tabs });
}
