export function isUnspecifiedToken(s: string): boolean {
  return s.trim().toLowerCase() === "unspecified";
}

export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export function parseCsv(raw: string): string[][] {
  const text = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const lines = text.split("\n").filter((l) => l.length > 0);
  return lines.map(parseCsvLine);
}

export function parseKeyValueCsv(raw: string): Map<string, number> {
  const rows = parseCsv(raw);
  const m = new Map<string, number>();
  for (let i = 1; i < rows.length; i++) {
    const [k, v] = rows[i];
    if (!k) continue;
    const n = Number(v);
    if (!Number.isFinite(n)) continue;
    m.set(k, n);
  }
  return m;
}

export type CohortVennRow = {
  rowKind: "venn_partition" | "set_or_cohort_total";
  segment: string;
  count: number;
};

export type CohortVennModel = {
  partitions: { segment: string; count: number }[];
  totals: {
    totalProfiles: number;
    nBguGraduates: number;
    nBeerShevaResidents: number;
    nBeerShevaWorkers: number;
  };
};

export function parseCohortVennOverlap(raw: string): CohortVennModel {
  const rows = parseCsv(raw);
  const model: CohortVennModel = {
    partitions: [],
    totals: {
      totalProfiles: 0,
      nBguGraduates: 0,
      nBeerShevaResidents: 0,
      nBeerShevaWorkers: 0,
    },
  };
  if (rows.length < 2) return model;

  const h = rows[0];
  const iKind = headerIndex(h, "row_kind");
  const iSegment = headerIndex(h, "segment");
  const iCount = headerIndex(h, "count");
  if (iKind < 0 || iSegment < 0 || iCount < 0) return model;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.every((cell) => cell.trim() === "")) continue;

    const rowKind = row[iKind]?.trim();
    if (rowKind !== "venn_partition" && rowKind !== "set_or_cohort_total") continue;

    const segment = row[iSegment]?.trim();
    const count = Math.round(Number(row[iCount]));
    if (!segment || !Number.isFinite(count)) continue;

    const parsedRow: CohortVennRow = { rowKind, segment, count };
    if (parsedRow.rowKind === "venn_partition") {
      model.partitions.push({ segment: parsedRow.segment, count: parsedRow.count });
      continue;
    }

    if (parsedRow.segment === "total_profiles") model.totals.totalProfiles = parsedRow.count;
    if (parsedRow.segment === "n_bgu_graduates") model.totals.nBguGraduates = parsedRow.count;
    if (parsedRow.segment === "n_beer_sheva_residents") {
      model.totals.nBeerShevaResidents = parsedRow.count;
    }
    if (parsedRow.segment === "n_beer_sheva_workers") {
      model.totals.nBeerShevaWorkers = parsedRow.count;
    }
  }

  return model;
}

export function partitionPct(p: CohortVennModel, segment: string): number {
  if (p.totals.totalProfiles <= 0) return 0;
  const partition = p.partitions.find((item) => item.segment === segment);
  return partition ? partition.count / p.totals.totalProfiles : 0;
}

export function parseTwoColumnCounts(
  raw: string,
  _keyHeader: string,
): { label: string; count: number }[] {
  const rows = parseCsv(raw);
  if (rows.length < 2) return [];
  const out: { label: string; count: number }[] = [];
  for (let i = 1; i < rows.length; i++) {
    const label = rows[i][0];
    const count = Number(rows[i][1]);
    if (!label || !Number.isFinite(count)) continue;
    out.push({ label, count });
  }
  return out;
}

function headerIndex(headers: string[], name: string): number {
  const i = headers.indexOf(name);
  return i;
}

export type EducationRetentionWideRow = {
  bucket: string;
  abroad: number;
  beerSheva: number;
  israelOther: number;
};

export function parseEducationRetentionWide(raw: string): EducationRetentionWideRow[] {
  const rows = parseCsv(raw);
  if (rows.length < 2) return [];
  const h = rows[0];
  const idx = (name: string) => headerIndex(h, name);
  const i0 = idx("education_bucket");
  const ia = idx("abroad");
  const ib = idx("beer_sheva");
  const io = idx("israel_other");
  if (i0 < 0 || ia < 0 || ib < 0 || io < 0) return [];
  const out: EducationRetentionWideRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const bucket = rows[i][i0]?.trim();
    if (!bucket || isUnspecifiedToken(bucket)) continue;
    const abroad = Number(rows[i][ia]);
    const beerSheva = Number(rows[i][ib]);
    const israelOther = Number(rows[i][io]);
    if (![abroad, beerSheva, israelOther].every((n) => Number.isFinite(n))) continue;
    out.push({ bucket, abroad, beerSheva, israelOther });
  }
  return out;
}

export type BguEducationDetailRow = { degree: string; bucket: string; count: number };

export function parseBguEducationDetailed(raw: string): {
  rows: BguEducationDetailRow[];
  cohortTotalN: number;
} {
  const rows = parseCsv(raw);
  if (rows.length < 2) return { rows: [], cohortTotalN: 0 };
  const h = rows[0];
  const iDeg = headerIndex(h, "bgu_highest_degree_level");
  const iBuck = headerIndex(h, "bgu_education_bucket");
  const iCount = headerIndex(h, "count");
  const iNTotal = headerIndex(h, "n_total");
  if (iDeg < 0 || iBuck < 0 || iCount < 0) return { rows: [], cohortTotalN: 0 };
  const out: BguEducationDetailRow[] = [];
  let cohortTotalN = 0;
  for (let i = 1; i < rows.length; i++) {
    const degree = rows[i][iDeg]?.trim();
    const bucket = rows[i][iBuck]?.trim();
    if (!degree || !bucket) continue;
    if (isUnspecifiedToken(degree) || isUnspecifiedToken(bucket)) continue;
    const count = Math.round(Number(rows[i][iCount]));
    if (!Number.isFinite(count)) continue;
    if (cohortTotalN === 0 && iNTotal >= 0) {
      const nt = Math.round(Number(rows[i][iNTotal]));
      if (Number.isFinite(nt) && nt > 0) cohortTotalN = nt;
    }
    out.push({ degree, bucket, count });
  }
  return { rows: out, cohortTotalN };
}

