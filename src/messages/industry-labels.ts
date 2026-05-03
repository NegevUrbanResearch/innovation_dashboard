import type { MessageKey } from "./en";

/** `education` slugs that use `chart.field.*` keys (aligned with FIELD_FINE in route-charts + CSV). */
const TREEMAP_EDUCATION_FIELD_SLUGS = new Set<string>([
  "accounting_and_finance",
  "behavioral_sciences",
  "biology",
  "biomedical_engineering",
  "biotechnology",
  "business_administration",
  "chemical_engineering",
  "civil_engineering",
  "computer_science",
  "data_science",
  "economics",
  "electrical_and_computer_engineering",
  "electrical_engineering",
  "geography",
  "health_care_administration",
  "hospitality_management",
  "industrial_engineering",
  "linguistics",
  "management_information_systems",
  "materials_engineering",
  "mechanical_engineering",
  "medicine",
  "nursing",
  "physics",
  "political_science",
  "psychology",
  "public_policy",
  "social_work",
  "software_engineering",
]);

const TREEMAP_RESIDENCE_PANEL: Record<string, MessageKey> = {
  "Lives in BS": "chart.treemapResidencePanel.lives_in_bs",
  "Lives outside BS": "chart.treemapResidencePanel.lives_outside_bs",
};

const TREEMAP_INDUSTRY_BUCKET: Record<string, MessageKey> = {
  unknown: "chart.industry.unknown",
  high_tech: "chart.industry.high_tech",
  healthcare: "chart.industry.healthcare",
  self_employed: "chart.industry.self_employed",
  public_sector: "chart.treemapIndustryBucket.public_sector",
  needs_review: "chart.treemapIndustryBucket.needs_review",
};

/**
 * Stable sector order for treemap / legend colors (Viridis sampling).
 * Must stay in sync with known keys in `TREEMAP_INDUSTRY_BUCKET` — not sorted by panel totals.
 */
export const treemapIndustryBucketColorOrder: readonly string[] = [
  "public_sector",
  "high_tech",
  "healthcare",
  "self_employed",
  "needs_review",
  "unknown",
];

const TREEMAP_INDUSTRY_SEGMENT: Record<string, MessageKey> = {
  unknown: "chart.treemapIndustrySegment.unknown",
  academic: "chart.treemapIndustrySegment.academic",
  cyber_security: "chart.treemapIndustrySegment.cyber_security",
  defense_aerospace: "chart.treemapIndustrySegment.defense_aerospace",
  finance: "chart.treemapIndustrySegment.finance",
  healthcare_provider: "chart.treemapIndustrySegment.healthcare_provider",
  other: "chart.treemapIndustrySegment.other",
  other_high_tech: "chart.treemapIndustrySegment.other_high_tech",
  pharma_biotech: "chart.treemapIndustrySegment.pharma_biotech",
  public_sector: "chart.treemapIndustrySegment.public_sector",
  semiconductors_hardware: "chart.treemapIndustrySegment.semiconductors_hardware",
  software_it_services: "chart.treemapIndustrySegment.software_it_services",
};

const TREEMAP_EDUCATION_SPECIAL: Record<string, MessageKey> = {
  unknown: "chart.treemapEducation.unknown",
  stem: "chart.educationStem",
  non_stem: "chart.educationNonStem",
  medical: "chart.educationMedical",
};

export const treemapUnmappedLabelKey: MessageKey = "chart.treemapUnmappedLabel";

export function treemapResidencePanelKey(slug: string): MessageKey {
  const key = TREEMAP_RESIDENCE_PANEL[slug];
  return key ?? treemapUnmappedLabelKey;
}

export function treemapIndustryBucketKey(slug: string): MessageKey {
  const key = TREEMAP_INDUSTRY_BUCKET[slug];
  return key ?? treemapUnmappedLabelKey;
}

export function treemapIndustrySegmentKey(slug: string): MessageKey {
  const key = TREEMAP_INDUSTRY_SEGMENT[slug];
  return key ?? treemapUnmappedLabelKey;
}

export function treemapEducationKey(slug: string): MessageKey {
  const special = TREEMAP_EDUCATION_SPECIAL[slug];
  if (special) return special;
  if (TREEMAP_EDUCATION_FIELD_SLUGS.has(slug)) {
    return `chart.field.${slug}` as MessageKey;
  }
  return treemapUnmappedLabelKey;
}
