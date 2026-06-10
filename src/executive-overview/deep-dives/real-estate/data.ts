export type RealEstateResolution = "monthly" | "quarterly";
export type RealEstateMetric = "deals" | "pricePerSqm";
export type RealEstatePeriodRange = {
  start: string;
  end: string;
};

export type RealEstateTimeseriesRow = {
  period: string;
  label: string;
  complete: boolean;
  districtDeals: number;
  nonDistrictDeals: number;
  districtMedianPricePerSqm: number | null;
  nonDistrictMedianPricePerSqm: number | null;
};

export type RealEstateSummary = {
  totalRows: number;
  residentialRows: number;
  rowsWithCoordinates: number;
  missingCoordinates: number;
  rowsMissingDealDate: number;
};

export type RealEstateDealsFeatureProperties = {
  id: string;
  periodMonth: string;
  periodQuarter: string;
  inInnovationDistrict: boolean;
  propertyCategory: string;
  propertyType: string;
  dealAmount: number | null;
  pricePerSqm: number | null;
  areaSqm: number | null;
};

export type RealEstateDealsFeature = {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
  properties: RealEstateDealsFeatureProperties;
};

export type RealEstateDealsFeatureCollection = {
  type: "FeatureCollection";
  features: RealEstateDealsFeature[];
};

export type RealEstateTimeseriesData = {
  generatedAt: string;
  source: string;
  summary: RealEstateSummary;
  monthly: RealEstateTimeseriesRow[];
  quarterly: RealEstateTimeseriesRow[];
};

export const REAL_ESTATE_CURRENCY = "ILS";
export const REAL_ESTATE_CURRENCY_LABEL = "₪";
const TIMESERIES_FILE = "deals-timeseries.json";
const MARKERS_FILE = "deals-markers.geojson";
export const REAL_ESTATE_OUTSIDE_MARKET_COLOR = "#4d7c82";

type ImportMetaWithOptionalEnv = ImportMeta & {
  env?: {
    BASE_URL?: string;
  };
};

function publicDataUrl(path: string): string {
  const base = (import.meta as ImportMetaWithOptionalEnv).env?.BASE_URL || "/";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  return `${normalizedBase}${path.replace(/^\/+/, "")}`;
}

async function fetchJsonAsset(path: string): Promise<unknown | null> {
  try {
    const response = await fetch(publicDataUrl(path), { cache: "default" });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function cachedAsset<T>(loader: () => Promise<T | null>): () => Promise<T | null> {
  let promise: Promise<T | null> | null = null;
  return () => {
    promise ??= loader();
    return promise;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function hasOwnProperty(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

type NullableNumberParseResult =
  | { kind: "missing" }
  | { kind: "null"; value: null }
  | { kind: "number"; value: number }
  | { kind: "invalid" };

function readOwnNullableNumber(record: Record<string, unknown>, key: string): NullableNumberParseResult {
  if (!hasOwnProperty(record, key)) return { kind: "missing" };
  const value = record[key];
  if (value === null) return { kind: "null", value: null };
  if (typeof value === "number" && Number.isFinite(value)) {
    return { kind: "number", value };
  }
  return { kind: "invalid" };
}

function parseTimeseriesRow(value: unknown): RealEstateTimeseriesRow | null {
  if (!isRecord(value)) return null;

  const period = readString(value.period);
  const label = readString(value.label);
  const complete = readBoolean(value.complete);
  const districtDeals = readNumber(value.districtDeals);
  const nonDistrictDeals = readNumber(value.nonDistrictDeals);
  const districtMedianPricePerSqm = readOwnNullableNumber(value, "districtMedianPricePerSqm");
  const nonDistrictMedianPricePerSqm = readOwnNullableNumber(value, "nonDistrictMedianPricePerSqm");

  if (
    period === null ||
    label === null ||
    complete === null ||
    districtDeals === null ||
    nonDistrictDeals === null ||
    districtMedianPricePerSqm.kind === "missing" ||
    districtMedianPricePerSqm.kind === "invalid" ||
    nonDistrictMedianPricePerSqm.kind === "missing" ||
    nonDistrictMedianPricePerSqm.kind === "invalid"
  ) {
    return null;
  }

  return {
    period,
    label,
    complete,
    districtDeals,
    nonDistrictDeals,
    districtMedianPricePerSqm: districtMedianPricePerSqm.value,
    nonDistrictMedianPricePerSqm: nonDistrictMedianPricePerSqm.value,
  };
}

function parseSummary(value: unknown): RealEstateSummary | null {
  if (!isRecord(value)) return null;

  const totalRows = readNumber(value.totalRows);
  const residentialRows = readNumber(value.residentialRows);
  const rowsWithCoordinates = readNumber(value.rowsWithCoordinates);
  const missingCoordinates = readNumber(value.missingCoordinates);
  const rowsMissingDealDate = readNumber(value.rowsMissingDealDate);

  if (
    totalRows === null ||
    residentialRows === null ||
    rowsWithCoordinates === null ||
    missingCoordinates === null ||
    rowsMissingDealDate === null
  ) {
    return null;
  }

  return {
    totalRows,
    residentialRows,
    rowsWithCoordinates,
    missingCoordinates,
    rowsMissingDealDate,
  };
}

function parseTimeseriesPayload(value: unknown): RealEstateTimeseriesData | null {
  if (!isRecord(value)) return null;

  const generatedAt = readString(value.generatedAt);
  const source = readString(value.source);
  const summary = parseSummary(value.summary);
  const monthlyInput = Array.isArray(value.monthly) ? value.monthly : null;
  const quarterlyInput = Array.isArray(value.quarterly) ? value.quarterly : null;

  if (!generatedAt || !source || !summary || !monthlyInput || !quarterlyInput) {
    return null;
  }

  if (!monthlyInput.length || !quarterlyInput.length) {
    return null;
  }

  const monthly = monthlyInput.map((entry) => parseTimeseriesRow(entry));
  const quarterly = quarterlyInput.map((entry) => parseTimeseriesRow(entry));

  if (monthly.some((entry) => entry === null) || quarterly.some((entry) => entry === null)) {
    return null;
  }

  return {
    generatedAt,
    source,
    summary,
    monthly: monthly as RealEstateTimeseriesRow[],
    quarterly: quarterly as RealEstateTimeseriesRow[],
  };
}

function isMarkersPayload(value: unknown): value is RealEstateDealsFeatureCollection {
  return (
    isRecord(value) &&
    value.type === "FeatureCollection" &&
    Array.isArray(value.features) &&
    value.features.length > 0
  );
}

export const loadRealEstateTimeseriesData = cachedAsset(async () => {
  const payload = await fetchJsonAsset(`real-estate/${TIMESERIES_FILE}`);
  return payload === null ? null : parseTimeseriesPayload(payload);
});

export const loadRealEstateMarkersData = cachedAsset(async () => {
  const payload = await fetchJsonAsset(`real-estate/${MARKERS_FILE}`);
  return isMarkersPayload(payload) ? payload : null;
});

