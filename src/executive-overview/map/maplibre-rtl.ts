let rtlPluginRegistration: Promise<void> | null = null;

export const MAPLIBRE_RTL_PLUGIN_URL = `${import.meta.env.BASE_URL || "/"}vendor/mapbox-gl-rtl-text.js`;

function isRtlPluginAlreadyRegisteredError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /already/i.test(message) && /rtl/i.test(message);
}

export function registerMapLibreRtlTextPlugin(
  maplibre: typeof import("maplibre-gl"),
): Promise<void> {
  if (!rtlPluginRegistration) {
    rtlPluginRegistration = maplibre
      .setRTLTextPlugin(MAPLIBRE_RTL_PLUGIN_URL, false)
      .catch((error: unknown) => {
        if (isRtlPluginAlreadyRegisteredError(error)) {
          return;
        }
        rtlPluginRegistration = null;
        throw error;
      });
  }
  return rtlPluginRegistration;
}
