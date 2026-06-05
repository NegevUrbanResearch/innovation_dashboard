/** Matches Figma QA frame 20:1966 — see .cursor/figma-context.md */
export type KpiCategory = "economy" | "network" | "physical";

export type KpiId =
  | "economy-companies"
  | "economy-gov-investment"
  | "economy-private-investment"
  | "economy-commercial-patents"
  | "economy-philanthropy"
  | "network-quarter-alumni"
  | "network-idf-bgu-soroka"
  | "network-mentions"
  | "physical-amenities"
  | "physical-deals"
  | "physical-rights"
  | "physical-pipeline"
  | "physical-canopy";

export type KpiDataSource =
  | "static-companies"
  | "static-amenities"
  | "cohort-alumni"
  | "none";

/** Literal string used for all missing v1 field values. */
export const NA = "NA";

/**
 * Eight user-visible text fields per KPI card (Figma periodic/element-core).
 *
 * Body baseline row (single combined line):
 *   `{deltaValue} {vs} {baselinePeriodLabel} ({baselineValue})`
 *   where `{vs}` is the COPY.vs connector ("vs.").
 *
 * Footer (always two lines):
 *   `{footerTargetPrefix} {forecastValueLabel}`  → "Target: NA"
 *   `{footerNextUpdatePrefix} {forecastDateLabel}` → "Next update: November 2026"
 */
export type KpiDisplayFields = {
  kpiName: string;
  periodLabel: string;
  currentValue: string;
  baselineValue: string;
  deltaValue: string;
  baselinePeriodLabel: string;
  forecastDateLabel: string;
  forecastValueLabel: string;
};

export type KpiDef = {
  id: KpiId;
  category: KpiCategory;
  kpiName: string;
  dataSource: KpiDataSource;
};

export type KpiCardModel = KpiDef & KpiDisplayFields;

export type KpiRowModel = {
  category: KpiCategory;
  categoryLabel: string;
  cards: KpiCardModel[];
};
