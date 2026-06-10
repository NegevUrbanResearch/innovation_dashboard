# Beer Sheva Innovation District Dashboard

Executive KPI dashboard for the Beer Sheva Innovation District. The current live surface is the executive overview with KPI cards and the Real Estate Deals deep dive.

## Stack

- Vite
- TypeScript
- Plain DOM modules
- Chart.js
- MapLibre
- Python for generated Real Estate artifacts

## Quick Start

```bash
npm install
npm run dev
```

## Common Commands

- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run test:executive-overview`
- `npm run test:linkedin-charts`

`npm run build` runs `build:real-estate-kpi` before the Vite build.

## Project Map

- `src/main.ts`
- `src/executive-overview/`
- `src/linkedin-charts/`
- `scripts/build-real-estate-kpi.py`
- `public/real-estate/`

`src/executive-overview/data/` is for overview-level input loaders. Deep-dive data loading belongs under `src/executive-overview/deep-dives/<domain>/`; the alumni loader's LinkedIn helper imports are a narrow legacy dependency, not a shared pattern for new deep dives.

## Runtime Flow

1. `src/main.ts` mounts the app shell and calls `mountExecutiveOverview`.
2. `src/executive-overview/mount-executive-overview.ts` loads KPI inputs.
3. `src/executive-overview/cards/static-kpi-data.ts` builds card models from `KPI_ROSTER` and `LAYOUT_BLOCKS`.
4. `src/executive-overview/cards/kpi-card.ts` renders KPI cards.
5. `src/executive-overview/overlay/kpi-deep-dive-overlay.ts` owns the overlay shell and lifecycle.
6. `src/executive-overview/deep-dives/registry.ts` maps deep-dive IDs to content modules.

## Real Estate Data Artifacts

- `scripts/build-real-estate-kpi.py` generates `deals-kpi.json`, `deals-timeseries.json`, and `deals-markers.geojson` under `public/real-estate/`.
- Source CSV locations:
  - `data/real-estate/deals-price-changes.csv`
  - `dist/real-estate/deals-price-changes.csv`
- `REAL_ESTATE_KPI_AS_OF=YYYY-MM-DD` can pin the generation date.
- If no source CSV exists, the script keeps the existing generated public artifacts and exits successfully, so stale generated data is possible.
- Do not hand-edit generated `public/real-estate/` files.

## Adding KPI Deep Dives

Use `docs/kpi-deep-dive-template.md` when adding a new deep dive. Register new deep dives through `src/executive-overview/deep-dives/registry.ts`, and keep `src/executive-overview/overlay/kpi-deep-dive-overlay.ts` generic with no KPI-specific branches. Real Estate Deals is the first validated reference implementation.
