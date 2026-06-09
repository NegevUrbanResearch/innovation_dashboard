import "maplibre-gl/dist/maplibre-gl.css";

import type { FilterSpecification } from "maplibre-gl";

import {
  loadRealEstateMarkersData,
  REAL_ESTATE_CURRENCY,
  REAL_ESTATE_OUTSIDE_MARKET_COLOR,
  type RealEstateDealsFeatureCollection,
  type RealEstateDealsFeatureProperties,
  type RealEstatePeriodRange,
  type RealEstateResolution,
} from "./real-estate-deep-dive-data";

type MapLibreModule = typeof import("maplibre-gl");
type LayerMouseEvent = import("maplibre-gl").MapMouseEvent & {
  features?: import("maplibre-gl").MapGeoJSONFeature[];
};
type MapMouseEventHandler = (event: LayerMouseEvent) => void;

export type RealEstateDeepDiveMapController = {
  setPeriodRange(range: RealEstatePeriodRange, resolution: RealEstateResolution): void;
  resize(): void;
  destroy(): void;
};

const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const MAPLIBRE_RTL_PLUGIN_URL = `${import.meta.env.BASE_URL || "/"}vendor/mapbox-gl-rtl-text.js`;
const DISTRICT_LAYER_ID = "exec-real-estate-district-points";
const OUTSIDE_LAYER_ID = "exec-real-estate-outside-points";
const MAP_LOAD_TIMEOUT_MS = 12000;
const DEFAULT_CENTER: [number, number] = [34.79, 31.25];
const DEFAULT_ZOOM = 11.5;
const NO_MATCH_PERIOD = "__exec_real_estate_no_match_period__";
const MAPLIBRE_IGNORED_WARNING = "Expected value to be of type number, but found null instead.";
const EMPTY_FILTER_KEY = "__exec_real_estate_empty_filter__";
let rtlPluginRegistration: Promise<void> | null = null;

