import { NA, type KpiDisplayFields } from "./types.ts";

/** Precomputed card payload — only the strings we render. */
export type RealEstateDealsKpiPayload = {
  periodLabel: string;
  currentValue: string;
  deltaValue: string;
  deltaDirection: "up" | "down" | "flat";
  baselinePeriodLabel: string;
  baselineValue: string;
  nextUpdateLabel: string;
};

const DATA_FILE = "deals-kpi.json";

function publicDataUrl(name: string): string {
  const base = import.meta.env.BASE_URL || "/";
  return base.endsWith("/") ? `${base}real-estate/${name}` : `${base}/real-estate/${name}`;
}

export function realEstateDealsFields(
  kpiName: string,
  payload: RealEstateDealsKpiPayload | null,
): KpiDisplayFields {
  if (!payload) {
    return {
      kpiName,
      periodLabel: NA,
      currentValue: NA,
      baselineValue: NA,
      deltaValue: NA,
      deltaDirection: undefined,
      baselinePeriodLabel: NA,
      forecastDateLabel: NA,
      forecastValueLabel: NA,
    };
  }

  return {
    kpiName,
    periodLabel: payload.periodLabel,
    currentValue: payload.currentValue,
    deltaValue: payload.deltaValue,
    deltaDirection: payload.deltaDirection,
    baselinePeriodLabel: payload.baselinePeriodLabel,
    baselineValue: payload.baselineValue,
    forecastDateLabel: payload.nextUpdateLabel,
    forecastValueLabel: NA,
  };
}

export async function loadRealEstateDealsKpi(): Promise<RealEstateDealsKpiPayload | null> {
  try {
    const res = await fetch(publicDataUrl(DATA_FILE), { cache: "default" });
    if (!res.ok) return null;
    return (await res.json()) as RealEstateDealsKpiPayload;
  } catch {
    return null;
  }
}
