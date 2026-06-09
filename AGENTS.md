# Agent Instructions

## Read First

- `README.md`
- `docs/kpi-deep-dive-template.md`
- `src/executive-overview/config.ts`
- `src/executive-overview/deep-dive-registry.ts`

## Working Rules

- Preserve the executive overview visual contract unless the user asks for design changes.
- Do not edit generated files in `public/real-estate/` by hand; regenerate them or explain why regeneration is unavailable.
- Keep new deep-dive KPIs on the registry path in `src/executive-overview/deep-dive-registry.ts`.
- Do not add KPI-specific branches to `kpi-deep-dive-overlay.ts`.
- Keep broad legacy cleanup, such as splitting `src/styles.css`, separate from KPI feature work.
- Do not create commits or git worktrees unless the user asks.
- Do not run tests when the user explicitly says not to.
- Treat untracked external or tooling folders such as `tools/` as out of scope unless the user asks.

## Verification

- `npm run test:executive-overview`
- `npm run test:linkedin-charts`
- `npm run build`

These are the expected verification commands after approved implementation work unless the user says not to run tests.

## Executive Overview Smoke Test

1. Run `npm run dev`.
2. Open the Vite URL.
3. Confirm the overview renders.
4. Click the Real Estate Deals KPI card.
5. Confirm the overlay opens.
6. Confirm the chart and map/detail panel load or show a clear unavailable state.
7. Close the overlay and confirm focus and scroll behavior remain usable.

`npm run build` regenerates Real Estate KPI artifacts before the Vite build.
