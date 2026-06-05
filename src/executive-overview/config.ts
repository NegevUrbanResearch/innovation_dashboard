import type { KpiCategory, KpiDef, KpiId, KpiDataSource } from "./types";

const KPI = (
  id: KpiId,
  category: KpiCategory,
  kpiName: string,
  dataSource: KpiDataSource,
): KpiDef => ({ id, category, kpiName, dataSource });

/** Order matches Figma QA frame 20:1966 left-to-right within each row. */
export const KPI_ROSTER: KpiDef[] = [
  // Economy (5)
  KPI("economy-companies", "economy", "Companies", "static-companies"),
  KPI("economy-gov-investment", "economy", "Gov Investment", "none"),
  KPI("economy-private-investment", "economy", "Private Investment", "none"),
  KPI("economy-commercial-patents", "economy", "Commercial Patents", "none"),
  KPI("economy-philanthropy", "economy", "Philanthropy", "none"),
  // Network (3)
  KPI("network-quarter-alumni", "network", "Quarter Alumni", "cohort-alumni"),
  KPI("network-idf-bgu-soroka", "network", "IDF in BGU/Soroka", "none"),
  KPI("network-mentions", "network", "Mentions", "none"),
  // Physical (5)
  KPI("physical-amenities", "physical", "Amenities", "static-amenities"),
  KPI("physical-deals", "physical", "Deals", "none"),
  KPI("physical-rights", "physical", "Rights", "none"),
  KPI("physical-pipeline", "physical", "Pipeline", "none"),
  KPI("physical-canopy", "physical", "Canopy", "none"),
];

export const CATEGORY_ORDER: KpiCategory[] = ["economy", "network", "physical"];
