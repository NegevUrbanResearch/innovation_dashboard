import {
  circlePath,
  computeTextCentres,
  intersectionAreaPath,
  normalizeSolution,
  scaleSolution,
  venn,
  type VennArea,
} from "venn.js";
import { formatLocaleInt, getLocale, subs, t, type MessageKey } from "../i18n";
import { chartMutedColor, chartTextColor } from "./chart-theme";
import { partitionPct, type CohortVennModel } from "./csv";

const NS = "http://www.w3.org/2000/svg";

const SET_BGU = "BGU";
const SET_RES = "RES";
const SET_WRK = "WRK";

/** Keep in sync with `cohort_venn_overlap.csv` venn_partition slugs. */
const PARTITION_ORDER = [
  "only_bgu",
  "only_beer_sheva_resident",
  "bgu_and_resident_not_worker",
  "only_beer_sheva_worker",
  "bgu_and_worker_not_resident",
  "resident_and_worker_not_bgu",
  "bgu_resident_and_worker",
] as const;

const SEGMENT_TO_SETS: Record<(typeof PARTITION_ORDER)[number], string[]> = {
  only_bgu: [SET_BGU],
  only_beer_sheva_resident: [SET_RES],
  only_beer_sheva_worker: [SET_WRK],
  bgu_and_resident_not_worker: [SET_BGU, SET_RES],
  bgu_and_worker_not_resident: [SET_BGU, SET_WRK],
  resident_and_worker_not_bgu: [SET_RES, SET_WRK],
  bgu_resident_and_worker: [SET_BGU, SET_RES, SET_WRK],
};

/** Fills for disjoint Venn partitions (readable singles + pairwise + triple). */
const REGION_FILL: Record<(typeof PARTITION_ORDER)[number], string> = {
  only_bgu: "rgba(147, 51, 234, 0.78)",
  only_beer_sheva_resident: "rgba(22, 163, 74, 0.78)",
  /** Worker-only lobe: stronger blue vs purple/green neighbors. */
  only_beer_sheva_worker: "rgba(30, 64, 175, 0.88)",
  bgu_and_resident_not_worker: "rgba(109, 40, 217, 0.55)",
  bgu_and_worker_not_resident: "rgba(76, 29, 149, 0.52)",
  resident_and_worker_not_bgu: "rgba(21, 94, 117, 0.62)",
  bgu_resident_and_worker: "rgba(52, 32, 88, 0.72)",
};

const CIRCLE_STROKE: Record<string, string> = {
  [SET_BGU]: "rgba(126, 34, 206, 0.95)",
  [SET_RES]: "rgba(21, 128, 61, 0.95)",
  [SET_WRK]: "rgba(29, 78, 216, 0.95)",
};

const LEGEND_DOT: Record<string, string> = {
  [SET_BGU]: "rgb(147, 51, 234)",
  [SET_RES]: "rgb(22, 163, 74)",
  [SET_WRK]: "rgb(37, 99, 235)",
};

function setsKey(sets: string[]): string {
  return [...sets].sort().join(",");
}

const SETS_KEY_TO_SEGMENT: Record<string, (typeof PARTITION_ORDER)[number]> = {};
for (const seg of PARTITION_ORDER) {
  SETS_KEY_TO_SEGMENT[setsKey(SEGMENT_TO_SETS[seg])] = seg;
}

function cohortSegmentLabelKey(seg: string): MessageKey {
  return `chart.cohortSegment.${seg}` as MessageKey;
}

function formatPercent(p: number): string {
  const loc = getLocale() === "he" ? "he-IL" : "en-US";
  return new Intl.NumberFormat(loc, {
    style: "percent",
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  }).format(p);
}

function partitionCount(data: CohortVennModel, segment: string): number {
  return data.partitions.find((p) => p.segment === segment)?.count ?? 0;
}

