export const COMMUTING_DESTINATIONS = ["BGU", "Soroka Hospital", "Gav Yam"] as const;
export type CommutingDestination = (typeof COMMUTING_DESTINATIONS)[number];
export type CommutingScope = "all" | CommutingDestination;

export const COMMUTING_DESTINATION_LABELS: Record<CommutingScope, string> = {
  all: "All destinations",
  BGU: "Ben-Gurion University",
  "Soroka Hospital": "Soroka Medical Center",
  "Gav Yam": "Gav-Yam High-Tech Park",
};

export type CommutingModeSlice = {
  mode: string;
  trips: number;
  percentage: number;
};

export type CommutingData = {
  hours: number[];
  hourlyByDestination: Record<CommutingDestination, number[]>;
  hourlyAll: number[];
  totalsByDestination: Record<CommutingDestination, number>;
  totalInbound: number;
  modeSplitByDestination: Record<CommutingDestination, CommutingModeSlice[]>;
  modeSplitAll: CommutingModeSlice[];
  peakHourAll: number;
};

const TEMPORAL_FILE = "mobility/frontend_temporal.csv";
const MODE_SPLIT_FILE = "mobility/frontend_mode_split.csv";

function publicDataUrl(path: string): string {
  const base = import.meta.env.BASE_URL || "/";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  return `${normalizedBase}${path.replace(/^\/+/, "")}`;
}

async function fetchText(path: string): Promise<string | null> {
  try {
    const response = await fetch(publicDataUrl(path), { cache: "default" });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

function parseCsv(text: string): string[][] {
  return text
    .trim()
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .map((line) => line.split(",").map((cell) => cell.trim()));
}

function isDestination(value: string): value is CommutingDestination {
  return (COMMUTING_DESTINATIONS as readonly string[]).includes(value);
}

function emptyByDestination<T>(make: () => T): Record<CommutingDestination, T> {
  return {
    BGU: make(),
    "Soroka Hospital": make(),
    "Gav Yam": make(),
  };
}

function parseModeSplit(rows: string[][]): Record<CommutingDestination, CommutingModeSlice[]> | null {
  if (rows.length < 2) return null;
  const result = emptyByDestination<CommutingModeSlice[]>(() => []);
  for (const row of rows.slice(1)) {
    const [destination, mode, percentage, trips] = row;
    if (!isDestination(destination)) continue;
    const tripsValue = Number(trips);
    const percentageValue = Number(percentage);
    if (!Number.isFinite(tripsValue) || !Number.isFinite(percentageValue)) continue;
    result[destination].push({ mode, trips: tripsValue, percentage: percentageValue });
  }
  for (const destination of COMMUTING_DESTINATIONS) {
    result[destination].sort((a, b) => b.trips - a.trips);
  }
  return result;
}

function parseTemporal(
  rows: string[][],
  totals: Record<CommutingDestination, number>,
): Record<CommutingDestination, number[]> | null {
  if (rows.length < 2) return null;
  const result = emptyByDestination<number[]>(() => new Array<number>(24).fill(0));
  for (const row of rows.slice(1)) {
    const [destination, hour, proportion] = row;
    if (!isDestination(destination)) continue;
    const hourValue = Math.round(Number(hour));
    const proportionValue = Number(proportion);
    if (!Number.isInteger(hourValue) || hourValue < 0 || hourValue > 23) continue;
    if (!Number.isFinite(proportionValue)) continue;
    result[destination][hourValue] = proportionValue * totals[destination];
  }
  return result;
}

function aggregateModeSlices(
  byDestination: Record<CommutingDestination, CommutingModeSlice[]>,
): CommutingModeSlice[] {
  const tripsByMode = new Map<string, number>();
  for (const destination of COMMUTING_DESTINATIONS) {
    for (const slice of byDestination[destination]) {
      tripsByMode.set(slice.mode, (tripsByMode.get(slice.mode) ?? 0) + slice.trips);
    }
  }
  const total = [...tripsByMode.values()].reduce((sum, value) => sum + value, 0);
  return [...tripsByMode.entries()]
    .map(([mode, trips]) => ({
      mode,
      trips,
      percentage: total > 0 ? (trips / total) * 100 : 0,
    }))
    .sort((a, b) => b.trips - a.trips);
}

function buildData(modeText: string, temporalText: string): CommutingData | null {
  const modeSplitByDestination = parseModeSplit(parseCsv(modeText));
  if (!modeSplitByDestination) return null;

  const totalsByDestination = emptyByDestination<number>(() => 0);
  for (const destination of COMMUTING_DESTINATIONS) {
    totalsByDestination[destination] = modeSplitByDestination[destination].reduce(
      (sum, slice) => sum + slice.trips,
      0,
    );
  }

  const hourlyByDestination = parseTemporal(parseCsv(temporalText), totalsByDestination);
  if (!hourlyByDestination) return null;

  const hours = Array.from({ length: 24 }, (_, index) => index);
  const hourlyAll = hours.map((hour) =>
    COMMUTING_DESTINATIONS.reduce((sum, destination) => sum + hourlyByDestination[destination][hour], 0),
  );
  const totalInbound = COMMUTING_DESTINATIONS.reduce(
    (sum, destination) => sum + totalsByDestination[destination],
    0,
  );
  const peakHourAll = hourlyAll.reduce(
    (peak, value, hour) => (value > hourlyAll[peak] ? hour : peak),
    0,
  );

  return {
    hours,
    hourlyByDestination,
    hourlyAll,
    totalsByDestination,
    totalInbound,
    modeSplitByDestination,
    modeSplitAll: aggregateModeSlices(modeSplitByDestination),
    peakHourAll,
  };
}

let cached: Promise<CommutingData | null> | null = null;

export function loadCommutingData(): Promise<CommutingData | null> {
  cached ??= (async () => {
    const [modeText, temporalText] = await Promise.all([
      fetchText(MODE_SPLIT_FILE),
      fetchText(TEMPORAL_FILE),
    ]);
    if (modeText === null || temporalText === null) return null;
    return buildData(modeText, temporalText);
  })();
  return cached;
}

export function hourlyForScope(data: CommutingData, scope: CommutingScope): number[] {
  return scope === "all" ? data.hourlyAll : data.hourlyByDestination[scope];
}

export function modeSplitForScope(data: CommutingData, scope: CommutingScope): CommutingModeSlice[] {
  return scope === "all" ? data.modeSplitAll : data.modeSplitByDestination[scope];
}

export function totalForScope(data: CommutingData, scope: CommutingScope): number {
  return scope === "all" ? data.totalInbound : data.totalsByDestination[scope];
}

export function formatHour(hour: number): string {
  const normalized = ((hour % 24) + 24) % 24;
  const suffix = normalized < 12 ? "AM" : "PM";
  const display = normalized % 12 === 0 ? 12 : normalized % 12;
  return `${display} ${suffix}`;
}
