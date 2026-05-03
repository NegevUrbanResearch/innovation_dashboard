import {
  hierarchy,
  type HierarchyRectangularNode,
  treemap as d3treemap,
  treemapSquarify,
} from "d3-hierarchy";
import { interpolateViridis } from "d3-scale-chromatic";
import { scaleSequential } from "d3-scale";
import type { BguTreemapRow } from "./csv";
import {
  buildEmployerEducationHierarchy,
  buildSectorCompanyHierarchy,
  flattenBucketEmployersForLayout,
  type BguTreemapHierarchyDatum,
  type BguTreemapUnknownTotals,
  partitionTreemapRows,
  uniqueResidencePanels,
} from "./aggregates/bgu-treemap-model";
import { chartBorderColor, chartTextColor, sectorTreemapBucketColor } from "./chart-theme";
import { formatLocaleInt, getLocale, subs, t, type MessageKey } from "../i18n";
import {
  treemapEducationKey,
  treemapIndustryBucketKey,
  treemapIndustrySegmentKey,
  treemapResidencePanelKey,
  treemapUnmappedLabelKey,
} from "../messages/industry-labels";
const NS = "http://www.w3.org/2000/svg";

type BucketColorFn = (slug: string) => string;

/** Internal marker merged when row cap applies (`rows.length > 2000`). */
const OTHER_EMP_KEY = "__bgu_treemap_other__";
const LABEL_PAD = 4;
type ViewState =
  | { kind: "sectors"; panel: string; focusBucket: string | null }
  | { kind: "education"; panel: string; employer: string };
function formatPercent(p: number): string {
  const loc = getLocale() === "he" ? "he-IL" : "en-US";
  return new Intl.NumberFormat(loc, {
    style: "percent",
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  }).format(p);
}
function treemapMsg(slug: string, keyOf: (s: string) => MessageKey): string {
  const key = keyOf(slug);
  const template = t(key);
  return key === treemapUnmappedLabelKey ? subs(template, { slug }) : template;
}
function employerDisplayName(raw: string): string {
  return raw === OTHER_EMP_KEY ? t("chart.bguTreemapOtherBucket") : raw;
}
function panelUnknownTotals(rows: BguTreemapRow[], panel: string): BguTreemapUnknownTotals {
  return partitionTreemapRows(rows.filter((r) => r.residencePanel === panel)).unknownTotals;
}
function formatUnknownFooter(totals: BguTreemapUnknownTotals): string {
  const sep = t("chart.bguTreemapUnknownSep");
  const parts: string[] = [];
  if (totals.unknownBucketN > 0) {
    parts.push(
      subs(t("chart.bguTreemapUnknownPartBucket"), {
        n: formatLocaleInt(totals.unknownBucketN),
      }),
    );
  }
  if (totals.unknownSegmentN > 0) {
    parts.push(
      subs(t("chart.bguTreemapUnknownPartSegment"), {
        n: formatLocaleInt(totals.unknownSegmentN),
      }),
    );
  }
  if (totals.unknownEducationN > 0) {
    parts.push(
      subs(t("chart.bguTreemapUnknownPartEducation"), {
        n: formatLocaleInt(totals.unknownEducationN),
      }),
    );
  }
  if (parts.length === 0) return "";
  return subs(t("chart.bguTreemapUnknownNote"), { parts: parts.join(sep) });
}
function residencePanelOptionLabel(raw: string): string {
  const key = treemapResidencePanelKey(raw);
  return key === treemapUnmappedLabelKey ? subs(t(key), { slug: raw }) : t(key);
}
/**
 * When the aggregate extract is large, cap to top 39 named employers per bucket
 * and merge the tail into a localized "Other" pseudo-employer.
 */
function mergeRareEmployersAcrossBuckets(rows: BguTreemapRow[]): BguTreemapRow[] {
  if (rows.length <= 2000) return rows;
  const out: BguTreemapRow[] = [];
  for (const panel of uniqueResidencePanels(rows)) {
    const base = rows.filter((r) => r.residencePanel === panel);
    const byBucket = new Map<string, BguTreemapRow[]>();
    for (const r of base) {
      const arr = byBucket.get(r.industryBucket) ?? [];
      arr.push(r);
      byBucket.set(r.industryBucket, arr);
    }
    for (const [, bucketRows] of byBucket) {
      const empSum = new Map<string, number>();
      for (const r of bucketRows) {
        empSum.set(r.employer, (empSum.get(r.employer) ?? 0) + r.n);
      }
      const sorted = [...empSum.entries()].sort((a, b) => b[1] - a[1]);
      if (sorted.length <= 40) {
        out.push(...bucketRows);
        continue;
      }
      const keep = new Set(sorted.slice(0, 39).map(([e]) => e));
      for (const r of bucketRows) {
        out.push(keep.has(r.employer) ? r : { ...r, employer: OTHER_EMP_KEY });
      }
    }
  }
  return out;
}
/** Stroke on tile fills — higher contrast between same-bucket neighbours. */
function mixStroke(fill: string, strength = 0.5): string {
  const f = fill.trim();
  const pct = Math.round((1 - strength) * 100);
  if (f.startsWith("#") && f.length === 7) {
    return `color-mix(in srgb, ${f} ${pct}%, ${chartBorderColor()})`;
  }
  if (f.startsWith("rgb")) {
    return `color-mix(in srgb, ${f} ${pct}%, ${chartBorderColor()})`;
  }
  return chartBorderColor();
}
function appendCellClipPath(
  defs: SVGDefsElement,
  clipId: string,
  rect: { x: number; y: number; w: number; h: number },
): void {
  const cp = document.createElementNS(NS, "clipPath");
  cp.setAttribute("id", clipId);
  const cr = document.createElementNS(NS, "rect");
  cr.setAttribute("x", String(rect.x));
  cr.setAttribute("y", String(rect.y));
  cr.setAttribute("width", String(Math.max(rect.w, 0)));
  cr.setAttribute("height", String(Math.max(rect.h, 0)));
  cp.appendChild(cr);
  defs.appendChild(cp);
}

