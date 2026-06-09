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

export type RealEstateDeepDiveData = RealEstateTimeseriesData & {
  markers: RealEstateDealsFeatureCollection;
};

export const REAL_ESTATE_CURRENCY = "ILS";
export const REAL_ESTATE_CURRENCY_LABEL = "₪";
const TIMESERIES_FILE = "deals-timeseries.json";
const MARKERS_FILE = "deals-markers.geojson";
export const REAL_ESTATE_OUTSIDE_MARKET_COLOR = "#4d7c82";

function publicDataUrl(name: string): string {
  const base = import.meta.env.BASE_URL || "/";
  return base.endsWith("/") ? `${base}real-estate/${name}` : `${base}/real-estate/${name}`;
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

function parseFeature(value: unknown): RealEstateDealsFeature | null {
  if (!isRecord(value)) return null;
  if (value.type !== "Feature") return null;
  if (!isRecord(value.geometry) || value.geometry.type !== "Point") return null;

  const coordinates = Array.isArray(value.geometry.coordinates) ? value.geometry.coordinates : null;
  if (!coordinates || coordinates.length < 2) return null;

  const lng = readNumber(coordinates[0]);
  const lat = readNumber(coordinates[1]);
  if (lng === null || lat === null) return null;

  if (!isRecord(value.properties)) return null;

  const id = readString(value.properties.id);
  const periodMonth = readString(value.properties.periodMonth);
  const periodQuarter = readString(value.properties.periodQuarter);
  const inInnovationDistrict = readBoolean(value.properties.inInnovationDistrict);
  const propertyCategory = readString(value.properties.propertyCategory);
  const propertyType = readString(value.properties.propertyType);
  const dealAmount = readOwnNullableNumber(value.properties, "dealAmount");
  const pricePerSqm = readOwnNullableNumber(value.properties, "pricePerSqm");
  const areaSqm = readOwnNullableNumber(value.properties, "areaSqm");

  if (
    id === null ||
    periodMonth === null ||
    periodQuarter === null ||
    inInnovationDistrict === null ||
    propertyCategory === null ||
    propertyType === null ||
    dealAmount.kind === "missing" ||
    dealAmount.kind === "invalid" ||
    pricePerSqm.kind === "missing" ||
    pricePerSqm.kind === "invalid" ||
    areaSqm.kind === "missing" ||
    areaSqm.kind === "invalid"
  ) {
    return null;
  }

  return {
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [lng, lat],
    },
    properties: {
      id,
      periodMonth,
      periodQuarter,
      inInnovationDistrict,
      propertyCategory,
      propertyType,
      dealAmount: dealAmount.value,
      pricePerSqm: pricePerSqm.value,
      areaSqm: areaSqm.value,
    },
  };
}

function parseMarkersPayload(value: unknown): RealEstateDealsFeatureCollection | null {
  if (!isRecord(value) || value.type !== "FeatureCollection" || !Array.isArray(value.features)) {
    return null;
  }

  if (!value.features.length) {
    return null;
  }

  const features = value.features.map((feature) => parseFeature(feature));

  if (features.some((feature) => feature === null)) {
    return null;
  }

  return {
    type: "FeatureCollection",
    features: features as RealEstateDealsFeature[],
  };
}

let timeseriesCache: Promise<RealEstateTimeseriesData | null> | null = null;
let markersCache: Promise<RealEstateDealsFeatureCollection | null> | null = null;

async function fetchJsonAsset(name: string): Promise<unknown | null> {
  try {
    const response = await fetch(publicDataUrl(name), { cache: "default" });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export function loadRealEstateTimeseriesData(): Promise<RealEstateTimeseriesData | null> {
  if (!timeseriesCache) {
    timeseriesCache = (async () => {
      const payload = await fetchJsonAsset(TIMESERIES_FILE);
      return payload === null ? null : parseTimeseriesPayload(payload);
    })();
  }

  return timeseriesCache;
}

export function loadRealEstateMarkersData(): Promise<RealEstateDealsFeatureCollection | null> {
  if (!markersCache) {
    markersCache = (async () => {
      const payload = await fetchJsonAsset(MARKERS_FILE);
      return payload === null ? null : parseMarkersPayload(payload);
    })();
  }

  return markersCache;
}

export async function loadRealEstateDeepDiveData(): Promise<RealEstateDeepDiveData | null> {
  const [timeseries, markers] = await Promise.all([
    loadRealEstateTimeseriesData(),
    loadRealEstateMarkersData(),
  ]);

  if (!timeseries || !markers) {
    return null;
  }

  return {
    ...timeseries,
    markers,
  };
}