type PeriodProperty = "periodMonth" | "periodQuarter";
type AvailablePeriodsByResolution = Record<RealEstateResolution, string[]>;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function formatCurrency(value: number | null): string {
  if (value === null) return "NA";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: REAL_ESTATE_CURRENCY,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number | null, suffix = ""): string {
  if (value === null) return "NA";
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)}${suffix}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function parseNumberLike(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseBooleanLike(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

function extractMapErrorMessage(event: unknown): string | null {
  if (typeof event === "string" && event.trim()) return event;
  if (!event || typeof event !== "object") return null;

  const errorValue = "error" in event ? (event as { error?: unknown }).error : undefined;
  if (typeof errorValue === "string" && errorValue.trim()) return errorValue;
  if (errorValue && typeof errorValue === "object" && "message" in errorValue) {
    const nestedMessage = (errorValue as { message?: unknown }).message;
    if (typeof nestedMessage === "string" && nestedMessage.trim()) return nestedMessage;
  }

  const messageValue = "message" in event ? (event as { message?: unknown }).message : undefined;
  return typeof messageValue === "string" && messageValue.trim() ? messageValue : null;
}

function isIgnorableMapWarning(event: unknown): boolean {
  return extractMapErrorMessage(event) === MAPLIBRE_IGNORED_WARNING;
}

function registerRtlTextPlugin(maplibre: MapLibreModule): Promise<void> {
  if (!rtlPluginRegistration) {
    rtlPluginRegistration = maplibre
      .setRTLTextPlugin(MAPLIBRE_RTL_PLUGIN_URL, false)
      .catch((error: unknown) => {
        rtlPluginRegistration = null;
        throw error;
      });
  }
  return rtlPluginRegistration;
}

function buildPopupHtml(properties: RealEstateDealsFeatureProperties): string {
  const rows = [
    ["Period", properties.periodQuarter],
    ["Category", properties.propertyCategory],
    ["Type", properties.propertyType],
    ["Deal amount", formatCurrency(properties.dealAmount)],
    ["Price per SQM", formatCurrency(properties.pricePerSqm)],
    ["Area", formatNumber(properties.areaSqm, " sqm")],
  ];

  return `
    <div class="exec-real-estate-map__popup">
      <p class="exec-real-estate-map__popup-eyebrow">${
        escapeHtml(
          properties.inInnovationDistrict ? "Innovation District" : "Outside Innovation District",
        )
      }</p>
      ${rows
        .map(
          ([label, value]) =>
            `<div class="exec-real-estate-map__popup-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`,
        )
        .join("")}
    </div>
  `;
}

function periodPropertyForResolution(resolution: RealEstateResolution): PeriodProperty {
  return resolution === "monthly" ? "periodMonth" : "periodQuarter";
}

function parsePeriodSortKey(resolution: RealEstateResolution, period: string): number | null {
  if (resolution === "monthly") {
    const match = /^(\d{4})-(\d{2})$/.exec(period);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null;
    return year * 12 + (month - 1);
  }

  const match = /^(\d{4})-Q([1-4])$/.exec(period);
  if (!match) return null;
  const year = Number(match[1]);
  const quarter = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(quarter)) return null;
  return year * 4 + (quarter - 1);
}

function collectAvailablePeriods(markers: RealEstateDealsFeatureCollection): AvailablePeriodsByResolution {
  const monthlyPeriods = new Map<string, number>();
  const quarterlyPeriods = new Map<string, number>();

  for (const feature of markers.features) {
    const monthly = feature.properties.periodMonth;
    const monthlyKey = parsePeriodSortKey("monthly", monthly);
    if (monthlyKey !== null && !monthlyPeriods.has(monthly)) {
      monthlyPeriods.set(monthly, monthlyKey);
    }

    const quarterly = feature.properties.periodQuarter;
    const quarterlyKey = parsePeriodSortKey("quarterly", quarterly);
    if (quarterlyKey !== null && !quarterlyPeriods.has(quarterly)) {
      quarterlyPeriods.set(quarterly, quarterlyKey);
    }
  }

  return {
    monthly: [...monthlyPeriods.entries()]
      .sort((left, right) => left[1] - right[1])
      .map(([period]) => period),
    quarterly: [...quarterlyPeriods.entries()]
      .sort((left, right) => left[1] - right[1])
      .map(([period]) => period),
  };
}

function allowedPeriodsForRange(
  availablePeriods: AvailablePeriodsByResolution,
  resolution: RealEstateResolution,
  range: RealEstatePeriodRange,
): string[] {
  const startKey = parsePeriodSortKey(resolution, range.start);
  const endKey = parsePeriodSortKey(resolution, range.end);
  if (startKey === null || endKey === null) return [];

  const lower = Math.min(startKey, endKey);
  const upper = Math.max(startKey, endKey);

  return availablePeriods[resolution].filter((period) => {
    const key = parsePeriodSortKey(resolution, period);
    return key !== null && key >= lower && key <= upper;
  });
}

function buildLayerFilter(
  inInnovationDistrict: boolean,
  resolution: RealEstateResolution,
  allowedPeriods: string[],
): FilterSpecification {
  const property = periodPropertyForResolution(resolution);
  const periodFilter =
    allowedPeriods.length === 0
      ? ["==", ["get", property], NO_MATCH_PERIOD]
      : allowedPeriods.length === 1
        ? ["==", ["get", property], allowedPeriods[0]]
        : ["match", ["get", property], allowedPeriods, true, false];

  return [
    "all",
    ["==", ["get", "inInnovationDistrict"], inInnovationDistrict],
    periodFilter,
  ] as unknown as FilterSpecification;
}

function createLayerListeners(
  map: import("maplibre-gl").Map,
  maplibre: MapLibreModule,
  setActivePopup: (popup: import("maplibre-gl").Popup | null) => void,
): { click: MapMouseEventHandler; mouseenter: MapMouseEventHandler; mouseleave: MapMouseEventHandler } {
  const click: MapMouseEventHandler = (event) => {
    const feature = event.features?.[0];
    const properties = feature?.properties as Partial<RealEstateDealsFeatureProperties> | undefined;
    if (!properties || !event.lngLat) return;

    setActivePopup(null);
    const popup = new maplibre.Popup({
      closeButton: false,
      closeOnMove: true,
      offset: 14,
      className: "exec-real-estate-map__popup-shell",
    });
    setActivePopup(popup);

    popup
      .setLngLat(event.lngLat)
      .setHTML(
        buildPopupHtml({
          id: String(properties.id ?? ""),
          periodMonth: String(properties.periodMonth ?? ""),
          periodQuarter: String(properties.periodQuarter ?? ""),
          inInnovationDistrict: parseBooleanLike(properties.inInnovationDistrict),
          propertyCategory: String(properties.propertyCategory ?? "NA"),
          propertyType: String(properties.propertyType ?? "NA"),
          dealAmount: parseNumberLike(properties.dealAmount),
          pricePerSqm: parseNumberLike(properties.pricePerSqm),
          areaSqm: parseNumberLike(properties.areaSqm),
        }),
      )
      .addTo(map);
  };

  const mouseenter: MapMouseEventHandler = () => {
    map.getCanvas().style.cursor = "pointer";
  };

  const mouseleave: MapMouseEventHandler = () => {
    map.getCanvas().style.cursor = "";
  };

  return { click, mouseenter, mouseleave };
}

export function mountRealEstateDeepDiveMap(
  host: HTMLElement,
  initialResolution: RealEstateResolution,
  initialRange: RealEstatePeriodRange,
): RealEstateDeepDiveMapController {
  const shell = el("section", "exec-real-estate-map");

  const canvasWrap = el("div", "exec-real-estate-map__canvas-wrap");
  const canvas = el("div", "exec-real-estate-map__canvas");
  canvas.style.position = "absolute";
  canvas.style.inset = "0";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  const loadingState = el("div", "exec-real-estate-map__status", "Loading deal map...");
  canvasWrap.appendChild(canvas);
  canvasWrap.appendChild(loadingState);

  shell.appendChild(canvasWrap);
  host.replaceChildren(shell);

  // Manual QA reminder: verify Hebrew basemap labels render naturally and are not mirrored.
  // Do not apply CSS transforms or RTL layout tricks to the map container or canvas.
  let destroyed = false;
  let range = initialRange;
  let resolution = initialResolution;
  let map: import("maplibre-gl").Map | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let activePopup: import("maplibre-gl").Popup | null = null;
  let layersReady = false;
  let styleLoaded = false;
  let markers: RealEstateDealsFeatureCollection | null = null;
  let availablePeriods: AvailablePeriodsByResolution | null = null;
  let loadTimeout: number | null = null;
  let scheduledFilterFrame: number | null = null;
  let lastAppliedFilterKey: string | null = null;
  const layerListeners: Array<{
    layerId: string;
    click: MapMouseEventHandler;
    mouseenter: MapMouseEventHandler;
    mouseleave: MapMouseEventHandler;
  }> = [];
  let mapWarningHandler: ((event: unknown) => void) | null = null;
  let mapLoadHandler: (() => void) | null = null;

  function setActivePopup(popup: import("maplibre-gl").Popup | null) {
    activePopup?.remove();
    activePopup = popup;
  }

  function buildFilterKey(allowedPeriods: string[]): string {
    if (allowedPeriods.length === 0) return `${resolution}|${EMPTY_FILTER_KEY}`;
    return `${resolution}|${allowedPeriods.join("|")}`;
  }

  function applyFiltersNow(force = false) {
    scheduledFilterFrame = null;
    if (!map || !layersReady || !availablePeriods) return;
    if (!map.getLayer(DISTRICT_LAYER_ID) || !map.getLayer(OUTSIDE_LAYER_ID)) return;
    const allowedPeriods = allowedPeriodsForRange(availablePeriods, resolution, range);
    const filterKey = buildFilterKey(allowedPeriods);
    if (!force && filterKey === lastAppliedFilterKey) return;
    map.setFilter(DISTRICT_LAYER_ID, buildLayerFilter(true, resolution, allowedPeriods));
    map.setFilter(OUTSIDE_LAYER_ID, buildLayerFilter(false, resolution, allowedPeriods));
    lastAppliedFilterKey = filterKey;
  }

  function scheduleFilterApply(force = false) {
    if (scheduledFilterFrame !== null) {
      if (!force) return;
      cancelAnimationFrame(scheduledFilterFrame);
      scheduledFilterFrame = null;
    }
    scheduledFilterFrame = requestAnimationFrame(() => {
      applyFiltersNow(force);
    });
  }

  function cleanupMapObjects() {
    if (loadTimeout !== null) {
      window.clearTimeout(loadTimeout);
      loadTimeout = null;
    }
    if (scheduledFilterFrame !== null) {
      cancelAnimationFrame(scheduledFilterFrame);
      scheduledFilterFrame = null;
    }

    resizeObserver?.disconnect();
    resizeObserver = null;
    setActivePopup(null);
    layersReady = false;
    styleLoaded = false;
    availablePeriods = null;
    lastAppliedFilterKey = null;

    if (map && mapWarningHandler) {
      map.off("error", mapWarningHandler);
    }
    if (map && mapLoadHandler) {
      map.off("load", mapLoadHandler);
    }
    if (map) {
      for (const listeners of layerListeners) {
        map.off("click", listeners.layerId, listeners.click);
        map.off("mouseenter", listeners.layerId, listeners.mouseenter);
        map.off("mouseleave", listeners.layerId, listeners.mouseleave);
      }
    }

    layerListeners.length = 0;
    mapWarningHandler = null;
    mapLoadHandler = null;
    map?.remove();
    map = null;
  }

  function renderMapUnavailable(message: string) {
    if (destroyed) return;
    cleanupMapObjects();
    const unavailable = el("section", "exec-real-estate-unavailable exec-real-estate-unavailable--map");
    unavailable.appendChild(el("h3", "exec-real-estate-unavailable__title", "Spatial view unavailable"));
    unavailable.appendChild(el("p", "exec-real-estate-unavailable__copy", message));
    host.replaceChildren(unavailable);
  }

  function finalizeLayers(maplibre: MapLibreModule) {
    if (!map || !styleLoaded || !markers || layersReady || destroyed) return;

    availablePeriods = collectAvailablePeriods(markers);
    const initialAllowedPeriods = allowedPeriodsForRange(availablePeriods, resolution, range);

    map.addSource("exec-real-estate-deals", {
      type: "geojson",
      data: markers,
    });

    map.addLayer({
      id: DISTRICT_LAYER_ID,
      type: "circle",
      source: "exec-real-estate-deals",
      paint: {
        "circle-radius": 4.5,
        "circle-color": "#875800",
        "circle-stroke-width": 1.1,
        "circle-stroke-color": "#fff6dd",
        "circle-opacity": 0.88,
      },
      filter: buildLayerFilter(true, resolution, initialAllowedPeriods),
    });

    map.addLayer({
      id: OUTSIDE_LAYER_ID,
      type: "circle",
      source: "exec-real-estate-deals",
      paint: {
        "circle-radius": 4,
        "circle-color": REAL_ESTATE_OUTSIDE_MARKET_COLOR,
        "circle-stroke-width": 1,
        "circle-stroke-color": "#f7fbfb",
        "circle-opacity": 0.82,
      },
      filter: buildLayerFilter(false, resolution, initialAllowedPeriods),
    });

    const districtListeners = createLayerListeners(map, maplibre, setActivePopup);
    const outsideListeners = createLayerListeners(map, maplibre, setActivePopup);

    layerListeners.push(
      { layerId: DISTRICT_LAYER_ID, ...districtListeners },
      { layerId: OUTSIDE_LAYER_ID, ...outsideListeners },
    );

    for (const listeners of layerListeners) {
      map.on("click", listeners.layerId, listeners.click);
      map.on("mouseenter", listeners.layerId, listeners.mouseenter);
      map.on("mouseleave", listeners.layerId, listeners.mouseleave);
    }

    layersReady = true;
    if (loadTimeout !== null) {
      window.clearTimeout(loadTimeout);
      loadTimeout = null;
    }
    loadingState.remove();
    lastAppliedFilterKey = null;
    applyFiltersNow(true);

    requestAnimationFrame(() => {
      map?.resize();
    });

    resizeObserver = new ResizeObserver(() => {
      map?.resize();
    });
    resizeObserver.observe(canvasWrap);
  }

  void (async () => {
    try {
      const maplibre = await import("maplibre-gl");
      if (destroyed) return;
      await registerRtlTextPlugin(maplibre);
      if (destroyed) return;

      map = new maplibre.Map({
        container: canvas,
        style: MAP_STYLE_URL,
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        attributionControl: false,
        maplibreLogo: false,
      });

      map.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
      map.addControl(new maplibre.AttributionControl({ compact: true }));

      mapWarningHandler = (event) => {
        if (isIgnorableMapWarning(event)) return;
        console.warn("MapLibre warning", event);
      };
      map.on("error", mapWarningHandler);

      loadTimeout = window.setTimeout(() => {
        renderMapUnavailable(
          "The basemap did not finish loading in time. Manual Hebrew label verification is blocked until the map style and tiles are reachable again.",
        );
      }, MAP_LOAD_TIMEOUT_MS);

      mapLoadHandler = () => {
        styleLoaded = true;
        finalizeLayers(maplibre);
      };
      map.on("load", mapLoadHandler);

      void loadRealEstateMarkersData().then((markerData) => {
        if (destroyed) return;
        if (!markerData) {
          renderMapUnavailable(
            "The marker dataset could not be loaded for this map view. Recheck the real-estate GeoJSON artifact and network availability.",
          );
          return;
        }
        markers = markerData;
        finalizeLayers(maplibre);
      });
    } catch {
      renderMapUnavailable(
        "The map client could not be initialized. Recheck OpenFreeMap availability and the marker artifact before retrying this overlay.",
      );
    }
  })();

  return {
    setPeriodRange(nextRange, nextResolution) {
      range = nextRange;
      resolution = nextResolution;
      scheduleFilterApply();
    },
    resize() {
      map?.resize();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cleanupMapObjects();
      host.replaceChildren();
    },
  };
}