function tspansOverflow(innerW: number, textEl: SVGTextElement): boolean {
  for (let node = textEl.firstChild; node; node = node.nextSibling) {
    if (node instanceof SVGTSpanElement) {
      if (node.getComputedTextLength() > innerW + 0.55) return true;
    }
  }
  if (!textEl.querySelector("tspan") && textEl.getComputedTextLength() > innerW + 0.55) return true;
  return false;
}
const LABEL_MIN_W = 48;
const LABEL_MIN_H = 28;
const LABEL_MIN_AREA = 1000;
const LABEL_FS_MIN = 7;
const LABEL_FS_STEP = 0.42;

function graphemeClusters(s: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const seg = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    return [...seg.segment(s)].map((g) => g.segment);
  }
  return Array.from(s);
}

/** Greedy wrap to pixel width using live SVG measurement (handles Hebrew without spaces). */
function wrapTitleToLines(
  title: string,
  innerW: number,
  measure: (s: string) => number,
): string[] {
  const t = title.trim();
  if (!t) return [];
  if (measure(t) <= innerW) return [t];

  const words = t.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    const out: string[] = [];
    let cur = "";
    for (const word of words) {
      const trial = cur ? `${cur} ${word}` : word;
      if (measure(trial) <= innerW) cur = trial;
      else {
        if (cur) out.push(cur);
        cur = measure(word) <= innerW ? word : ellipsizeToWidth(word, measure, innerW);
      }
    }
    if (cur) out.push(cur);
    if (out.length && out.every((ln) => measure(ln) <= innerW)) return out;
  }

  const clusters = graphemeClusters(t);
  const lines: string[] = [];
  let buf = "";
  for (const ch of clusters) {
    const trial = buf + ch;
    if (measure(trial) <= innerW) buf = trial;
    else {
      if (buf) lines.push(buf);
      buf = measure(ch) <= innerW ? ch : ellipsizeToWidth(ch, measure, innerW);
    }
  }
  if (buf) lines.push(buf);
  return lines;
}

function ellipsizeToWidth(s: string, measure: (s: string) => number, maxW: number): string {
  const ellipsis = "…";
  if (measure(s) <= maxW) return s;
  const g = graphemeClusters(s);
  let lo = 0;
  let hi = g.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const piece = g.slice(0, mid).join("") + ellipsis;
    if (measure(piece) <= maxW) lo = mid;
    else hi = mid - 1;
  }
  return g.slice(0, lo).join("") + ellipsis;
}

