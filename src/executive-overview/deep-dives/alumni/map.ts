import "maplibre-gl/dist/maplibre-gl.css";

import { formatLocaleInt, t } from "../../../i18n.ts";
import { registerMapLibreRtlTextPlugin } from "../../map/maplibre-rtl.ts";

export type AlumniFeederMapController = {
  resize(): void;
  destroy(): void;
};

export type AlumniFeederMapData = {
  feederCities: { city: string; count: number }[];
  cityCentroids: Record<string, [number, number]>;
};

type MapLibreModule = typeof import("maplibre-gl");
type LayerMouseEvent = import("maplibre-gl").MapMouseEvent & {
  features?: import("maplibre-gl").MapGeoJSONFeature[];
};
type MapMouseEventHandler = (event: LayerMouseEvent) => void;

const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const MAP_LOAD_TIMEOUT_MS = 12000;
const DEFAULT_CENTER: [number, number] = [34.79, 31.25];
const DEFAULT_ZOOM = 8.5;
const BEER_SHEVA_CITY = "Beer Sheva";
const FEEDER_COLOR = "#74094a";
const FEEDER_LINES_SOURCE = "alumni-feeder-lines";
const FEEDER_POINTS_SOURCE = "alumni-feeders";
const ANCHOR_SOURCE = "alumni-feeder-anchor";
const FEEDER_LINES_LAYER = "alumni-feeder-lines-layer";
const FEEDER_POINTS_LAYER = "alumni-feeders-layer";
const ANCHOR_LAYER = "alumni-feeder-anchor-layer";
const MAPLIBRE_IGNORED_WARNING = "Expected value to be of type number, but found null instead.";

type FeederPointProperties = {
  city: string;
  count: number;
};

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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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

function parseCount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function buildPopupHtml(city: string, count: number): string {
  return `
    <div class="exec-alumni-feeder-map__popup">
      <p class="exec-alumni-feeder-map__popup-copy">
        <strong>${escapeHtml(city)}</strong>:
        ${escapeHtml(formatLocaleInt(count))} profiles (live here, work in Beer Sheva)
      </p>
    </div>
  `;
}

function buildFeederGeoJson(
  data: AlumniFeederMapData,
  anchor: [number, number],
): {
  lines: GeoJSON.FeatureCollection<GeoJSON.LineString>;
  points: GeoJSON.FeatureCollection<GeoJSON.Point, FeederPointProperties>;
  minCount: number;
  maxCount: number;
} {
  const mapped = data.feederCities
    .map((row) => {
      const coordinates = data.cityCentroids[row.city];
      if (!coordinates) return null;
      return { city: row.city, count: row.count, coordinates };
    })
    .filter((row): row is { city: string; count: number; coordinates: [number, number] } => row !== null);

  const counts = mapped.map((row) => row.count);
  const minCount = counts.length > 0 ? Math.min(...counts) : 1;
  const maxCount = counts.length > 0 ? Math.max(...counts) : 1;

  return {
    lines: {
      type: "FeatureCollection",
      features: mapped.map((row) => ({
        type: "Feature",
        properties: { city: row.city, count: row.count },
        geometry: {
          type: "LineString",
          coordinates: [row.coordinates, anchor],
        },
      })),
    },
    points: {
      type: "FeatureCollection",
      features: mapped.map((row) => ({
        type: "Feature",
        properties: { city: row.city, count: row.count },
        geometry: {
          type: "Point",
          coordinates: row.coordinates,
        },
      })),
    },
    minCount,
    maxCount,
  };
}

function createLayerListeners(
  map: import("maplibre-gl").Map,
  maplibre: MapLibreModule,
  setActivePopup: (popup: import("maplibre-gl").Popup | null) => void,
): { click: MapMouseEventHandler; mouseenter: MapMouseEventHandler; mouseleave: MapMouseEventHandler } {
  const click: MapMouseEventHandler = (event) => {
    const feature = event.features?.[0];
    const properties = feature?.properties as Partial<FeederPointProperties> | undefined;
    if (!properties || !event.lngLat) return;

    const city = String(properties.city ?? "");
    const count = parseCount(properties.count);
    if (!city) return;

    setActivePopup(null);
    const popup = new maplibre.Popup({
      closeButton: false,
      closeOnMove: true,
      offset: 14,
      className: "exec-alumni-feeder-map__popup-shell",
    });
    setActivePopup(popup);

    popup.setLngLat(event.lngLat).setHTML(buildPopupHtml(city, count)).addTo(map);
  };

  const mouseenter: MapMouseEventHandler = () => {
    map.getCanvas().style.cursor = "pointer";
  };

  const mouseleave: MapMouseEventHandler = () => {
    map.getCanvas().style.cursor = "";
  };

  return { click, mouseenter, mouseleave };
}

