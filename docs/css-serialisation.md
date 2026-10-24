# CSS custom-property serialisation (proposed)

This page is the local contract for `serializeThemeCss`, the FEAT-themes-0002
serialiser. It is implemented in this repository but unreleased: there is no
installable package, no package exports and no product adoption. The
custom-property prefix is still an open decision (Q2), so names are written
here with `<P>`. The code currently uses the placeholder `t` (`--t-*`) from one
internal constant; the recorded answer changes that constant and the snapshots.
The contract is recorded as proposed in ADR-themes-0002.

## API

```ts
serializeThemeCss(theme, options?: { form?: "root" | "data-theme" | "declarations" }): string
```

- `theme` must be the exact frozen object returned by a successful
  `validateTheme` call (strict or advisory). The check happens at runtime:
  `validateTheme` records each theme it returns in a module-private registry.
  Raw JSON, parsed objects, clones, spreads, Proxies, `null` and failed results
  throw `TypeError("theme must be returned by validateTheme")`. The
  `ValidatedTheme<T>` parameter type is a convenience only.
- Two separately loaded copies of the module do not share the registry, so a
  theme from one copy is rejected by the other. This is intended.
- `options` must be `undefined` or a plain object with own data properties
  only, holding at most `form`. Anything else, including getters, unknown keys
  such as `selector`, and unknown forms, throws
  `TypeError("invalid serialisation options")`. Error messages never contain
  input data.
- The function is isomorphic: no DOM, globals, I/O or dependencies. It does
  not re-run contrast checks; advisory warnings are not emitted.

## Selector forms

The selector grammar is closed. Callers cannot pass selectors, prefixes or
names.

- `root` (default): `:root {` ... `}`.
- `data-theme`: `[data-theme="<id>"] {` ... `}`, where `<id>` is the validated
  theme id (`/^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/`, re-checked, never escaped).
- `declarations`: the declaration lines only, without selector, braces or
  indentation.

## Text format

Each declaration is one line, `name: value;`, indented by two spaces inside a
block. Lines end with LF. A block ends with `}` and LF; the declarations form
ends with LF after the last declaration. Output is byte-identical for equal
validated input.

## Name map and order

Names are derived from token paths: segments joined by `-`, camelCase segments
in kebab-case. There are two exceptions: `color-scheme` is the standard CSS
property, and `density` becomes `--<P>-density-scale` because it emits a
multiplier. Chart series keep their 0-based index. The 39 core declarations are
emitted in this order:

| # | Declaration | Token path | Value |
|---|---|---|---|
| 1 | `color-scheme` | `mode` | `light` or `dark` |
| 2 | `--<P>-color-surface-base` | `color.surface.base` | colour |
| 3 | `--<P>-color-surface-raised` | `color.surface.raised` | colour |
| 4 | `--<P>-color-surface-sunken` | `color.surface.sunken` | colour |
| 5 | `--<P>-color-surface-overlay` | `color.surface.overlay` | colour |
| 6 | `--<P>-color-text-primary` | `color.text.primary` | colour |
| 7 | `--<P>-color-text-secondary` | `color.text.secondary` | colour |
| 8 | `--<P>-color-text-muted` | `color.text.muted` | colour |
| 9 | `--<P>-color-text-on-accent` | `color.text.onAccent` | colour |
| 10 | `--<P>-color-accent-base` | `color.accent.base` | colour |
| 11 | `--<P>-color-accent-hover` | `color.accent.hover` | colour |
| 12 | `--<P>-color-accent-subtle` | `color.accent.subtle` | colour |
| 13 | `--<P>-color-border-subtle` | `color.border.subtle` | colour |
| 14 | `--<P>-color-border-strong` | `color.border.strong` | colour |
| 15 | `--<P>-color-border-focus` | `color.border.focus` | colour |
| 16 | `--<P>-color-status-positive` | `color.status.positive` | colour |
| 17 | `--<P>-color-status-negative` | `color.status.negative` | colour |
| 18 | `--<P>-color-status-warning` | `color.status.warning` | colour |
| 19 | `--<P>-color-status-info` | `color.status.info` | colour |
| 20 | `--<P>-color-chart-grid` | `color.chart.grid` | colour |
| 21 | `--<P>-color-chart-axis` | `color.chart.axis` | colour |
| 22 | `--<P>-color-chart-tooltip-bg` | `color.chart.tooltipBg` | colour |
| 23 | `--<P>-color-chart-series-0` | `color.chart.series.0` | colour |
| 24 | `--<P>-color-chart-series-1` | `color.chart.series.1` | colour |
| 25 | `--<P>-color-chart-series-2` | `color.chart.series.2` | colour |
| 26 | `--<P>-color-chart-series-3` | `color.chart.series.3` | colour |
| 27 | `--<P>-color-chart-series-4` | `color.chart.series.4` | colour |
| 28 | `--<P>-color-chart-series-5` | `color.chart.series.5` | colour |
| 29 | `--<P>-color-chart-series-6` | `color.chart.series.6` | colour |
| 30 | `--<P>-color-chart-series-7` | `color.chart.series.7` | colour |
| 31 | `--<P>-radius-sm` | `radius.sm` | number + `px` |
| 32 | `--<P>-radius-md` | `radius.md` | number + `px` |
| 33 | `--<P>-radius-lg` | `radius.lg` | number + `px` |
| 34 | `--<P>-radius-pill` | `radius.pill` | number + `px` |
| 35 | `--<P>-font-body` | `font.body` | font stack |
| 36 | `--<P>-font-heading` | `font.heading` | font stack |
| 37 | `--<P>-font-mono` | `font.mono` | font stack |
| 38 | `--<P>-font-scale` | `font.scale` | unitless number |
| 39 | `--<P>-density-scale` | `density` | density scale |