/** Word-/grapheme-wrapped labels; clipped to leaf rect and measured via `getComputedTextLength`. */
function layOutTreemapLabels(
  defs: SVGDefsElement,
  gLabelsParent: SVGGElement,
  cellClipId: string,
  rect: { x: number; y: number; w: number; h: number },
  line1: string,
  pctStr: string,
  // Reserved for directional label tweaks; SVG labels stay LTR.
  _rtl: boolean,
): void {
  const pad = LABEL_PAD;
  const { x, y, w, h } = rect;
  if (w < LABEL_MIN_W || h < LABEL_MIN_H || w * h < LABEL_MIN_AREA) return;

  const innerW = Math.max(0, w - pad * 2);
  if (innerW < 6) return;
  const area = Math.max(0, w * h);
  let fsBias = Math.min(15, Math.max(LABEL_FS_MIN + 1, Math.sqrt(area) / 7));

  appendCellClipPath(defs, cellClipId, rect);
  const clipWrap = document.createElementNS(NS, "g");
  clipWrap.setAttribute("clip-path", `url(#${cellClipId})`);
  gLabelsParent.appendChild(clipWrap);

  const x0 = x + pad;
  const fontFamily = 'var(--font, system-ui), system-ui';

  const measureEl = document.createElementNS(NS, "text");
  measureEl.setAttribute("font-family", fontFamily);
  measureEl.setAttribute("visibility", "hidden");
  measureEl.setAttribute("pointer-events", "none");
  clipWrap.appendChild(measureEl);
  const measureAt = (s: string, size: number): number => {
    measureEl.setAttribute("font-size", String(size));
    measureEl.textContent = s;
    return measureEl.getComputedTextLength();
  };

  function clearVisibleLabels(): void {
    for (let i = clipWrap.childNodes.length - 1; i >= 0; i--) {
      const n = clipWrap.childNodes.item(i)!;
      if (n !== measureEl) clipWrap.removeChild(n);
    }
  }

  /** Returns true once two-line (title+pct) or pct-only fits within clip rect. */
  function attemptPackTitle(titleEff: string, fsBiasLocal: number): boolean {
    for (let fs = fsBiasLocal; fs >= LABEL_FS_MIN - 1e-9; fs -= LABEL_FS_STEP) {
      clearVisibleLabels();
      const fsUse = Math.max(LABEL_FS_MIN, fs);
      const fsSmall = Math.min(14.5, Math.max(LABEL_FS_MIN, fsUse * 0.89));
      const lineHeight = fsUse * 1.18;
      const pctLineH = fsSmall * 1.15;
      const gapBeforePct = Math.max(4, fsUse * 0.35);

      const measureTitle = (s: string) => measureAt(s, fsUse);
      const lines = wrapTitleToLines(titleEff, innerW, measureTitle);

      const titleH = lines.length * lineHeight;
      const needHTwo = pad * 2 + titleH + gapBeforePct + pctLineH;
      const needHPctOnly = pad * 2 + pctLineH;

      if (lines.length > 0 && h >= needHTwo && innerW >= 8) {
        const textEl = document.createElementNS(NS, "text");
        textEl.setAttribute("x", String(x0));
        textEl.setAttribute("y", String(y + pad));
        textEl.setAttribute("dominant-baseline", "hanging");
        textEl.setAttribute("text-anchor", "start");
        textEl.setAttribute("fill", chartTextColor());
        textEl.setAttribute("font-size", String(fsUse));
        textEl.setAttribute("font-family", fontFamily);
        textEl.setAttribute("class", "bgu-treemap__cell-label");
        textEl.setAttribute("pointer-events", "none");
        textEl.setAttribute("style", "unicode-bidi: isolate; direction: ltr;");
        lines.forEach((ln, li) => {
          const tsp = document.createElementNS(NS, "tspan");
          tsp.setAttribute("x", String(x0));
          tsp.setAttribute("dy", li === 0 ? "0" : String(lineHeight));
          tsp.textContent = ln;
          textEl.appendChild(tsp);
        });

        const pctY = y + pad + titleH + gapBeforePct + fsSmall;
        const pctEl = document.createElementNS(NS, "text");
        pctEl.setAttribute("x", String(x0));
        pctEl.setAttribute("y", String(pctY));
        pctEl.setAttribute("dominant-baseline", "hanging");
        pctEl.setAttribute("text-anchor", "start");
        pctEl.setAttribute("fill", chartTextColor());
        pctEl.setAttribute("font-size", String(fsSmall));
        pctEl.setAttribute("font-family", fontFamily);
        pctEl.setAttribute("class", "bgu-treemap__cell-label bgu-treemap__cell-label--muted");
        pctEl.setAttribute("pointer-events", "none");
        pctEl.setAttribute("style", "unicode-bidi: isolate; direction: ltr;");
        pctEl.textContent = pctStr;

        clipWrap.insertBefore(textEl, measureEl);
        clipWrap.insertBefore(pctEl, measureEl);

        const bottom = pctY + pctLineH;
        const fitsY = bottom <= y + h - pad * 0.5;
        const pctOk =
          pctStr.trim().length === 0 || pctEl.getComputedTextLength() <= innerW + 0.55;
        if (!tspansOverflow(innerW, textEl) && pctOk && fitsY) return true;

        clipWrap.removeChild(textEl);
        clipWrap.removeChild(pctEl);
      }

      if (h >= needHPctOnly) {
        const tp = document.createElementNS(NS, "text");
        tp.setAttribute("x", String(x0));
        tp.setAttribute("y", String(y + h / 2));
        tp.setAttribute("dominant-baseline", "middle");
        tp.setAttribute("text-anchor", "start");
        tp.setAttribute("fill", chartTextColor());
        tp.setAttribute("font-size", String(fsSmall));
        tp.setAttribute("font-family", fontFamily);
        tp.setAttribute("class", "bgu-treemap__cell-label bgu-treemap__cell-label--muted");
        tp.setAttribute("pointer-events", "none");
        tp.setAttribute("style", "unicode-bidi: isolate; direction: ltr;");
        tp.textContent = pctStr;
        clipWrap.insertBefore(tp, measureEl);
        if (pctStr.trim().length > 0 && tp.getComputedTextLength() <= innerW + 0.55 && h >= fsSmall + pad * 1.2)
          return true;
        clipWrap.removeChild(tp);
      }
    }
    return false;
  }

  try {
    let ok =
      attemptPackTitle(line1, fsBias) ||
      attemptPackTitle(
        ellipsizeToWidth(line1.trim(), (s) => measureAt(s, LABEL_FS_MIN), innerW),
        LABEL_FS_MIN,
      );
    if (!ok && pctStr.trim().length === 0) ok = attemptPackTitle("", LABEL_FS_MIN);
    if (measureEl.parentNode === clipWrap) clipWrap.removeChild(measureEl);
    if (!ok) {
      clearVisibleLabels();
      clipWrap.remove();
    }
  } catch {
    clipWrap.remove();
  }
}