export type EducationFieldDetailRow = {
  field: string;
  stemLine: string;
  count: number;
};

export function parseEducationFieldsDetailed(raw: string): EducationFieldDetailRow[] {
  const rows = parseCsv(raw);
  if (rows.length < 2) return [];
  const h = rows[0];
  const iField = headerIndex(h, "education_field_fine");
  const iLine = headerIndex(h, "field_stem_line");
  const iCount = headerIndex(h, "count");
  if (iField < 0 || iLine < 0 || iCount < 0) return [];
  const out: EducationFieldDetailRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const field = rows[i][iField]?.trim();
    const stemLine = rows[i][iLine]?.trim().toLowerCase();
    if (!field || isUnspecifiedToken(field)) continue;
    if (!stemLine || isUnspecifiedToken(stemLine)) continue;
    const count = Math.round(Number(rows[i][iCount]));
    if (!Number.isFinite(count) || count <= 0) continue;
    out.push({ field, stemLine, count });
  }
  return out;
}

export type JobTypeResidenceRow = { industry: string; inBs: number; outsideBs: number };

export type BguTreemapRow = {
  residencePanel: string;
  industryBucket: string;
  industrySegment: string;
  employer: string;
  education: string;
  n: number;
};

export function parseBguTreemapDrilldown(raw: string): BguTreemapRow[] {
  const rows = parseCsv(raw);
  if (rows.length < 2) return [];
  const h = rows[0];
  const iPanel = headerIndex(h, "residence_panel");
  const iBucket = headerIndex(h, "industry_bucket");
  const iSegment = headerIndex(h, "industry_segment");
  const iEmployer = headerIndex(h, "employer");
  const iEducation = headerIndex(h, "education");
  const iN = headerIndex(h, "n");
  if (
    iPanel < 0 ||
    iBucket < 0 ||
    iSegment < 0 ||
    iEmployer < 0 ||
    iEducation < 0 ||
    iN < 0
  ) {
    return [];
  }
  const out: BguTreemapRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.every((cell) => cell.trim() === "")) continue;

    const residencePanel = row[iPanel]?.trim() ?? "";
    const industryBucket = row[iBucket]?.trim() ?? "";
    const industrySegment = row[iSegment]?.trim() ?? "";
    const employer = row[iEmployer]?.trim() ?? "";
    const education = row[iEducation]?.trim() ?? "";
    const n = Math.round(Number(row[iN]));
    if (!residencePanel || !Number.isFinite(n)) continue;
    out.push({
      residencePanel,
      industryBucket,
      industrySegment,
      employer,
      education,
      n,
    });
  }
  return out;
}

export type EducationFieldGraduationRow = {
  year: number;
  field: string;
  count: number;
};

export type EducationFieldGraduationMeta = {
  nTotal: number;
  nKnown: number;
  knownPct: number;
};

export function parseEducationFieldGraduationYear(raw: string): EducationFieldGraduationRow[] {
  const rows = parseCsv(raw);
  if (rows.length < 2) return [];
  const h = rows[0];
  const iYear = headerIndex(h, "education_end_year");
  const iField = headerIndex(h, "education_field_fine");
  const iCount = headerIndex(h, "count");
  if (iYear < 0 || iField < 0 || iCount < 0) return [];
  const out: EducationFieldGraduationRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const year = Math.round(Number(row[iYear]));
    const field = row[iField]?.trim() ?? "";
    const count = Math.round(Number(row[iCount]));
    if (!Number.isFinite(year) || !field || !Number.isFinite(count) || count <= 0) continue;
    out.push({ year, field, count });
  }
  return out;
}

export function parseEducationFieldGraduationMeta(raw: string): EducationFieldGraduationMeta | null {
  const rows = parseCsv(raw);
  if (rows.length < 2) return null;
  const h = rows[0];
  const iTotal = headerIndex(h, "n_total");
  const iKnown = headerIndex(h, "n_known");
  const iPct = headerIndex(h, "known_pct");
  if (iTotal < 0 || iKnown < 0) return null;
  const first = rows[1];
  const nTotal = Math.round(Number(first[iTotal]));
  const nKnown = Math.round(Number(first[iKnown]));
  const knownPct = iPct >= 0 ? Number(first[iPct]) : NaN;
  if (!Number.isFinite(nTotal) || !Number.isFinite(nKnown)) return null;
  return { nTotal, nKnown, knownPct: Number.isFinite(knownPct) ? knownPct : 0 };
}

export function parseJobTypeVsResidence(raw: string): JobTypeResidenceRow[] {
  const rows = parseCsv(raw);
  if (rows.length < 2) return [];
  const h = rows[0];
  const iInd = headerIndex(h, "industry_bucket");
  const iIn = headerIndex(h, "Lives in BS");
  const iOut = headerIndex(h, "Lives outside BS");
  if (iInd < 0 || iIn < 0 || iOut < 0) return [];
  const out: JobTypeResidenceRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const industry = rows[i][iInd]?.trim();
    if (!industry || industry.toLowerCase() === "unknown") continue;
    const inBs = Math.round(Number(rows[i][iIn]));
    const outsideBs = Math.round(Number(rows[i][iOut]));
    if (!Number.isFinite(inBs) || !Number.isFinite(outsideBs)) continue;
    out.push({ industry, inBs, outsideBs });
  }
  return out;
}
