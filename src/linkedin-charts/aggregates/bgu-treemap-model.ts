import { hierarchy } from "d3-hierarchy";
import type { HierarchyNode } from "d3-hierarchy";

import type { BguTreemapRow } from "../csv";

/** Tree datum compatible with `d3.hierarchy` + `.sum()` (leaves carry `value`). */
export type BguTreemapHierarchyDatum = {
  name: string;
  value?: number;
  children?: BguTreemapHierarchyDatum[];
  /** Dominant industry segment slug when a leaf was flattened from segment → employer rows. */
  segmentSlug?: string;
};

/** People counts omitted from treemap cells because bucket/segment/education slug is unknown. */
export type BguTreemapUnknownTotals = {
  unknownBucketN: number;
  unknownSegmentN: number;
  unknownEducationN: number;
};

function isUnknownSlug(s: string): boolean {
  const u = s.trim().toLowerCase();
  return u === "" || u === "unknown";
}

/**
 * Drops rows where industry bucket, segment, or education is unknown (still summed for footer).
 */
export function partitionTreemapRows(rows: BguTreemapRow[]): {
  usable: BguTreemapRow[];
  unknownTotals: BguTreemapUnknownTotals;
} {
  let unknownBucketN = 0;
  let unknownSegmentN = 0;
  let unknownEducationN = 0;
  const usable: BguTreemapRow[] = [];
  for (const row of rows) {
    const bu = isUnknownSlug(row.industryBucket);
    const seg = isUnknownSlug(row.industrySegment);
    const edu = isUnknownSlug(row.education);
    if (bu) unknownBucketN += row.n;
    if (seg) unknownSegmentN += row.n;
    if (edu) unknownEducationN += row.n;
    if (!bu && !seg && !edu) usable.push(row);
  }
  return {
    usable,
    unknownTotals: { unknownBucketN, unknownSegmentN, unknownEducationN },
  };
}

function sortByName<T>(entries: [string, T][]): [string, T][] {
  return [...entries].sort(([a], [b]) => a.localeCompare(b));
}

export function uniqueResidencePanels(rows: BguTreemapRow[]): string[] {
  const set = new Set<string>();
  for (const r of rows) {
    if (r.residencePanel) set.add(r.residencePanel);
  }
  const livesInBs = "Lives in BS";
  const arr = [...set];
  arr.sort((a, b) => {
    if (a === livesInBs) return -1;
    if (b === livesInBs) return 1;
    return a.localeCompare(b);
  });
  return arr;
}

export function buildSectorCompanyHierarchy(
  rows: BguTreemapRow[],
  panel: string,
): HierarchyNode<BguTreemapHierarchyDatum> {
  const filtered = rows.filter((r) => r.residencePanel === panel);
  const bucketMap = new Map<string, Map<string, Map<string, number>>>();

  for (const row of filtered) {
    const { industryBucket, industrySegment, employer, n } = row;
    if (!bucketMap.has(industryBucket)) bucketMap.set(industryBucket, new Map());
    const segMap = bucketMap.get(industryBucket)!;
    if (!segMap.has(industrySegment)) segMap.set(industrySegment, new Map());
    const empMap = segMap.get(industrySegment)!;
    empMap.set(employer, (empMap.get(employer) ?? 0) + n);
  }

  const children: BguTreemapHierarchyDatum[] = sortByName([...bucketMap.entries()]).map(
    ([bucket, segMap]) => ({
      name: bucket,
      children: sortByName([...segMap.entries()]).map(([segment, empMap]) => ({
        name: segment,
        children: sortByName([...empMap.entries()]).map(([employerName, sum]) => ({
          name: employerName,
          value: sum,
        })),
      })),
    }),
  );

  const rootData: BguTreemapHierarchyDatum = { name: "root", children };
  return hierarchy(rootData).sum((d) => d.value ?? 0);
}

export function buildEmployerEducationHierarchy(
  rows: BguTreemapRow[],
  panel: string,
  employer: string,
): HierarchyNode<BguTreemapHierarchyDatum> {
  const filtered = rows.filter(
    (r) => r.residencePanel === panel && r.employer === employer,
  );
  const eduMap = new Map<string, number>();
  for (const row of filtered) {
    const key = row.education.trim() || "unknown";
    eduMap.set(key, (eduMap.get(key) ?? 0) + row.n);
  }

  const children: BguTreemapHierarchyDatum[] = sortByName([...eduMap.entries()]).map(
    ([education, sum]) => ({ name: education, value: sum }),
  );

  const rootData: BguTreemapHierarchyDatum = { name: "root", children };
  return hierarchy(rootData)
    .sum((d) => d.value ?? 0)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
}

/**
 * One treemap level under an industry bucket: merge employers across segments,
 * keep dominant segment slug for tooltips, sort leaves by descending count.
 */
export function flattenBucketEmployersForLayout(
  bucketData: BguTreemapHierarchyDatum,
): BguTreemapHierarchyDatum {
  type Acc = { v: number; seg: string; bestPart: number };
  const byEmployer = new Map<string, Acc>();
  for (const seg of bucketData.children ?? []) {
    const slug = seg.name;
    for (const emp of seg.children ?? []) {
      const dv = emp.value ?? 0;
      const prev = byEmployer.get(emp.name);
      if (!prev) {
        byEmployer.set(emp.name, { v: dv, seg: slug, bestPart: dv });
      } else {
        prev.v += dv;
        if (dv > prev.bestPart) {
          prev.bestPart = dv;
          prev.seg = slug;
        }
      }
    }
  }
  const children: BguTreemapHierarchyDatum[] = [...byEmployer.entries()]
    .sort((a, b) => b[1].v - a[1].v)
    .map(([name, o]) => ({ name, value: o.v, segmentSlug: o.seg }));
  return { name: bucketData.name, children };
}
