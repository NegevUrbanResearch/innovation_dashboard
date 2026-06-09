/** Matches Figma QA frame 20:1966 — see .cursor/figma-context.md */
export type KpiCategory = "economy" | "network" | "physical";

export type KpiId =
  | "economy-companies"
  | "economy-government-investment"
  | "economy-commercial-investment"
  | "economy-philanthropic-investment"
  | "economy-commercial-patents"
  | "network-district-employment"
  | "network-open-positions"
  | "network-alumni-retention"
  | "network-partners-integration"
  | "network-social-mentions"
  | "physical-commuting-count"
  | "physical-pedestrian-activity"
  | "physical-micromobility"
  | "physical-district-amenities"
  | "physical-accessibility"
  | "physical-real-estate-deals"
  | "physical-development-rights"
  | "physical-development-pipeline"
  | "physical-microclimate"
  | "physical-property-tax";

export type KpiDataSource =
  | "static-companies"
  | "static-amenities"
  | "static-commuting-count"
  | "static-pedestrian-activity"
  | "static-district-employment"
  | "static-open-positions"
  | "cohort-alumni"
  | "real-estate-deals"
  | "none";

export type KpiDeepDiveId = "real-estate-deals";

export type DeepDiveCapability = {
  id: KpiDeepDiveId;
  label: string;
};

/** Literal string used for all missing v1 field values. */
export const NA = "NA";

export type KpiDeltaDirection = "up" | "down" | "flat";

/**
 * User-visible text fields per KPI card (Figma periodic/element-core).
 *
 * Body layout:
 *   `{periodLabel}`
 *   `{currentValue}`
 *   `{deltaDirection arrow} {deltaValue}`  (prominent row when deltaValue is set)
 *   `{vs} {baselinePeriodLabel} ({baselineValue})`
 *
 * Footer (always two lines):
 *   `{footerTargetPrefix} {forecastValueLabel}`  → "Target: NA"
 *   `{footerNextUpdatePrefix} {forecastDateLabel}` → "Next update: Q2 2026"
 */
export type KpiDisplayFields = {
  kpiName: string;
  periodLabel: string;
  currentValue: string;
  baselineValue: string;
  deltaValue: string;
  deltaDirection?: KpiDeltaDirection;
  baselinePeriodLabel: string;
  forecastDateLabel: string;
  forecastValueLabel: string;
};

export type KpiDef = {
  id: KpiId;
  category: KpiCategory;
  kpiName: string;
  dataSource: KpiDataSource;
  deepDive?: DeepDiveCapability;
};

export type KpiCardModel = KpiDef & KpiDisplayFields;

export type KpiCardsRow = {
  category: KpiCategory;
  cards: KpiCardModel[];
};

export type LayoutBlockDef =
  | {
      kind: "row";
      category: KpiCategory;
      categoryLabel: string;
      kpiIds: KpiId[];
    }
  | {
      kind: "group";
      category: KpiCategory;
      categoryLabel: string;
      rows: KpiId[][];
    };

export type OverviewRowBlock = {
  kind: "row";
  category: KpiCategory;
  categoryLabel: string;
  row: KpiCardsRow;
};

export type OverviewGroupBlock = {
  kind: "group";
  category: KpiCategory;
  categoryLabel: string;
  rows: KpiCardsRow[];
};

export type OverviewBlock = OverviewRowBlock | OverviewGroupBlock;
