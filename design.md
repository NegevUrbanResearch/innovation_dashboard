# ID Dashboard — Design Reference

A portable spec of the palette, typography, and component patterns used in this
dashboard. Use it to style a separate dashboard in another repo so that it reads
as a native deep dive when linked from here.

The system has two layers:

1. **App shell** — the global chrome (header, nav, charts) that supports a
   light and a dark theme via tokens on `<html data-theme>`.
2. **Executive overview** — a fixed **light** surface with a categorical palette
   (`--eo-*` tokens). Deep dives open from this surface, so a linked dashboard
   should match the executive-overview look first.

---

## 1. Color palette

### Executive overview (primary brand surface, light only)

| Token | Hex | Role |
| --- | --- | --- |
| `--eo-canvas` | `#e6eee8` | Page background / canvas |
| `--eo-surface` | `#f8fbf9` | Card and panel surface |
| `--eo-text-primary` | `#101317` | Primary text |
| `--eo-text-secondary` | `#49454f` | Secondary / muted text |
| `--eo-border-default` | `#79747e` | Default border |
| `--eo-delta-positive` | `#0f8e4a` | Positive delta / "up" |
| `--eo-delta-negative` | `#c93a3a` | Negative delta / "down" |

#### Category accents (each accent pairs with a soft fill)

| Category | Accent | Soft fill |
| --- | --- | --- |
| Economy | `#368393` | `#c9eaf1` |
| Network | `#74094a` | `#d3adc4` |
| Physical | `#875800` | `#fcd68d` |
| Physical (outside) | `#4d7c82` | — |

The **Physical** category (`#875800` / `#fcd68d`) is the deep-dive accent: the
overlay chrome, controls, range slider, and map markers all derive from it. A
linked "deep dive" dashboard should adopt the Physical accent unless it
represents a different category.

### App shell — light theme (`html[data-theme="light"]`)

| Token | Hex | Role |
| --- | --- | --- |
| `--bg` | `#eceff4` | App background |
| `--bg-muted` | `#e2e7ef` | Muted background |
| `--surface` | `#ffffff` | Surface |
| `--surface-2` | `#f8fafc` | Raised surface (subtle) |
| `--surface-raised` | `#ffffff` | Raised surface |
| `--border` | `#d8dee9` | Border |
| `--border-strong` | `#c5cedd` | Strong border |
| `--text` | `#0f172a` | Text |
| `--text-secondary` | `#64748b` | Secondary text |
| `--accent` | `#4f46e5` | Accent / focus ring |
| `--link` / `--link-hover` | `#4f46e5` / `#4338ca` | Links |

### App shell — dark theme (`html[data-theme="dark"]`)

| Token | Hex | Role |
| --- | --- | --- |
| `--bg` | `#0a0c10` | App background |
| `--bg-muted` | `#121722` | Muted background |
| `--surface` | `#161c27` | Surface |
| `--surface-2` | `#1c2330` | Subtle raised |
| `--surface-raised` | `#232b3b` | Raised surface |
| `--border` | `rgba(148,163,184,0.16)` | Border |
| `--border-strong` | `rgba(148,163,184,0.32)` | Strong border |
| `--text` | `#f1f5f9` | Text |
| `--text-secondary` | `#94a3b8` | Secondary text |
| `--accent` | `#38bdf8` | Accent / focus ring |
| `--link` / `--link-hover` | `#7dd3fc` / `#bae6fd` | Links |

### Shared chart triads (stable across themes)

- **Cohort Venn:** `#4a6fa5` (blue), `#47b8a0` (teal), `#e8c84a` (yellow).
- **Residence donut (light):** `#0891b2`, `#4f46e5`, `#0d9488`, `#7c3aed`.
- **Residence donut (dark):** `#22d3ee`, `#818cf8`, `#2dd4bf`, `#c084fc`.

---

## 2. Typography

Fonts are loaded from Google Fonts (see `index.html`):
`Fraunces`, `Libre Bodoni`, `Open Sans`, `Inter Tight`, `Assistant` (Hebrew),
`JetBrains Mono`.

| Variable | Stack | Used for |
| --- | --- | --- |
| `--font` | `"Inter Tight", system-ui, sans-serif` | App UI body (Hebrew swaps to `Assistant`) |
| `--font-display` | `"Fraunces", Georgia, serif` | Display headings |
| `--font-mono` | `"JetBrains Mono", ui-monospace, monospace` | Numeric / mono |
| `--eo-font-ui` | `"Open Sans", system-ui, sans-serif` | Overview UI text |
| `--eo-font-display` | `var(--font-display)` (Fraunces) | Overview headings / KPI names |
| `--eo-font-value` | `"Libre Bodoni", Georgia, serif` | Big metric values, overlay titles |

Base body: `font-size: 16.5px; line-height: 1.5;` with `-webkit-font-smoothing: antialiased`.

Type ramp from the KPI card / overlay:

- KPI name — Fraunces 600, 13px, category accent, `letter-spacing: -0.02em`.
- Metric value — Libre Bodoni 400, 34px, `line-height: 1`.
- Period / baseline — Open Sans 400, 12–13px, `--eo-text-secondary`.
- Overlay title — Libre Bodoni 500, `clamp(1.65rem, 2vw, 2.15rem)`.
- Eyebrow / control labels — Open Sans 700, 0.76rem, **uppercase**.