export function mountBguEmployerTreemap(host: HTMLElement, rows: BguTreemapRow[]): () => void {
  const mountId = `bgu-treemap-${Math.random().toString(36).slice(2, 9)}`;
  host.classList.add("bgu-treemap", "chart-custom-plot");
  const toolbar = document.createElement("div");
  toolbar.className = "bgu-treemap__toolbar";
  const legend = document.createElement("div");
  legend.className = "bgu-treemap__legend";
  legend.setAttribute("aria-label", t("chart.bguTreemapBucketLegendTitle"));
  const panelRow = document.createElement("div");
  panelRow.className = "bgu-treemap__toolbar-row";
  const panelSelect = document.createElement("select");
  panelSelect.className = "bgu-treemap__panel-select";
  panelSelect.setAttribute("aria-label", t("chart.bguTreemapPanelFilterAria"));
  const crumb = document.createElement("span");
  crumb.className = "bgu-treemap__crumb";
  crumb.setAttribute("aria-live", "polite");
  const backBtn = document.createElement("button");
  backBtn.type = "button";
  backBtn.className = "bgu-treemap__back";
  backBtn.textContent = t("chart.bguTreemapBack");
  backBtn.hidden = true;
  panelRow.append(panelSelect, crumb, backBtn);
  toolbar.append(legend, panelRow);
  const plot = document.createElement("div");
  plot.className = "bgu-treemap__plot";
  const unknownNote = document.createElement("div");
  unknownNote.className = "bgu-treemap__unknown-note";
  unknownNote.hidden = true;
  const tooltip = document.createElement("div");
  tooltip.className = "bgu-treemap__tooltip";
  tooltip.setAttribute("aria-hidden", "true");
  tooltip.hidden = true;
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("xmlns", NS);
  svg.setAttribute("dir", "ltr");
  svg.setAttribute("role", "img");
  svg.classList.add("bgu-treemap__svg");
  svg.style.display = "block";
  svg.style.width = "100%";
  svg.style.height = "100%";
  plot.append(svg, tooltip);
  host.append(toolbar, plot, unknownNote);
  const { usable: usableRaw } = partitionTreemapRows(rows);
  const dataRows = mergeRareEmployersAcrossBuckets(usableRaw);
  let view: ViewState = {
    kind: "sectors",
    panel: uniqueResidencePanels(dataRows)[0] ?? "",
    focusBucket: null,
  };
  let clipSeq = 0;
  let lastW = 0;
  let lastH = 0;
  let ro: ResizeObserver | null = null;
  let tipActive = false;
  function hideTooltip(): void {
    tipActive = false;
    tooltip.hidden = true;
    tooltip.replaceChildren();
  }
  function positionTooltip(clientX: number, clientY: number): void {
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
  function showTooltip(
    parts: { className: string; text: string }[],
    clientX: number,
    clientY: number,
  ): void {
    tooltip.replaceChildren();
    for (const p of parts) {
      const el = document.createElement("div");
      el.className = p.className;
      el.textContent = p.text;
      tooltip.appendChild(el);
    }
    tipActive = true;
    tooltip.hidden = false;
    tooltip.setAttribute("dir", getLocale() === "he" ? "rtl" : "ltr");
    positionTooltip(clientX, clientY);
  }
  function syncPanelOptions(): void {
    const panels = uniqueResidencePanels(dataRows);
    panelSelect.replaceChildren();
    for (const p of panels) {
      const opt = document.createElement("option");
      opt.value = p;
      opt.textContent = residencePanelOptionLabel(p);
      panelSelect.appendChild(opt);
    }
    if (!panels.includes(view.panel) && panels[0])
      view = { kind: "sectors", panel: panels[0], focusBucket: null };
    panelSelect.value = view.panel;
  }
  function goBack(): void {
    if (view.kind !== "education") return;
    view = { kind: "sectors", panel: view.panel, focusBucket: null };
    paint(true);
  }
  function drillToEmployer(panel: string, employer: string): void {
    hideTooltip();
    view = { kind: "education", panel, employer };
    paint(true);
  }

  function toggleSectorFocus(bucketKey: string): void {
    if (view.kind !== "sectors") return;
    const next = view.focusBucket === bucketKey ? null : bucketKey;
    hideTooltip();
    view = { kind: "sectors", panel: view.panel, focusBucket: next };
    paint(true);
  }

  function syncFooterAndLegend(
    svgKind: "empty" | "sectors" | "education",
    panelKey: string,
    bucketNamesSorted: string[],
    bucketColor: BucketColorFn,
  ): void {
    const ut = panelUnknownTotals(rows, panelKey);
    const note = formatUnknownFooter(ut);
    unknownNote.hidden = note === "";
    unknownNote.textContent = note;
    legend.replaceChildren();
    if (svgKind !== "sectors" || bucketNamesSorted.length === 0) {
      const cap = document.createElement("div");
      cap.className = "bgu-treemap__legend-caption";
      cap.textContent =
        svgKind === "education"
          ? t("chart.bguTreemapEducationGradientLegend")
          : "";
      legend.appendChild(cap);
      legend.hidden = svgKind !== "education";
      legend.setAttribute(
        "aria-label",
        svgKind === "education"
          ? t("chart.bguTreemapEducationGradientLegend")
          : t("chart.bguTreemapBucketLegendTitle"),
      );
      return;
    }
    legend.hidden = false;
    legend.setAttribute("aria-label", t("chart.bguTreemapBucketLegendTitle"));
    const title = document.createElement("div");
    title.className = "bgu-treemap__legend-title";
    title.textContent = t("chart.bguTreemapBucketLegendTitle");

    let showAllBtn: HTMLButtonElement | null = null;
    const focusKey = view.kind === "sectors" ? view.focusBucket : null;
    if (focusKey) {
      showAllBtn = document.createElement("button");
      showAllBtn.type = "button";
      showAllBtn.className = "bgu-treemap__legend-show-all";
      showAllBtn.textContent = t("chart.bguTreemapLegendShowAll");
      showAllBtn.setAttribute("aria-label", t("chart.bguTreemapLegendShowAllAria"));
      showAllBtn.addEventListener("click", () => {
        hideTooltip();
        view = { kind: "sectors", panel: view.panel, focusBucket: null };
        paint(true);
      });
      showAllBtn.addEventListener("keydown", (ev: KeyboardEvent) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          hideTooltip();
          view = { kind: "sectors", panel: view.panel, focusBucket: null };
          paint(true);
        }
      });
    }

    const rail = document.createElement("div");
    rail.className = "bgu-treemap__legend-rail";
    for (const bucket of bucketNamesSorted) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "bgu-treemap__legend-btn";
      const bucketLabelTxt = treemapMsg(bucket, treemapIndustryBucketKey);
      btn.setAttribute(
        "aria-label",
        subs(t("chart.bguTreemapLegendFilterAria"), { sector: bucketLabelTxt }),
      );
      const pressed = view.kind === "sectors" && view.focusBucket === bucket;
      btn.setAttribute("aria-pressed", pressed ? "true" : "false");
      const dot = document.createElement("span");
      dot.className = "bgu-treemap__legend-swatch";
      dot.style.background = bucketColor(bucket);
      dot.setAttribute("aria-hidden", "true");
      const lab = document.createElement("span");
      lab.className = "bgu-treemap__legend-label";
      lab.textContent = bucketLabelTxt;
      btn.append(dot, lab);
      btn.addEventListener("click", () => toggleSectorFocus(bucket));
      btn.addEventListener("keydown", (ev: KeyboardEvent) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          toggleSectorFocus(bucket);
        }
      });
      rail.appendChild(btn);
    }
    legend.append(title);
    if (showAllBtn) legend.append(showAllBtn);
    legend.append(rail);
  }
  function paint(animate = false): void {
    syncPanelOptions();
    const rtl = getLocale() === "he";
    host.setAttribute("dir", rtl ? "rtl" : "ltr");
    crumb.textContent =
      view.kind === "sectors"
        ? t("chart.bguTreemapBreadcrumbSectors")
        : employerDisplayName(view.employer);
    backBtn.hidden = view.kind === "sectors";
    const sectorRootForTotal = buildSectorCompanyHierarchy(dataRows, view.panel);
    const panelTotal = sectorRootForTotal.value ?? 0;
    const bucketColor = sectorTreemapBucketColor;
    function paintEducationDrill(
      rootGroup: SVGGElement,
      defsEl: SVGDefsElement,
      panelTot: number,
      panelKey: string,
      employerKey: string,
      anim: boolean,
    ): void {
      const eduRoot = buildEmployerEducationHierarchy(dataRows, panelKey, employerKey);
      const empTotal = eduRoot.value ?? 0;
      d3treemap<BguTreemapHierarchyDatum>()
        .tile(treemapSquarify)
        .size([lastW, lastH])
        .paddingOuter(4)
        .paddingInner(2)
        .round(false)(eduRoot);
      const clipId = `${mountId}-${clipSeq++}`;
      const cp = document.createElementNS(NS, "clipPath");
      cp.setAttribute("id", clipId);
      const cr = document.createElementNS(NS, "rect");
      cr.setAttribute("width", String(lastW));
      cr.setAttribute("height", String(lastH));
      cp.appendChild(cr);
      defsEl.appendChild(cp);
      const gCells = document.createElementNS(NS, "g");
      gCells.setAttribute("clip-path", `url(#${clipId})`);
      const gLabels = document.createElementNS(NS, "g");
      gLabels.setAttribute("class", "bgu-treemap__labels-layer");
      gLabels.setAttribute("pointer-events", "none");
      rootGroup.appendChild(gCells);
      rootGroup.appendChild(gLabels);
      const leaves = eduRoot.leaves() as HierarchyRectangularNode<BguTreemapHierarchyDatum>[];
      const sortedByVal = [...leaves].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
      const idxByLeaf = new Map(sortedByVal.map((l, i) => [l, i]));
      const maxI = Math.max(sortedByVal.length - 1, 1);
      const viridis = scaleSequential(interpolateViridis).domain([maxI, 0]);
      const empTitle = employerDisplayName(employerKey);
      for (const leaf of leaves) {
        const rw = leaf.x1 - leaf.x0;
        const rh = leaf.y1 - leaf.y0;
        if (rw < 1 || rh < 1) continue;
        const eduSlug = leaf.data.name;
        const eduLabel = treemapMsg(eduSlug, treemapEducationKey);
        const v = leaf.value ?? 0;
        const pctEmp = empTotal > 0 ? v / empTotal : 0;
        const pctPan = panelTot > 0 ? v / panelTot : 0;
        const rank = idxByLeaf.get(leaf) ?? 0;
        const fill = String(viridis(rank));
        const rect = document.createElementNS(NS, "rect");
        rect.setAttribute("x", String(leaf.x0));
        rect.setAttribute("y", String(leaf.y0));
        rect.setAttribute("width", String(rw));
        rect.setAttribute("height", String(rh));
        rect.setAttribute("fill", fill);
        rect.setAttribute("fill-opacity", "0.9");
        rect.setAttribute("stroke", mixStroke(fill, 0.55));
        rect.setAttribute("stroke-width", "1.4");
        rect.setAttribute("aria-label", `${eduLabel}. ${formatLocaleInt(v)}.`);
        const tipParts = [
          { className: "bgu-treemap__tip-title", text: eduLabel },
          {
            className: "bgu-treemap__tip-line",
            text: `${formatLocaleInt(v)} · ${formatPercent(pctEmp)} · ${empTitle}`,
          },
          {
            className: "bgu-treemap__tip-line",
            text: `${formatPercent(pctPan)} · ${residencePanelOptionLabel(panelKey)}`,
          },
        ];
        rect.setAttribute("tabindex", "0");
        rect.addEventListener("mouseenter", (ev) => showTooltip(tipParts, ev.clientX, ev.clientY));
        rect.addEventListener("mousemove", (ev) => {
          if (!tooltip.hidden) positionTooltip(ev.clientX, ev.clientY);
        });
        rect.addEventListener("mouseleave", () => {
          if (document.activeElement !== rect) hideTooltip();
        });
        rect.addEventListener("focus", () => {
          const rbb = rect.getBoundingClientRect();
          showTooltip(tipParts, rbb.left + rbb.width / 2, rbb.top + rbb.height / 2);
        });
        rect.addEventListener("blur", hideTooltip);
        gCells.appendChild(rect);
        layOutTreemapLabels(
          defsEl,
          gLabels,
          `${mountId}-lbl-${clipSeq++}`,
          { x: leaf.x0, y: leaf.y0, w: rw, h: rh },
          eduLabel,
          formatPercent(pctEmp),
          rtl,
        );
      }
      void anim;
    }
    const finishPaint = (): void => {
      svg.replaceChildren();
      const defs = document.createElementNS(NS, "defs");
      svg.appendChild(defs);
      const rootG = document.createElementNS(NS, "g");
      rootG.setAttribute("class", "bgu-treemap__layer");
      svg.appendChild(rootG);
      if (lastW <= 0 || lastH <= 0 || !view.panel || panelTotal <= 0) {
        svg.setAttribute("viewBox", `0 0 ${Math.max(lastW, 1)} ${Math.max(lastH, 1)}`);
        svg.setAttribute("aria-label", t("chart.bguTreemapBreadcrumbSectors"));
        const hint = document.createElementNS(NS, "text");
        hint.textContent = t("chart.emptyDash");
        hint.setAttribute("x", String(Math.max(lastW / 2, 0)));
        hint.setAttribute("y", String(Math.max(lastH / 2, 0)));
        hint.setAttribute("text-anchor", "middle");
        hint.setAttribute("fill", chartTextColor());
        hint.setAttribute("font-size", "14");
        hint.setAttribute("font-family", 'var(--font, system-ui), system-ui');
        rootG.appendChild(hint);
        syncFooterAndLegend("empty", view.panel, [], sectorTreemapBucketColor);
        if (animate) svg.style.opacity = "1";
        return;
      }
      svg.setAttribute("viewBox", `0 0 ${lastW} ${lastH}`);
      svg.setAttribute(
        "aria-label",
        view.kind === "sectors"
          ? `${t("chart.bguTreemapBreadcrumbSectors")} — ${residencePanelOptionLabel(view.panel)}`
          : employerDisplayName(view.employer),
      );
      if (view.kind === "education") {
        syncFooterAndLegend("education", view.panel, [], sectorTreemapBucketColor);
        paintEducationDrill(rootG, defs, panelTotal, view.panel, view.employer, animate);
        if (animate) svg.style.opacity = "1";
        return;
      }
      const sectorRoot = buildSectorCompanyHierarchy(dataRows, view.panel);
      const bucketChildren = sectorRoot.children ?? [];
      const bucketNames = [...bucketChildren]
        .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
        .map((c) => c.data.name);
      if (
        view.kind === "sectors" &&
        view.focusBucket &&
        !bucketNames.includes(view.focusBucket)
      ) {
        view = { kind: "sectors", panel: view.panel, focusBucket: null };
      }
      const focusKey =
        view.kind === "sectors" ? view.focusBucket : null;
      const bucketsForTop =
        focusKey && bucketChildren.some((c) => c.data.name === focusKey)
          ? bucketChildren.filter((c) => c.data.name === focusKey)
          : bucketChildren;
      syncFooterAndLegend("sectors", view.panel, bucketNames, bucketColor);
      const topData: BguTreemapHierarchyDatum = {
        name: "root",
        children: bucketsForTop.map((c) => ({
          name: c.data.name,
          value: c.value ?? 0,
        })),
      };
      const topRoot = hierarchy<BguTreemapHierarchyDatum>(topData)
        .sum((d) => d.value ?? 0)
        .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
      d3treemap<BguTreemapHierarchyDatum>()
        .tile(treemapSquarify)
        .size([lastW, lastH])
        .paddingOuter(4)
        .paddingInner(3)
        .round(false)(topRoot);
      const bucketByName = new Map(bucketChildren.map((c) => [c.data.name, c]));
      const innerPad = 2;
      const gAllLabels = document.createElementNS(NS, "g");
      gAllLabels.setAttribute("class", "bgu-treemap__labels-layer");
      gAllLabels.setAttribute("pointer-events", "none");
      const viewDenom = panelTotal;
      for (const bucketLeaf of topRoot.leaves() as HierarchyRectangularNode<BguTreemapHierarchyDatum>[]) {
        const bucketName = bucketLeaf.data.name;
        const bucketHue = bucketColor(bucketName);
        const strokeCol = mixStroke(bucketHue, 0.72);
        const bx0 = bucketLeaf.x0 + innerPad;
        const by0 = bucketLeaf.y0 + innerPad;
        const bw = Math.max(0, bucketLeaf.x1 - bucketLeaf.x0 - innerPad * 2);
        const bh = Math.max(0, bucketLeaf.y1 - bucketLeaf.y0 - innerPad * 2);
        const bucketFrame = document.createElementNS(NS, "rect");
        bucketFrame.setAttribute("x", String(bucketLeaf.x0));
        bucketFrame.setAttribute("y", String(bucketLeaf.y0));
        bucketFrame.setAttribute("width", String(bucketLeaf.x1 - bucketLeaf.x0));
        bucketFrame.setAttribute("height", String(bucketLeaf.y1 - bucketLeaf.y0));
        bucketFrame.setAttribute("fill", "none");
        bucketFrame.setAttribute("stroke", bucketHue);
        bucketFrame.setAttribute("stroke-width", "2.75");
        bucketFrame.setAttribute("rx", "2");
        bucketFrame.setAttribute("pointer-events", "none");
        rootG.appendChild(bucketFrame);
        const sourceNode = bucketByName.get(bucketName);
        if (!sourceNode || bw < 4 || bh < 4) continue;
        const flatBucket = flattenBucketEmployersForLayout(sourceNode.data);
        const innerRoot = hierarchy<BguTreemapHierarchyDatum>(flatBucket)
          .sum((d) => d.value ?? 0)
          .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
        const innerSum = innerRoot.value ?? 0;
        if (innerSum <= 0) continue;
        d3treemap<BguTreemapHierarchyDatum>()
          .tile(treemapSquarify)
          .size([bw, bh])
          .paddingOuter(1)
          .paddingInner(1)
          .round(false)(innerRoot);
        const clipId = `${mountId}-${clipSeq++}`;
        const cp = document.createElementNS(NS, "clipPath");
        cp.setAttribute("id", clipId);
        const cr = document.createElementNS(NS, "rect");
        cr.setAttribute("width", String(bw));
        cr.setAttribute("height", String(bh));
        cr.setAttribute("x", "0");
        cr.setAttribute("y", "0");
        cp.appendChild(cr);
        defs.appendChild(cp);
        const innerCells = document.createElementNS(NS, "g");
        innerCells.setAttribute("transform", `translate(${bx0},${by0})`);
        innerCells.setAttribute("clip-path", `url(#${clipId})`);
        rootG.appendChild(innerCells);
        const innerLabelGroup = document.createElementNS(NS, "g");
        innerLabelGroup.setAttribute("transform", `translate(${bx0},${by0})`);
        gAllLabels.appendChild(innerLabelGroup);
        const leaves = innerRoot.leaves() as HierarchyRectangularNode<BguTreemapHierarchyDatum>[];
        for (const leaf of leaves) {
          const w = leaf.x1 - leaf.x0;
          const h = leaf.y1 - leaf.y0;
          if (w < 1 || h < 1) continue;
          const employerRaw = leaf.data.name;
          const segmentSlug = leaf.data.segmentSlug ?? "";
          const segmentLabel = treemapMsg(segmentSlug, treemapIndustrySegmentKey);
          const bucketLabel = treemapMsg(bucketName, treemapIndustryBucketKey);
          const empLabel = employerDisplayName(employerRaw);
          const v = leaf.value ?? 0;
          const pctPanel = viewDenom > 0 ? v / viewDenom : 0;
          const segTotal = leaf.parent?.value ?? 0;
          const pctSeg = segTotal > 0 ? v / segTotal : 0;
          const rect = document.createElementNS(NS, "rect");
          rect.setAttribute("x", String(leaf.x0));
          rect.setAttribute("y", String(leaf.y0));
          rect.setAttribute("width", String(w));
          rect.setAttribute("height", String(h));
          rect.setAttribute("fill", bucketHue);
          rect.setAttribute("stroke", strokeCol);
          rect.setAttribute("stroke-width", "1.85");
          rect.setAttribute("role", "button");
          rect.setAttribute("tabindex", "0");
          rect.setAttribute(
            "aria-label",
            `${empLabel}. ${bucketLabel}. ${segmentLabel}. ${formatLocaleInt(v)}.`,
          );
          const tipParts = [
            { className: "bgu-treemap__tip-title", text: empLabel },
            {
              className: "bgu-treemap__tip-line",
              text: `${formatLocaleInt(v)} · ${formatPercent(pctPanel)} · ${residencePanelOptionLabel(view.panel)}`,
            },
            {
              className: "bgu-treemap__tip-line",
              text: `${formatPercent(pctSeg)} · ${segmentLabel}`,
            },
            { className: "bgu-treemap__tip-muted", text: bucketLabel },
          ];
          rect.addEventListener("mouseenter", (ev) =>
            showTooltip(tipParts, ev.clientX, ev.clientY),
          );
          rect.addEventListener("mousemove", (ev) => {
            if (!tooltip.hidden) positionTooltip(ev.clientX, ev.clientY);
          });
          rect.addEventListener("mouseleave", () => {
            if (document.activeElement !== rect) hideTooltip();
          });
          rect.addEventListener("focus", () => {
            const rbb = rect.getBoundingClientRect();
            showTooltip(tipParts, rbb.left + rbb.width / 2, rbb.top + rbb.height / 2);
          });
          rect.addEventListener("blur", hideTooltip);
          const openDrill = (): void => {
            drillToEmployer(view.panel, employerRaw);
          };
          rect.addEventListener("click", (ev) => {
            ev.preventDefault();
            openDrill();
          });
          rect.addEventListener("keydown", (ev: KeyboardEvent) => {
            if (ev.key === "Enter" || ev.key === " ") {
              ev.preventDefault();
              openDrill();
            }
          });
          innerCells.appendChild(rect);
          layOutTreemapLabels(
            defs,
            innerLabelGroup,
            `${mountId}-lbl-${clipSeq++}`,
            { x: leaf.x0, y: leaf.y0, w, h },
            empLabel,
            formatPercent(pctPanel),
            rtl,
          );
        }
      }
      rootG.appendChild(gAllLabels);
      if (animate) svg.style.opacity = "1";
    };
    if (animate) {
      svg.style.opacity = "0";
      requestAnimationFrame(() => requestAnimationFrame(finishPaint));
    } else {
      finishPaint();
    }
  }
  function onResize(): void {
    const r = plot.getBoundingClientRect();
    const w = Math.floor(r.width);
    const h = Math.floor(r.height);
    if (w === lastW && h === lastH) return;
    lastW = w;
    lastH = h;
    paint(false);
  }
  panelSelect.addEventListener("change", () => {
    hideTooltip();
    view = {
      kind: "sectors",
      panel: panelSelect.value,
      focusBucket: null,
    };
    paint(false);
  });
  backBtn.addEventListener("click", () => {
    hideTooltip();
    goBack();
  });
  const onWindowKeydown = (ev: KeyboardEvent): void => {
    if (ev.key !== "Escape") return;
    if (view.kind !== "education") return;
    ev.preventDefault();
    hideTooltip();
    goBack();
  };
  window.addEventListener("keydown", onWindowKeydown);
  plot.addEventListener("mousemove", (ev) => {
    if (tipActive && !tooltip.hidden) positionTooltip(ev.clientX, ev.clientY);
  });
  plot.addEventListener("mouseleave", hideTooltip);
  ro = new ResizeObserver(() => onResize());
  ro.observe(plot);
  const onLocaleTheme = (): void => {
    hideTooltip();
    paint(false);
  };
  window.addEventListener("bsid-locale-change", onLocaleTheme);
  window.addEventListener("bsid-theme-change", onLocaleTheme);
  syncPanelOptions();
  queueMicrotask(onResize);
  return () => {
    host.removeAttribute("dir");
    window.removeEventListener("bsid-locale-change", onLocaleTheme);
    window.removeEventListener("bsid-theme-change", onLocaleTheme);
    window.removeEventListener("keydown", onWindowKeydown);
    ro?.disconnect();
    ro = null;
    hideTooltip();
    host.classList.remove("bgu-treemap", "chart-custom-plot");
    host.replaceChildren();
  };
}

