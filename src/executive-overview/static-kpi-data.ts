import { CATEGORY_LABELS } from "./copy";
import { CATEGORY_ORDER, KPI_ROSTER } from "./config";
import { NA, type KpiDef, type KpiDisplayFields, type KpiRowModel } from "./types";

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

/** Quarter Alumni: currentValue plus period and next-update dates from STATIC_KPI_META. */
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

/** Sync model build — caller awaits CSV load first, passes formatted count or null. */
export function buildExecutiveOverviewModel(
  alumniCount: string | null,
): KpiRowModel[] {
  return CATEGORY_ORDER.map((category) => ({
    category,
    categoryLabel: CATEGORY_LABELS[category],
    cards: KPI_ROSTER.filter((k) => k.category === category).map((def) => ({
      ...def,
      ...fieldsForKpi(def, alumniCount),
    })),
  }));
}
