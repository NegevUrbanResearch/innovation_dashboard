import {
  isUnspecifiedToken,
  parseBguEducationDetailed,
  parseEducationFieldsDetailed,
  parseEducationRetentionWide,
  parseJobTypeVsResidence,
  parseKeyValueCsv,
  parseTwoColumnCounts,
  type BguEducationDetailRow,
  type EducationFieldDetailRow,
  type EducationRetentionWideRow,
  type JobTypeResidenceRow,
} from "./csv";

export const LINKEDIN_DATA_FILES = [
  "residents_work.csv",
  "residents_work_n.csv",
  "workers_residence.csv",
  "workers_residence_n.csv",
  "feeder_cities.csv",
  "destination_cities.csv",
  "companies_in_bs.csv",
  "companies_inbound.csv",
  "companies_outbound.csv",
  "education_vs_retention.csv",
  "stem_non_stem_overall.csv",
  "bgu_bs_residents_education_detailed.csv",
  "education_fields_detailed.csv",
  "job_types_in_bs.csv",
  "job_type_vs_residence.csv",
] as const;

function publicDataUrl(name: string): string {
  const base = import.meta.env.BASE_URL || "/";
  return base.endsWith("/") ? `${base}linkedin-data/${name}` : `${base}/linkedin-data/${name}`;
}

async function fetchDataCsv(name: string): Promise<string> {
  const res = await fetch(publicDataUrl(name), { cache: "default" });
  if (!res.ok) {
    throw new Error(`Failed to load linkedin-data/${name} (${res.status})`);
  }
  return res.text();
}

function sumCounts(rows: { label: string; count: number }[]): number {
  return rows.reduce((a, r) => a + r.count, 0);
}

export type LinkedInBundle = {
  bguAlumniCohortN: number;
  bguRetentionLocationKnownN: number;
  bguBguDegreeFieldKnownSum: number;
  educationFieldsPeopleSum: number;
  residentsWorkPct: Map<string, number>;
  residentsWorkN: Map<string, number>;
  residentsWorkTotalN: number;
  workersResidencePct: Map<string, number>;
  workersResidenceN: Map<string, number>;
  workersTotalN: number;
  feederCities: { label: string; count: number }[];
  feederTotalN: number;
  destinationCities: { label: string; count: number }[];
  destinationTotalN: number;
  companiesInBs: { label: string; count: number }[];
  companiesInBsTotalN: number;
  companiesInbound: { label: string; count: number }[];
  companiesInboundTotalN: number;
  companiesOutbound: { label: string; count: number }[];
  companiesOutboundTotalN: number;
  educationRetentionWide: EducationRetentionWideRow[];
  stemOverall: { label: string; count: number }[];
  stemOverallTotalN: number;
  bguEducationDetailed: BguEducationDetailRow[];
  educationFieldsDetailed: EducationFieldDetailRow[];
  jobTypesInBs: { label: string; count: number }[];
  jobTypesInBsTotalN: number;
  jobTypeVsResidence: JobTypeResidenceRow[];
};

let cache: LinkedInBundle | null = null;
let loadPromise: Promise<LinkedInBundle> | null = null;

