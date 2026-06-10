import { NA, type KpiDisplayFields } from "../../types.ts";

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function readDeltaDirection(value: unknown): RealEstateDealsKpiPayload["deltaDirection"] | null {
  return value === "up" || value === "down" || value === "flat" ? value : null;
}

function parseRealEstateDealsKpiPayload(value: unknown): RealEstateDealsKpiPayload | null {
  if (!isRecord(value)) return null;

  const periodLabel = readString(value, "periodLabel");
  const currentValue = readString(value, "currentValue");
  const deltaValue = readString(value, "deltaValue");
  const deltaDirection = readDeltaDirection(value.deltaDirection);
  const baselinePeriodLabel = readString(value, "baselinePeriodLabel");
  const baselineValue = readString(value, "baselineValue");
  const nextUpdateLabel = readString(value, "nextUpdateLabel");

  if (
    periodLabel === null ||
    currentValue === null ||
    deltaValue === null ||
    deltaDirection === null ||
    baselinePeriodLabel === null ||
    baselineValue === null ||
    nextUpdateLabel === null
  ) {
    return null;
  }

  return {
    periodLabel,
    currentValue,
    deltaValue,
    deltaDirection,
    baselinePeriodLabel,
    baselineValue,
    nextUpdateLabel,
  };
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
    return parseRealEstateDealsKpiPayload(await res.json());
  } catch {
    return null;
  }
}