Headings generally use `letter-spacing: -0.02em`; eyebrows and small control
labels use uppercase with positive tracking.

---

## 3. Shape, spacing, elevation

### Radii

| Token | Value |
| --- | --- |
| `--radius` | `10px` |
| `--radius-sm` | `8px` |
| `--radius-pill` | `999px` |
| `--eo-card-radius` | `10px` |
| Overlay shell / panels | `16px` / `12px` |

### Shadows

| Token | Value |
| --- | --- |
| `--shadow-sm` | `0 1px 2px rgba(15,23,42,0.06)` |
| `--shadow-md` | `0 4px 14px rgba(15,23,42,0.08)` |
| `--eo-card-shadow` | `5px 5px 0 rgb(16 19 23 / 0.4)` (hard offset, signature look) |
| Overlay shell | `0 26px 48px rgb(16 19 23 / 0.14), 0 8px 20px rgb(16 19 23 / 0.1)` |

The KPI card's **hard, non-blurred offset shadow** (`5px 5px 0`) is the most
recognizable motif. Reuse it for card-like elements that belong to the overview.

### Motion

- Standard transition: `180ms ease` (hover/active states), `160ms` for controls.
- Overlay entrance: `220ms ease` opacity + transform.
- Always wrap non-essential motion in `@media (prefers-reduced-motion: reduce)`.

### Focus

Visible focus everywhere: `outline: 2px solid var(--accent)` (app) or
`2px solid color-mix(in srgb, <category-accent> 72%, white)` (overview),
`outline-offset: 2px`. Minimum interactive target height ~44px.

---

## 4. Component patterns

### KPI card

- Fixed `214 × 155px`, `border-radius: 10px`, 1px border in the category accent,
  soft category fill background, hard offset shadow.
- Layout: header (name + period) top-start, value centered, footer bottom-end.
- Hover lifts `translateY(-2px)` and deepens the shadow to `8px 10px 0`.
- Delta pill: pill (`999px`), tinted `color-mix(... 12%, transparent)` of the
  positive/negative/flat color, 700 weight.

### Deep-dive overlay (the container a linked dashboard lives in)

- Shell inset `1rem` from the viewport, `border-radius: 16px`, 1px border mixing
  the physical accent into the default border, surface gradient
  `linear-gradient(180deg, surface 92%→ white, surface 98%→ physical-soft)`.
- Header row: eyebrow (uppercase, physical accent) + Libre Bodoni title on the
  left, pill-shaped Close button on the right.
- Body: two-column grid `minmax(20rem,0.95fr) / minmax(24rem,1.15fr)`, `1rem` gap.
- Panels: `border-radius: 12px`, 1px hairline border (`physical-accent 14%`),
  surface `color-mix(... 88%, white)`; the right panel adds a soft physical-tinted
  gradient.

### Controls

- **Segmented control:** pill container, `0.2rem` padding, 1px tinted border;
  selected segment gets a soft fill, accent text, and inset 1px ring.
- **Range slider:** track `0.4rem` tall pill in `accent 14%`, fill is an accent→
  soft gradient, circular thumb in the accent with a white 2px ring.
- **Pills / chips:** `999px`, 1px tinted border, soft fill, 700-weight accent text.
- **Tabs / view buttons:** flat, transparent until active; active state uses
  `--subnav-active-bg` with an inset 1px `--subnav-active-border` ring.

### Tooltips

`position: fixed`, `--surface-raised` background, 1px `--border`, `--radius-sm`,
`--shadow-md`, ~0.82rem text.

---

## 5. Using `color-mix`

The system leans on `color-mix(in srgb, <token> N%, white|transparent)` to derive
tints from a single accent rather than hard-coding shades. Prefer this so a single
category accent can drive borders (`~14–24%`), soft fills (`~32–70%`), and rings.

---

## 6. Quick-start tokens for a linked dashboard

Drop these on a wrapper element to match the deep-dive (Physical) surface:

```css
.deep-dive-surface {
  --canvas: #e6eee8;
  --surface: #f8fbf9;
  --text-primary: #101317;
  --text-secondary: #49454f;
  --border-default: #79747e;
  --accent: #875800;        /* physical */
  --accent-soft: #fcd68d;
  --accent-alt: #4d7c82;    /* physical outside */
  --positive: #0f8e4a;
  --negative: #c93a3a;

  --font-ui: "Open Sans", system-ui, sans-serif;
  --font-display: "Fraunces", Georgia, serif;
  --font-value: "Libre Bodoni", Georgia, serif;

  --radius: 10px;
  --radius-pill: 999px;
  --card-shadow: 5px 5px 0 rgb(16 19 23 / 0.4);

  background: var(--canvas);
  color: var(--text-primary);
  font-family: var(--font-ui);
}
```

If the linked dashboard should also support the app's dark mode, mirror the
`html[data-theme="dark"]` token values from section 1 and switch on a
`data-theme` attribute.
