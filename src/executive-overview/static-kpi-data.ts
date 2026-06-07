import { KPI_ROSTER, LAYOUT_BLOCKS } from "./config";
import {
  realEstateDealsFields,
  type RealEstateDealsKpiPayload,
} from "./real-estate-deals";
import {
  NA,
  type KpiCardModel,
  type KpiDef,
  type KpiDisplayFields,
  type KpiId,
  type OverviewBlock,
} from "./types";

const KPI_BY_ID = new Map(KPI_ROSTER.map((kpi) => [kpi.id, kpi]));

/** Shared metadata for the two populated static KPIs (May 2026 snapshot). */
const STATIC_KPI_META: Omit<KpiDisplayFields, "kpiName" | "currentValue"> = {
  periodLabel: "May 2026",
  deltaValue: "0",
  deltaDirection: "flat",
  baselineValue: NA,
  baselinePeriodLabel: NA,
  forecastDateLabel: "November 2026",
  forecastValueLabel: NA,
};

const STATIC_VALUES = {
  "static-companies": "50",
  "static-amenities": "117",
  "static-commuting-count": "12,475",
  "static-pedestrian-activity": "1,263",
  "static-district-employment": "3,000",
  "static-open-positions": "100",
} as const;

type StaticDataSource = keyof typeof STATIC_VALUES;

function isStaticDataSource(source: KpiDef["dataSource"]): source is StaticDataSource {
  return source in STATIC_VALUES;
}

function emptyFields(kpiName: string): KpiDisplayFields {
  return {
    kpiName,
    periodLabel: NA,
    currentValue: NA,
    baselineValue: NA,
    deltaValue: NA,
    baselinePeriodLabel: NA,
    forecastDateLabel: NA,
    forecastValueLabel: NA,
  };
}

/** Alumni Retention: currentValue plus period and next-update dates from STATIC_KPI_META. */
function alumniFields(kpiName: string, currentValue: string): KpiDisplayFields {
  const { periodLabel, forecastDateLabel } = STATIC_KPI_META;
  return {
    kpiName,
    currentValue,
    periodLabel,
    baselineValue: NA,
    deltaValue: NA,
    baselinePeriodLabel: NA,
    forecastDateLabel,
    forecastValueLabel: NA,
  };
}

function fieldsForKpi(
  def: KpiDef,
  alumniCount: string | null,
  realEstateDeals: RealEstateDealsKpiPayload | null,
): KpiDisplayFields {
  if (isStaticDataSource(def.dataSource)) {
    return {
      kpiName: def.kpiName,
      currentValue: STATIC_VALUES[def.dataSource],
      ...STATIC_KPI_META,
    };
  }
  if (def.dataSource === "cohort-alumni") {
    return alumniFields(def.kpiName, alumniCount ?? NA);
  }
  if (def.dataSource === "real-estate-deals") {
    return realEstateDealsFields(def.kpiName, realEstateDeals);
  }
  return emptyFields(def.kpiName);
}

function cardsForIds(
  ids: KpiId[],
  alumniCount: string | null,
  realEstateDeals: RealEstateDealsKpiPayload | null,
): KpiCardModel[] {
  return ids.map((id) => {
    const def = KPI_BY_ID.get(id);
    if (!def) throw new Error(`Unknown KPI id: ${id}`);
    return { ...def, ...fieldsForKpi(def, alumniCount, realEstateDeals) };
  });
}

/** Sync model build — caller awaits CSV/JSON loads first, passes formatted values or null. */
export function buildExecutiveOverviewModel(
  alumniCount: string | null,
  realEstateDeals: RealEstateDealsKpiPayload | null = null,
): OverviewBlock[] {
  return LAYOUT_BLOCKS.map((block) => {
    if (block.kind === "row") {
      return {
        kind: "row",
        category: block.category,
        categoryLabel: block.categoryLabel,
        row: {
          category: block.category,
          cards: cardsForIds(block.kpiIds, alumniCount, realEstateDeals),
        },
      };
    }
    return {
      kind: "group",
      category: block.category,
      categoryLabel: block.categoryLabel,
      rows: block.rows.map((kpiIds) => ({
        category: block.category,
        cards: cardsForIds(kpiIds, alumniCount, realEstateDeals),
      })),
    };
  });
}