Product extension tokens follow the core block, sorted by declared key in UTF-16
code-unit order. A key `<ns>.<name>` emits `--<P>-ext-<ns>-<kebab(name)>`, for
example `demo.heroEnd` becomes `--<P>-ext-demo-hero-end`. Every declared token
is emitted, because `validateTheme` already fills missing values from their core
leaf. The `ext` segment keeps product names from shadowing core names.

## Values

- Colours: the validated lowercase `#rrggbb` or `#rrggbbaa`, unchanged.
- Lengths (`radius.*` and length product tokens): formatted number + `px`.
- `font.scale` and the density scale: unitless formatted number.
- Number formatting: `r = Math.round(x * 10000) / 10000`, `-0` becomes `0`,
  then `String(r)`. Validated ranges keep this free of exponents and trailing
  zeros: `1.23456` → `1.2346`, `0.00001` → `0`, `1.00005` → `1.0001`.
- Font stacks use CSS generic families only, so no fonts are loaded:

  | Font id | Stack |
  |---|---|
  | `system-sans` | `ui-sans-serif, system-ui, sans-serif` |
  | `system-serif` | `ui-serif, serif` |
  | `system-mono` | `ui-monospace, monospace` |

- Density scale: `compact` 0.875, `comfortable` 1, `spacious` 1.125.
- `color-scheme`: the theme `mode`, `light` or `dark`.

## Examples

`root`, light test fixture with `demo.heroEnd` (colour from
`color.accent.subtle`) and `demo.gap` (length from `radius.md`):

```css
:root {
  color-scheme: light;
  --<P>-color-surface-base: #ffffff;
  --<P>-color-surface-raised: #ffffff;
  --<P>-color-surface-sunken: #ffffff;
  --<P>-color-surface-overlay: #00000000;
  --<P>-color-text-primary: #000000;
  --<P>-color-text-secondary: #000000;
  --<P>-color-text-muted: #000000;
  --<P>-color-text-on-accent: #ffffff;
  --<P>-color-accent-base: #000000;
  --<P>-color-accent-hover: #000000;
  --<P>-color-accent-subtle: #00000000;
  --<P>-color-border-subtle: #ffffff;
  --<P>-color-border-strong: #000000;
  --<P>-color-border-focus: #000000;
  --<P>-color-status-positive: #000000;
  --<P>-color-status-negative: #000000;
  --<P>-color-status-warning: #000000;
  --<P>-color-status-info: #000000;
  --<P>-color-chart-grid: #ffffff;
  --<P>-color-chart-axis: #000000;
  --<P>-color-chart-tooltip-bg: #ffffff;
  --<P>-color-chart-series-0: #000000;
  --<P>-color-chart-series-1: #000000;
  --<P>-color-chart-series-2: #000000;
  --<P>-color-chart-series-3: #000000;
  --<P>-color-chart-series-4: #000000;
  --<P>-color-chart-series-5: #000000;
  --<P>-color-chart-series-6: #000000;
  --<P>-color-chart-series-7: #000000;
  --<P>-radius-sm: 0px;
  --<P>-radius-md: 8px;
  --<P>-radius-lg: 64px;
  --<P>-radius-pill: 999px;
  --<P>-font-body: ui-sans-serif, system-ui, sans-serif;
  --<P>-font-heading: ui-serif, serif;
  --<P>-font-mono: ui-monospace, monospace;
  --<P>-font-scale: 1;
  --<P>-density-scale: 1;
  --<P>-ext-demo-gap: 8px;
  --<P>-ext-demo-hero-end: #00000000;
}
```

`data-theme`, dark test fixture (first lines):

```css
[data-theme="test-theme"] {
  color-scheme: dark;
  --<P>-color-surface-base: #000000;
  --<P>-color-surface-raised: #000000;
  ...
```

`declarations`, light test fixture (first lines):

```css
color-scheme: light;
--<P>-color-surface-base: #ffffff;
--<P>-color-surface-raised: #ffffff;
...
```

## Out of scope

`--ab-*` aliases, SSR helpers, boot scripts, `<meta name="theme-color">`,
presets, framework adapters, DOM application helpers, CSP handling, minification
and caller-supplied selectors or prefixes are not part of this slice.