function nudgeLabelCentres(items: { x: number; y: number }[], vw: number, vh: number): void {
  if (items.length === 0) return;
  const scale = Math.sqrt((vw * vh) / (480 * 300));
  const minDist = Math.max(26, 24 * scale);
  const pad = Math.max(10, Math.min(vw, vh) * 0.038);
  const maxStep = Math.max(14, Math.min(vw, vh) * 0.068);
  for (let iter = 0; iter < 14; iter++) {
    let moved = false;
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        let dx = items[j].x - items[i].x;
        let dy = items[j].y - items[i].y;
        const dist = Math.hypot(dx, dy);
        if (dist >= minDist || dist < 1e-6) continue;
        dx /= dist;
        dy /= dist;
        const push = Math.min(maxStep * 0.38, (minDist - dist) * 0.52);
        items[i].x -= dx * push;
        items[i].y -= dy * push;
        items[j].x += dx * push;
        items[j].y += dy * push;
        moved = true;
      }
    }
    if (!moved && iter > 5) break;
  }
  for (const it of items) {
    it.x = Math.min(vw - pad, Math.max(pad, it.x));
    it.y = Math.min(vh - pad, Math.max(pad, it.y));
  }
}

function buildVennAreas(data: CohortVennModel): VennArea[] {
  return PARTITION_ORDER.map((seg) => ({
    sets: SEGMENT_TO_SETS[seg],
    size: partitionCount(data, seg),
  }));
}

function textCentreFor(
  centres: Record<string, { x: number; y: number; disjoint?: boolean }>,
  sets: string[],
): { x: number; y: number; disjoint?: boolean } | undefined {
  return centres[setsKey(sets)];
}

function appendSvgText(
  parent: SVGGElement,
  text: string,
  x: number,
  y: number,
  fill: string,
  fontSizePx: number,
  fontWeight?: string,
  className?: string,
): void {
  const el = document.createElementNS(NS, "text");
  el.textContent = text;
  if (className) el.setAttribute("class", className);
  el.setAttribute("x", String(x));
  el.setAttribute("y", String(y));
  el.setAttribute("text-anchor", "middle");
  el.setAttribute("dominant-baseline", "middle");
  el.setAttribute("fill", fill);
  el.setAttribute("font-size", String(fontSizePx));
  el.setAttribute("font-family", 'var(--font, system-ui), system-ui');
  el.setAttribute("stroke", "rgba(0,0,0,0.38)");
  el.setAttribute("stroke-width", fontSizePx >= 12 ? "2.5" : "2");
  el.setAttribute("paint-order", "stroke fill");
  if (fontWeight) el.setAttribute("font-weight", fontWeight);
  el.setAttribute("style", "unicode-bidi: isolate;");
  parent.appendChild(el);
}