export function mountAlumniFeederMap(
  host: HTMLElement,
  data: AlumniFeederMapData,
): AlumniFeederMapController {
  const shell = el("section", "exec-alumni-feeder-map");

  const canvasWrap = el("div", "exec-alumni-feeder-map__canvas-wrap");
  const canvas = el("div", "exec-alumni-feeder-map__canvas");
  canvas.style.position = "absolute";
  canvas.style.inset = "0";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  const loadingState = el("div", "exec-alumni-feeder-map__status", "Loading feeder map...");
  canvasWrap.appendChild(canvas);
  canvasWrap.appendChild(loadingState);

  const sampleNote = el("p", "exec-alumni-feeder-map__sample", t("alumniDeepDive.mapSampleNote"));

  shell.appendChild(canvasWrap);
  shell.appendChild(sampleNote);
  host.replaceChildren(shell);

  let destroyed = false;
  let map: import("maplibre-gl").Map | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let activePopup: import("maplibre-gl").Popup | null = null;
  let layersReady = false;
  let styleLoaded = false;
  let loadTimeout: number | null = null;
  const layerListeners: Array<{
    layerId: string;
    click: MapMouseEventHandler;
    mouseenter: MapMouseEventHandler;
    mouseleave: MapMouseEventHandler;
  }> = [];
  let mapWarningHandler: ((event: unknown) => void) | null = null;
  let mapLoadHandler: (() => void) | null = null;

  const anchor = data.cityCentroids[BEER_SHEVA_CITY];
  const feederGeoJson = anchor ? buildFeederGeoJson(data, anchor) : null;

  function setActivePopup(popup: import("maplibre-gl").Popup | null) {
    activePopup?.remove();
    activePopup = popup;
  }

  function cleanupMapObjects() {
    if (loadTimeout !== null) {
      window.clearTimeout(loadTimeout);
      loadTimeout = null;
    }

    resizeObserver?.disconnect();
    resizeObserver = null;
    setActivePopup(null);
    layersReady = false;
    styleLoaded = false;

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
    const unavailable = el("section", "exec-alumni-unavailable exec-alumni-unavailable--map");
    unavailable.appendChild(el("h3", "exec-alumni-unavailable__title", "Feeder map unavailable"));
    unavailable.appendChild(el("p", "exec-alumni-unavailable__copy", message));
    host.replaceChildren(unavailable);
  }

  function finalizeLayers(maplibre: MapLibreModule) {
    if (!map || !styleLoaded || !feederGeoJson || !anchor || layersReady || destroyed) return;

    map.addSource(FEEDER_LINES_SOURCE, {
      type: "geojson",
      data: feederGeoJson.lines,
    });

    map.addSource(FEEDER_POINTS_SOURCE, {
      type: "geojson",
      data: feederGeoJson.points,
    });

    map.addSource(ANCHOR_SOURCE, {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { city: BEER_SHEVA_CITY },
            geometry: {
              type: "Point",
              coordinates: anchor,
            },
          },
        ],
      },
    });

    map.addLayer({
      id: FEEDER_LINES_LAYER,
      type: "line",
      source: FEEDER_LINES_SOURCE,
      paint: {
        "line-color": FEEDER_COLOR,
        "line-width": 1.5,
        "line-opacity": 0.35,
      },
    });

    map.addLayer({
      id: FEEDER_POINTS_LAYER,
      type: "circle",
      source: FEEDER_POINTS_SOURCE,
      paint: {
        "circle-color": FEEDER_COLOR,
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["get", "count"],
          feederGeoJson.minCount,
          6,
          feederGeoJson.maxCount,
          28,
        ],
        "circle-stroke-width": 1.2,
        "circle-stroke-color": "#fff6f8",
        "circle-opacity": 0.9,
      },
    });

    map.addLayer({
      id: ANCHOR_LAYER,
      type: "circle",
      source: ANCHOR_SOURCE,
      paint: {
        "circle-color": FEEDER_COLOR,
        "circle-radius": 14,
        "circle-stroke-width": 3,
        "circle-stroke-color": "#ffffff",
        "circle-opacity": 1,
      },
    });

    const feederListeners = createLayerListeners(map, maplibre, setActivePopup);
    layerListeners.push({ layerId: FEEDER_POINTS_LAYER, ...feederListeners });

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

    requestAnimationFrame(() => {
      map?.resize();
    });

    resizeObserver = new ResizeObserver(() => {
      map?.resize();
    });
    resizeObserver.observe(canvasWrap);
  }

  if (!anchor || !feederGeoJson || feederGeoJson.points.features.length === 0) {
    renderMapUnavailable(
      "The feeder map needs Beer Sheva coordinates and at least one mapped residence city. Recheck city-centroids.json and feeder_cities.csv.",
    );
    return {
      resize() {},
      destroy() {
        if (destroyed) return;
        destroyed = true;
        host.replaceChildren();
      },
    };
  }

  void (async () => {
    try {
      const maplibre = await import("maplibre-gl");
      if (destroyed) return;
      await registerMapLibreRtlTextPlugin(maplibre);
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
          "The basemap did not finish loading in time. Recheck OpenFreeMap availability before retrying this view.",
        );
      }, MAP_LOAD_TIMEOUT_MS);

      mapLoadHandler = () => {
        styleLoaded = true;
        finalizeLayers(maplibre);
      };
      map.on("load", mapLoadHandler);
    } catch {
      renderMapUnavailable(
        "The map client could not be initialized. Recheck OpenFreeMap availability before retrying this view.",
      );
    }
  })();

  return {
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
