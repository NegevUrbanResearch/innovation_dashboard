# KPI Deep-Dive Template

Real Estate Deals is the first validated live deep-dive KPI. New deep dives should follow this path instead of adding one-off overlay branches.

This is today's explicit registration path and it is intentionally conservative while only one deep-dive KPI exists. After the second deep dive lands, reduce repeated touchpoints if the pattern becomes clearer.

## Before Adding A KPI

- Confirm the KPI belongs on the executive overview.
- Confirm whether it needs a two-slot deep dive or only a placeholder card.
- Add `deepDive` capability only when the KPI is actually meant to open the overlay. Unsupported KPIs should stay as placeholder cards without `deepDive`.
- Identify the source data owner, generated artifacts, and refresh cadence.
- Decide whether public generated files are required.

## Required Files For A New Deep Dive

- `src/executive-overview/<domain>-kpi.ts`
- `src/executive-overview/<domain>-deep-dive-data.ts`
- `src/executive-overview/<domain>-deep-dive.ts`
- Optional map/detail module when the right-side evidence surface needs separate logic.
- Optional domain CSS under `src/executive-overview/styles/` when shared overview styles are no longer enough.
- Tests for card field mapping, data parsing, and registry/rendering integration as appropriate.

For data-backed deep dives, this is the expected file checklist. Smaller or simpler KPIs should keep only the modules they actually need, and should not force the full Real Estate split when the KPI can stay clear with a lighter setup. The hard requirement is still the shared registration path plus the minimal loader and renderer modules the KPI actually needs.

## Extension Steps

1. Add the KPI ID to `KpiId` in `src/executive-overview/types.ts`.
2. Add the data source ID to `KpiDataSource`.
3. Add the deep-dive ID to `KpiDeepDiveId` when the KPI has a deep dive.
4. Add the KPI to `KPI_ROSTER` and `LAYOUT_BLOCKS` in `src/executive-overview/config.ts`.
5. Add a typed loader or card mapper like `real-estate-deals.ts` for data-backed KPIs; simple or static KPIs should keep this step minimal, but the KPI still needs a clear typed path into its card model.
6. Load the payload in `mount-executive-overview.ts` if async or generated data is needed.
7. Route the payload through `static-kpi-data.ts` if the KPI needs shared card-model assembly.
8. Add optional helper modules such as `*-deep-dive-data.ts` or map/detail files only when the renderer would otherwise get too heavy.
9. Implement a renderer returning `DeepDiveController` with `destroy()` and `onVisible()`.
10. Register the renderer in `deep-dive-registry.ts`; if a capability is declared before the renderer is ready, the fallback should remain clear.
11. Leave `deep-dive-rendering.ts` generic; only edit it for shared unavailable-state behavior, not KPI-specific content.
12. Import domain CSS through `styles/index.css` when needed.

`renderRegisteredDeepDive(...)` may still return `void` for unavailable or unregistered fallback. The registry is intentionally partial over `KpiDeepDiveId`, so a declared deep-dive capability can fall back cleanly before its renderer exists. That fallback is a safety net for a temporarily missing renderer, not the normal way to ship a KPI that is not meant to open a deep dive yet.

## Two-Slot Contract

- Left slot: primary analysis, chart, controls, or summary.
- Right slot: map, table, detail panel, or supporting evidence.

## Reuse Real Estate Patterns First

- If a new deep dive needs a map, start from the Real Estate map module lifecycle and data-filtering pattern. Reuse that flow first, then extract shared MapLibre helpers before duplicating map setup.
- If a new deep dive needs charts, start from the Real Estate chart, control, and update pattern. Reuse that flow first, then extract shared chart/control helpers before duplicating Chart.js setup.

## Required States

- Loading.
- Unavailable source.
- Empty or invalid data.
- Reduced-motion-safe behavior where animation is involved.
- `destroy()` cleanup for listeners, charts, maps, and timers.
- `onVisible()` is required for registered renderers. It is called after the overlay is actually visible or open, including the reduced-motion path, and should own size-sensitive work such as chart resize, map resize, or deferred layout. Use a no-op when no visibility work is needed.

## Do Not

- Do not import domain modules directly from `kpi-deep-dive-overlay.ts`.
- Do not add renderer maps or KPI-specific branches inside the overlay shell.
- Do not edit generated public data by hand.
- Do not copy Real Estate CSS class names for unrelated domains.
