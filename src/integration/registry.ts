import type { IntegrationDef } from "./types";

/** Production iframe targets (GitHub Pages / same deploy). */
const MOBILITY_IFRAME_SRC = "https://negevurbanresearch.github.io/mobility-dashboard/";
const URBAN95_IFRAME_SRC = "https://negevurbanresearch.github.io/urban95/";

export const integrations: IntegrationDef[] = [
  {
    routeKey: "urban/mobility",
    kind: "iframe",
    src: MOBILITY_IFRAME_SRC,
    titleKey: "iframe.mobilityTitle",
  },
  {
    routeKey: "urban/urbanism",
    kind: "iframe",
    src: URBAN95_IFRAME_SRC,
    titleKey: "iframe.urbanismTitle",
  },
];

/** True only on vite dev / localhost — never on `*.github.io`, so production iframe `src` stays the direct github.io URLs. */
function shouldUseLocalEmbedProxy(): boolean {
  if (import.meta.env.DEV) return true;
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1";
}

/**
 * Local dev / `vite preview` on localhost: load embeds through Vite proxy (`vite.config.ts`)
 * so requests are same-origin and frame-blocking headers can be stripped.
 * Deployed site: full github.io URLs.
 */
export function resolveIntegrationIframeSrc(def: IntegrationDef): string {
  if (def.kind !== "iframe") return "";
  if (shouldUseLocalEmbedProxy()) {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    if (def.routeKey === "urban/mobility") return `${base}/mobility-dashboard/`;
    if (def.routeKey === "urban/urbanism") return `${base}/urban95/`;
  }
  return def.src;
}

export function getIntegration(routeKey: string): IntegrationDef | undefined {
  return integrations.find((i) => i.routeKey === routeKey);
}
