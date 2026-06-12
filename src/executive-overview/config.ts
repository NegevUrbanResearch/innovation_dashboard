import { CATEGORY_LABELS } from "./copy";
import type {
  DeepDiveCapability,
  KpiCategory,
  KpiDataSource,
  KpiDef,
  KpiId,
  LayoutBlockDef,
} from "./types";

const KPI = (
  id: KpiId,
  category: KpiCategory,
  kpiName: string,
  dataSource: KpiDataSource,
  deepDive?: DeepDiveCapability,
): KpiDef => ({ id, category, kpiName, dataSource, deepDive });

/** Order matches ID Key numbers — Overview.csv left-to-right within each row. */
export const KPI_ROSTER: KpiDef[] = [
  // Economy (5)
  KPI("economy-companies", "economy", "Companies", "static-companies"),
  KPI("economy-government-investment", "economy", "Government Investment", "none"),
  KPI("economy-commercial-investment", "economy", "Commercial Investment", "none"),
  KPI("economy-philanthropic-investment", "economy", "Philanthropic Investment", "none"),
  KPI("economy-commercial-patents", "economy", "Commercial Patents", "static-commercial-patents"),
  // Network (5)
  KPI("network-district-employment", "network", "District Employment", "static-district-employment"),
  KPI("network-open-positions", "network", "Open Positions", "static-open-positions"),
  KPI(
    "network-alumni-retention",
    "network",
    "Alumni Retention",
    "cohort-alumni",
    { id: "alumni-retention", label: "Open alumni retention deep dive" },
  ),
  KPI("network-partners-integration", "network", "Partners Integration", "none"),
  KPI("network-social-mentions", "network", "Social Mentions", "none"),
  // Physical (10)
  KPI(
    "physical-commuting-count",
    "physical",
    "Commuting Count",
    "static-commuting-count",
    { id: "commuting-count", label: "Open daily commuters deep dive" },
  ),
  KPI("physical-pedestrian-activity", "physical", "Pedestrian Activity", "static-pedestrian-activity"),
  KPI("physical-micromobility", "physical", "Micromobility", "none"),
  KPI("physical-district-amenities", "physical", "District Amenities", "static-amenities"),
  KPI("physical-accessibility", "physical", "Accessibility", "none"),
  KPI(
    "physical-real-estate-deals",
    "physical",
    "Real Estate Deals",
    "real-estate-deals",
    { id: "real-estate-deals", label: "Open real estate deep dive" },
  ),
  KPI("physical-development-rights", "physical", "Development Rights", "none"),
  KPI("physical-development-pipeline", "physical", "Development Pipeline", "static-development-pipeline"),
  KPI("physical-microclimate", "physical", "Microclimate", "none"),
  KPI("physical-property-tax", "physical", "Property Tax", "none"),
];

/** Card count in the widest row — used to distribute extra width when height-limited. */
export const WIDEST_ROW_CARD_COUNT = 5;

/** Visual layout — Physical is one grouped block with a spanning category opener. */
export const LAYOUT_BLOCKS: LayoutBlockDef[] = [
  {
    kind: "row",
    category: "economy",
    categoryLabel: CATEGORY_LABELS.economy,
    kpiIds: [
      "economy-companies",
      "economy-government-investment",
      "economy-commercial-investment",
      "economy-philanthropic-investment",
      "economy-commercial-patents",
    ],
  },
  {
    kind: "row",
    category: "network",
    categoryLabel: CATEGORY_LABELS.network,
    kpiIds: [
      "network-district-employment",
      "network-open-positions",
      "network-alumni-retention",
      "network-partners-integration",
      "network-social-mentions",
    ],
  },
  {
    kind: "group",
    category: "physical",
    categoryLabel: CATEGORY_LABELS.physical,
    rows: [
      [
        "physical-commuting-count",
        "physical-pedestrian-activity",
        "physical-micromobility",
        "physical-district-amenities",
        "physical-accessibility",
      ],
      [
        "physical-real-estate-deals",
        "physical-development-rights",
        "physical-development-pipeline",
        "physical-microclimate",
        "physical-property-tax",
      ],
    ],
  },
];