export function mountBguCohortPartition(host: HTMLElement, data: CohortVennModel): () => void {
  host.classList.add("bgu-partition", "chart-custom-plot");

  const title = document.createElement("h3");
  title.className = "bgu-partition__title";

  const subtitle = document.createElement("p");
  subtitle.className = "bgu-partition__subtitle";

  const plot = document.createElement("div");
  plot.className = "bgu-partition__plot";

  const plotInner = document.createElement("div");
  plotInner.className = "bgu-partition__plot-inner";

  const legend = document.createElement("div");
  legend.className = "bgu-partition__legend";

  const tooltip = document.createElement("div");
  tooltip.className = "bgu-partition__tooltip";
  tooltip.setAttribute("aria-hidden", "true");
  tooltip.hidden = true;

  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("xmlns", NS);
  svg.setAttribute("dir", "ltr");
  svg.setAttribute("role", "group");

  const gRegions = document.createElementNS(NS, "g");
  gRegions.setAttribute("class", "bgu-partition__regions");
  const gCircles = document.createElementNS(NS, "g");
  gCircles.setAttribute("class", "bgu-partition__circles");
  const gLabels = document.createElementNS(NS, "g");
  gLabels.setAttribute("class", "bgu-partition__labels");
  const gHits = document.createElementNS(NS, "g");
  gHits.setAttribute("class", "bgu-partition__hits");
  svg.appendChild(gRegions);
  svg.appendChild(gCircles);
  svg.appendChild(gLabels);
  svg.appendChild(gHits);

  plotInner.appendChild(svg);
  plotInner.appendChild(legend);
  plot.appendChild(plotInner);
  plot.appendChild(tooltip);

  host.appendChild(title);
  host.appendChild(subtitle);
  host.appendChild(plot);

  let ro: ResizeObserver | null = null;
  let lastW = 0;
  let lastH = 0;

  function hideTooltip(): void {
    tooltip.hidden = true;
    tooltip.textContent = "";
  }

  plot.addEventListener("keydown", (ev: KeyboardEvent) => {
    if (ev.key === "Escape") hideTooltip();
  });

  function showTooltipAtPointer(cellTitle: string, clientX: number, clientY: number): void {
    tooltip.textContent = cellTitle;
    tooltip.hidden = false;
    void tooltip.offsetWidth;
    const gap = 14;
    const tw = tooltip.offsetWidth;
    const th = tooltip.offsetHeight;
    let lx = clientX + gap;
    let ly = clientY + gap;
    if (lx + tw > window.innerWidth - 8) lx = clientX - tw - gap;
    if (ly + th > window.innerHeight - 8) ly = clientY - th - gap;
    tooltip.style.left = `${Math.max(8, lx)}px`;
    tooltip.style.top = `${Math.max(8, ly)}px`;
  }

  function showTooltipForPath(el: SVGPathElement, cellTitle: string): void {
    tooltip.textContent = cellTitle;
    tooltip.hidden = false;
    void tooltip.offsetWidth;
    const r = el.getBoundingClientRect();
    const tw = tooltip.offsetWidth;
    const th = tooltip.offsetHeight;
    const gap = 8;
    let lx = r.left + r.width / 2 - tw / 2;
    let ly = r.bottom + gap;
    if (ly + th > window.innerHeight - 8) ly = Math.max(8, r.top - th - gap);
    if (lx + tw > window.innerWidth - 8) lx = window.innerWidth - tw - 8;
    if (lx < 8) lx = 8;
    tooltip.style.left = `${lx}px`;
    tooltip.style.top = `${ly}px`;
  }

  function renderLegend(total: number, rtl: boolean): void {
    legend.replaceChildren();
    legend.setAttribute("dir", rtl ? "rtl" : "ltr");

    const items: { setId: string; n: number; msg: MessageKey }[] = [
      { setId: SET_BGU, n: data.totals.nBguGraduates, msg: "chart.bguCohortVennLegendBgu" },
      { setId: SET_RES, n: data.totals.nBeerShevaResidents, msg: "chart.bguCohortVennLegendRes" },
      { setId: SET_WRK, n: data.totals.nBeerShevaWorkers, msg: "chart.bguCohortVennLegendWrk" },
    ];

    for (const row of items) {
      const wrap = document.createElement("div");
      wrap.className = "bgu-partition__legend-item";

      const dot = document.createElement("span");
      dot.className = "bgu-partition__legend-dot";
      dot.style.background = LEGEND_DOT[row.setId] ?? "#666";

      const lab = document.createElement("span");
      const pct = total > 0 ? row.n / total : 0;
      lab.textContent = subs(t(row.msg), {
        n: formatLocaleInt(row.n),
        pct: formatPercent(pct),
      });

      wrap.appendChild(dot);
      wrap.appendChild(lab);
      legend.appendChild(wrap);
    }
  }

  function paint(): void {
    const rtl = getLocale() === "he";
    tooltip.setAttribute("dir", rtl ? "rtl" : "ltr");
    host.setAttribute("dir", rtl ? "rtl" : "ltr");

    const total = data.totals.totalProfiles;
    const nStr = formatLocaleInt(total);

    title.textContent = t("chart.bguCohortPartitionTitle");
    subtitle.textContent = subs(t("chart.bguCohortPartitionSubtitle"), { n: nStr });
    svg.setAttribute("aria-label", subs(t("chart.bguCohortPartitionAria"), { n: nStr }));

    const textColor = chartTextColor();
    const muted = chartMutedColor();

    renderLegend(total, rtl);

    if (total <= 0 || lastW <= 0 || lastH <= 0) {
      gRegions.replaceChildren();
      gCircles.replaceChildren();
      gLabels.replaceChildren();
      gHits.replaceChildren();
      svg.setAttribute("viewBox", `0 0 ${Math.max(lastW, 1)} ${Math.max(lastH, 1)}`);
      const hint = document.createElementNS(NS, "text");
      hint.textContent = t("chart.emptyDash");
      hint.setAttribute("x", `${Math.max(lastW / 2, 0)}`);
      hint.setAttribute("y", `${Math.max(lastH / 2, 0)}`);
      hint.setAttribute("text-anchor", "middle");
      hint.setAttribute("dominant-baseline", "middle");
      hint.setAttribute("fill", muted);
      hint.setAttribute("font-size", "14");
      hint.setAttribute("font-family", "var(--font, system-ui), system-ui");
      gLabels.appendChild(hint);
      hideTooltip();
      return;
    }

    const areas = buildVennAreas(data);
    let solution: Record<string, { x: number; y: number; radius: number }>;
    let centres: Record<string, { x: number; y: number; disjoint?: boolean }>;
    try {
      const raw = venn(areas);
      const normalized = normalizeSolution(raw, Math.PI / 2, null);
      solution = scaleSolution(normalized, lastW, lastH, 14);
      centres = computeTextCentres(solution, areas) as Record<
        string,
        { x: number; y: number; disjoint?: boolean }
      >;
    } catch {
      gRegions.replaceChildren();
      gCircles.replaceChildren();
      gLabels.replaceChildren();
      gHits.replaceChildren();
      svg.setAttribute("viewBox", `0 0 ${lastW} ${lastH}`);
      const hint = document.createElementNS(NS, "text");
      hint.textContent = t("chart.bguCohortVennLayoutError");
      hint.setAttribute("x", `${lastW / 2}`);
      hint.setAttribute("y", `${lastH / 2}`);
      hint.setAttribute("text-anchor", "middle");
      hint.setAttribute("dominant-baseline", "middle");
      hint.setAttribute("fill", muted);
      hint.setAttribute("font-size", "13");
      hint.setAttribute("font-family", "var(--font, system-ui), system-ui");
      gLabels.appendChild(hint);
      hideTooltip();
      return;
    }

    svg.setAttribute("viewBox", `0 0 ${lastW} ${lastH}`);

    gRegions.replaceChildren();
    gCircles.replaceChildren();
    gLabels.replaceChildren();
    gHits.replaceChildren();

    const nonemptyMax = Math.max(...areas.map((a) => a.size), 1);

    for (const area of areas) {
      if (area.size <= 0) continue;
      const seg = SETS_KEY_TO_SEGMENT[setsKey(area.sets)];
      if (!seg) continue;
      const circlesForFill = area.sets.map((s) => solution[s]).filter(Boolean) as {
        x: number;
        y: number;
        radius: number;
      }[];
      if (circlesForFill.length === 0) continue;
      const dReg = intersectionAreaPath(circlesForFill);
      const regPath = document.createElementNS(NS, "path");
      regPath.setAttribute("d", dReg);
      regPath.setAttribute("fill", REGION_FILL[seg] ?? "rgba(100,116,139,0.65)");
      regPath.setAttribute("stroke", "none");
      regPath.setAttribute("class", "bgu-partition__region");
      regPath.setAttribute("pointer-events", "none");
      gRegions.appendChild(regPath);
    }

    const setIds = [SET_BGU, SET_RES, SET_WRK];
    const byRadius = setIds
      .map((id) => ({ id, r: solution[id]?.radius ?? 0 }))
      .sort((a, b) => b.r - a.r);

    for (const { id } of byRadius) {
      const c = solution[id];
      if (!c || c.radius <= 0) continue;
      const path = document.createElementNS(NS, "path");
      path.setAttribute("d", circlePath(c.x, c.y, c.radius));
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", CIRCLE_STROKE[id] ?? "#64748b");
      path.setAttribute("stroke-width", "2");
      path.setAttribute("class", "bgu-partition__circle-outline");
      path.setAttribute("pointer-events", "none");
      gCircles.appendChild(path);
    }

    const labelFont =
      lastW < 380 || lastH < 260 ? 12.5 : lastW < 480 || lastH < 310 ? 13.5 : 14.5;

    type LblInst = {
      seg: (typeof PARTITION_ORDER)[number];
      x: number;
      y: number;
      line1: string;
      line2: string;
    };
    const labelPlans: LblInst[] = [];
    for (const area of areas) {
      if (area.size <= 0) continue;
      const seg = SETS_KEY_TO_SEGMENT[setsKey(area.sets)];
      if (!seg) continue;
      const tc = textCentreFor(centres, area.sets);
      if (!tc || tc.disjoint) continue;

      const pct = partitionPct(data, seg);
      const label = t(cohortSegmentLabelKey(seg));
      const pctStr = formatPercent(pct);
      const countStr = formatLocaleInt(area.size);
      const tinySlice = area.size < nonemptyMax * 0.06 || pct < 0.015;
      const line2 = tinySlice ? pctStr : `${countStr} · ${pctStr}`;
      labelPlans.push({ seg, x: tc.x, y: tc.y, line1: label, line2 });
    }
    nudgeLabelCentres(labelPlans, lastW, lastH);
    for (let i = 0; i < labelPlans.length; i++) {
      const lp = labelPlans[i]!;
      const dy = labelFont * 0.55;
      appendSvgText(gLabels, lp.line1, lp.x, lp.y - dy, textColor, labelFont, "600", "bgu-partition__label-line");
      appendSvgText(gLabels, lp.line2, lp.x, lp.y + dy, muted, labelFont - 0.65, undefined, "bgu-partition__label-line");
    }

    const hits = [...areas].sort((a, b) => a.size - b.size);
    for (const area of hits) {
      if (area.size <= 0) continue;
      const seg = SETS_KEY_TO_SEGMENT[setsKey(area.sets)];
      if (!seg) continue;
      const circlesForPath = area.sets.map((s) => solution[s]).filter(Boolean) as {
        x: number;
        y: number;
        radius: number;
      }[];
      if (circlesForPath.length === 0) continue;

      const d = intersectionAreaPath(circlesForPath);
      const path = document.createElementNS(NS, "path");
      path.setAttribute("d", d);
      path.setAttribute("fill", "rgba(0,0,0,0)");
      path.setAttribute("stroke", "none");
      path.setAttribute("pointer-events", "fill");

      const pct = partitionPct(data, seg);
      const label = t(cohortSegmentLabelKey(seg));
      const cellTitle = `${label} — ${formatLocaleInt(area.size)} (${formatPercent(pct)})`;
      path.setAttribute("title", cellTitle);
      path.setAttribute("tabindex", "0");
      path.setAttribute("aria-label", cellTitle);
      path.setAttribute("class", "bgu-partition__hit");

      path.addEventListener("mousemove", (ev: MouseEvent) => {
        showTooltipAtPointer(cellTitle, ev.clientX, ev.clientY);
      });
      path.addEventListener("mouseleave", hideTooltip);
      path.addEventListener("focus", () => showTooltipForPath(path, cellTitle));
      path.addEventListener("blur", hideTooltip);

      gHits.appendChild(path);
    }

    hideTooltip();
  }

  function layoutSizes(): void {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const rect = svg.getBoundingClientRect();
        lastW = Math.max(1, Math.floor(rect.width));
        lastH = Math.max(1, Math.floor(rect.height));
        paint();
      });
    });
  }

  const onExternal = (): void => {
    layoutSizes();
  };
  window.addEventListener("bsid-theme-change", onExternal);
  window.addEventListener("bsid-locale-change", onExternal);

  ro = new ResizeObserver(() => layoutSizes());
  ro.observe(plotInner);
  queueMicrotask(() => layoutSizes());

  return () => {
    window.removeEventListener("bsid-theme-change", onExternal);
    window.removeEventListener("bsid-locale-change", onExternal);
    ro?.disconnect();
    ro = null;
    host.removeAttribute("dir");
    host.replaceChildren();
    host.classList.remove("bgu-partition", "chart-custom-plot");
  };
}
