import { KPI_ROSTER, LAYOUT_BLOCKS } from "./config";
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
  baselineValue: NA,
  baselinePeriodLabel: NA,
  forecastDateLabel: "November 2026",
  forecastValueLabel: NA,
};

const STATIC_VALUES: Record<
  "static-companies" | "static-amenities",
  string
> = {
  "static-companies": "50",
  "static-amenities": "117",
};

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

function fieldsForKpi(def: KpiDef, alumniCount: string | null): KpiDisplayFields {
  if (def.dataSource === "static-companies" || def.dataSource === "static-amenities") {
    return {
      kpiName: def.kpiName,
      currentValue: STATIC_VALUES[def.dataSource],
      ...STATIC_KPI_META,
    };
  }
  if (def.dataSource === "cohort-alumni") {
    return alumniFields(def.kpiName, alumniCount ?? NA);
  }
  return emptyFields(def.kpiName);
}

function cardsForIds(ids: KpiId[], alumniCount: string | null): KpiCardModel[] {
  return ids.map((id) => {
    const def = KPI_BY_ID.get(id);
    if (!def) throw new Error(`Unknown KPI id: ${id}`);
    return { ...def, ...fieldsForKpi(def, alumniCount) };
  });
}

/** Sync model build — caller awaits CSV load first, passes formatted count or null. */
export function buildExecutiveOverviewModel(
  alumniCount: string | null,
): OverviewBlock[] {
  return LAYOUT_BLOCKS.map((block) => {
    if (block.kind === "row") {
      return {
        kind: "row",
        category: block.category,
        categoryLabel: block.categoryLabel,
        row: {
          category: block.category,
          cards: cardsForIds(block.kpiIds, alumniCount),
        },
      };
    }
    return {
      kind: "group",
      category: block.category,
      categoryLabel: block.categoryLabel,
      rows: block.rows.map((kpiIds) => ({
        category: block.category,
        cards: cardsForIds(kpiIds, alumniCount),
      })),
    };
  });
}