function buildBundle(
  residentsWorkRaw: string,
  residentsWorkNRaw: string,
  workersResidenceRaw: string,
  workersResidenceNRaw: string,
  feederCitiesRaw: string,
  destinationCitiesRaw: string,
  companiesInBsRaw: string,
  companiesInboundRaw: string,
  companiesOutboundRaw: string,
  educationVsRetentionRaw: string,
  stemNonStemOverallRaw: string,
  bguEducationDetailedRaw: string,
  educationFieldsDetailedRaw: string,
  jobTypesInBsRaw: string,
  jobTypeVsResidenceRaw: string,
): LinkedInBundle {
  const residentsWorkPct = parseKeyValueCsv(residentsWorkRaw);
  const residentsWorkNMap = parseKeyValueCsv(residentsWorkNRaw);
  const residentsWorkN = new Map(
    [...residentsWorkNMap.entries()].map(([k, v]) => [k, Math.round(v)]),
  );
  const residentsWorkTotalN = [...residentsWorkN.values()].reduce((a, b) => a + b, 0);

  const workersResidencePct = parseKeyValueCsv(workersResidenceRaw);
  const workersResidenceNMap = parseKeyValueCsv(workersResidenceNRaw);
  const workersResidenceN = new Map(
    [...workersResidenceNMap.entries()].map(([k, v]) => [k, Math.round(v)]),
  );
  const workersTotalN = [...workersResidenceN.values()].reduce((a, b) => a + b, 0);

  const feederCities = parseTwoColumnCounts(feederCitiesRaw, "residence_city");
  const destinationCities = parseTwoColumnCounts(destinationCitiesRaw, "work_city");
  const companiesInBs = parseTwoColumnCounts(companiesInBsRaw, "current_company_name_clean");
  const companiesInbound = parseTwoColumnCounts(companiesInboundRaw, "current_company_name_clean");
  const companiesOutbound = parseTwoColumnCounts(companiesOutboundRaw, "current_company_name_clean");
  const educationRetentionWide = parseEducationRetentionWide(educationVsRetentionRaw);
  const stemOverall = parseTwoColumnCounts(stemNonStemOverallRaw, "education_bucket").filter(
    (r) => !isUnspecifiedToken(r.label),
  );
  const { rows: bguEducationDetailed, cohortTotalN: bguAlumniCohortN } =
    parseBguEducationDetailed(bguEducationDetailedRaw);
  const educationFieldsDetailed = parseEducationFieldsDetailed(educationFieldsDetailedRaw);
  const bguRetentionLocationKnownN = educationRetentionWide.reduce(
    (acc, r) => acc + r.abroad + r.beerSheva + r.israelOther,
    0,
  );
  const bguBguDegreeFieldKnownSum = bguEducationDetailed.reduce((acc, r) => acc + r.count, 0);
  const educationFieldsPeopleSum = educationFieldsDetailed.reduce((acc, r) => acc + r.count, 0);
  const jobTypesInBs = parseTwoColumnCounts(jobTypesInBsRaw, "industry_bucket");
  const jobTypeVsResidence = parseJobTypeVsResidence(jobTypeVsResidenceRaw);

  return {
    bguAlumniCohortN,
    bguRetentionLocationKnownN,
    bguBguDegreeFieldKnownSum,
    educationFieldsPeopleSum,
    residentsWorkPct,
    residentsWorkN,
    residentsWorkTotalN,
    workersResidencePct,
    workersResidenceN,
    workersTotalN,
    feederCities,
    feederTotalN: sumCounts(feederCities),
    destinationCities,
    destinationTotalN: sumCounts(destinationCities),
    companiesInBs,
    companiesInBsTotalN: sumCounts(companiesInBs),
    companiesInbound,
    companiesInboundTotalN: sumCounts(companiesInbound),
    companiesOutbound,
    companiesOutboundTotalN: sumCounts(companiesOutbound),
    educationRetentionWide,
    stemOverall,
    stemOverallTotalN: sumCounts(stemOverall),
    bguEducationDetailed,
    educationFieldsDetailed,
    jobTypesInBs,
    jobTypesInBsTotalN: sumCounts(jobTypesInBs),
    jobTypeVsResidence,
  };
}

export async function loadLinkedInData(): Promise<LinkedInBundle> {
  if (cache) return cache;
  loadPromise ??= (async () => {
    const texts = await Promise.all(LINKEDIN_DATA_FILES.map((name) => fetchDataCsv(name)));
    const b = buildBundle(
      texts[0]!,
      texts[1]!,
      texts[2]!,
      texts[3]!,
      texts[4]!,
      texts[5]!,
      texts[6]!,
      texts[7]!,
      texts[8]!,
      texts[9]!,
      texts[10]!,
      texts[11]!,
      texts[12]!,
      texts[13]!,
      texts[14]!,
    );
    cache = b;
    return b;
  })();
  return loadPromise;
}

export function clearLinkedInDataCache(): void {
  cache = null;
  loadPromise = null;
}
