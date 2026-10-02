# Local schema and validation foundation

This is an internal, unreleased v1 contract, implemented in `src/index.ts` and
built locally to `dist/index.js` with declarations. **There is no installable
release or package export.** `private: true` remains enabled. Source/CI/merge,
publication, product runtime adoption and user acceptance are separate gates.

## Local API

```ts
import {
  defineProductTokens,
  validateTheme,
  contrastRatio,
} from "../dist/index.js";

const declaration = defineProductTokens({
  "demo.heroEnd": { type: "color", defaultFrom: "color.accent.subtle" },
  "demo.gap": { type: "length", defaultFrom: "radius.md" },
});
if (declaration.ok) {
  const result = validateTheme(jsonText, { productTokens: declaration.tokens });
  if (result.ok && result.theme) {
    // result.theme.product['demo.gap'] is an inferred, readonly number.
    // This data is not CSS; applying/persisting it is outside this slice.
  }
}
contrastRatio("#000000", "#ffffff"); // 21
contrastRatio("#ff000080", "#ffffff80", "#000000"); // explicit real backdrop
```

Only three runtime functions are exported from the local entry point:

- `defineProductTokens<const T extends ProductTokenSpec>(spec: T)` returns
  `{ ok: true, tokens: ProductTokens<T> }` or `{ ok: false, errors: Diagnostic[] }`.
- `validateTheme<T>(jsonText: string, options?)` accepts application-controlled
  `mode?: 'strict' | 'advisory'` and issued `productTokens?: ProductTokens<T>`.
  Unknown options, invalid modes and counterfeit declarations reject. Omit
  optional options rather than supplying explicit `undefined` fields.
- `contrastRatio(foreground, background, backdrop?)` returns an unrounded number.
  Invalid hex, missing backdrops for translucent backgrounds, or nonopaque
  backdrops throw `RangeError` with fixed messages.

Exported types: `Theme`, `ValidatedTheme<T>`, `ProductTokenSpec`, `ProductTokens<T>`,
`CoreColorPath`, `CoreLengthPath`, `Diagnostic`, `ContrastPairReport`, and
`ValidationResult<T>`. TypeScript annotations cannot replace runtime validation.

Validation returns `{ ok, theme, errors, warnings, contrast }`. Structural errors
always mean `ok: false`, `theme: null`, and no contrast reports, **in both modes**.
Strict (default) rejects required contrast failures. Advisory retains a valid,
normalized theme and reports contrast failures as warnings, for deliberately
curated product palettes. Adjacent-series failures are warnings in both modes.
The accepted theme is detached, lowercased and recursively frozen; no input
mutation or stripping of unknown fields occurs. Optional `product` becomes `{}`
when no declarations are supplied. Advisory is not a structural bypass.

## Exact v1 document

Root keys are exactly `schemaVersion`, `id`, `name`, `mode`, `color`, `radius`,
`font`, `density`, and optional `product`. All other fields are required.
No `extends`, implicit core defaults, inheritance, CSS output, or migration.

- `schemaVersion`: numeric integer `1` only. Future versions reject.
- `id`: 1–48 ASCII characters matching
  `^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$`.
- `name`: 1–60 Unicode code points, no outer whitespace, controls
  U+0000–001F/U+007F–009F, unpaired surrogates, `<`, `>`, `&`, quotes or backslash.
  Display-only: **not safe HTML**. Always use consumer-appropriate output escaping.
- `mode`: `light` or `dark`. `system` is a consumer preference, not a palette.
- `density`: `compact`, `comfortable`, or `spacious`.

All nested key sets are exact:

| Group           | Required leaves                                               |
| --------------- | ------------------------------------------------------------- |
| `color.surface` | `base`, `raised`, `sunken`, `overlay`                         |
| `color.text`    | `primary`, `secondary`, `muted`, `onAccent`                   |
| `color.accent`  | `base`, `hover`, `subtle`                                     |
| `color.border`  | `subtle`, `strong`, `focus`                                   |
| `color.status`  | `positive`, `negative`, `warning`, `info`                     |
| `color.chart`   | `series` (exactly eight colours), `grid`, `axis`, `tooltipBg` |
| `radius`        | `sm`, `md`, `lg`, `pill`                                      |
| `font`          | `body`, `heading`, `mono`, `scale`                            |

Colour grammar is exactly `^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$`, normalized to
lowercase. Alpha is the final byte divided by 255. `surface.base`, `raised`,
`sunken`, and `chart.tooltipBg` must be opaque (including an explicit `ff` alpha).
Other colours may be translucent. No short hex, named colours, CSS functions,
URLs, comments, external font/resource references, or arbitrary CSS values.

Radius values are finite numbers in CSS-pixel units: `sm/md/lg` in [0, 64] and
`pill` in [0, 999], inclusive, without ordering requirements. Font `body/heading`
allow `system-sans`, `system-serif`, `system-mono`; `mono` permits `system-mono`
only; `scale` is finite in [0.75, 1.5]. Numbers are not coerced from strings.
Stack mapping and density multipliers belong to future serialization.

## Typed product tokens

Declarations contain at most 32 names matching
`^[a-z][a-z0-9]{0,15}\.[a-z][a-zA-Z0-9]{0,31}$` (one literal dot).
Prototype-related names/segments reject. Each descriptor has exactly
`{ type: 'color' | 'length', defaultFrom }`. Colour sources are every scalar core
colour leaf or `color.chart.series.0` through `.7`; length sources are
`radius.sm/md/lg/pill`. Source and type must match. No literals, callbacks,
extension chains, or cycles. Defaults are copied only after the complete core
passes validation; explicit colour values use the same grammar and explicit
length values use [0, 999]. Product values may be a subset of the declared names;
unknown keys reject. All declared keys exist in accepted data. Without issued
declarations only absent or empty product data is allowed.

The issued declaration is opaque, immutable, and holds a detached copy. Ordinary
or null-prototype objects with own enumerable string data properties are allowed.
Inherited custom prototypes, symbol/nonenumerable fields and accessors reject on
both the outer spec and each nested descriptor, without calling getters.
Arbitrary proxies are unsupported caller programming inputs: introspection traps
may execute, but thrown exceptions return `extension.invalid` rather than escape.

## Untrusted JSON boundary and diagnostics

Before parsing: primitive string, at most 16,384 UTF-8 bytes; bounded lexical
preflight permits container depth 6 (root = 1), 256 total object members and 512
total values (including containers/root; keys do not count as values). Decoded
member names and string values each permit 128 code points, with smaller limits
for schema fields. Exact limits are inclusive. No truncation. Duplicate keys
(including escaped equivalent spellings) and `__proto__`, `prototype`,
`constructor` at every depth reject before `JSON.parse`. Nonfinite JSON exponent
results reject; malformed JSON does not escape as an exception.

Diagnostics use `{ code, path, message }`, JSON-pointer paths and stable lexical
path/code ordering. No raw **values** appear in messages; paths identify keys
and must be treated as untrusted display data by consumers. At most 64 diagnostics
are emitted; overflow replaces a slot with fatal `limit.exceeded`.

Codes: `input.type`, `size.exceeded`, `json.syntax`, `json.duplicate`,
`depth.exceeded`, `members.exceeded`, `values.exceeded`, `string.exceeded`,
`keys.unsafe`, `keys.unknown`, `value.type`, `value.range`, `value.format`,
`version.unsupported`, `options.invalid`, `extension.invalid`, `contrast.below`,
`limit.exceeded`. Generic decoded-string limits use `string.exceeded`; smaller
field limits use `value.range`. Failures never return unsafe partial themes.

## Contrast semantics and matrix

WCAG 2.x sRGB: channels /255, linearize with `c <= .04045 ? c/12.92 :
((c+.055)/1.055)^2.4`, luminance `.2126R + .7152G + .0722B`, ratio
`(Lmax+.05)/(Lmin+.05)`. Straight alpha composites in **encoded sRGB**, with no
intermediate byte rounding. A translucent background composites onto the stated
opaque backdrop, then foreground onto that effective background. No assumed
white/black background. Minimum comparison uses the full-precision ratio, `>=`;
formatting to two decimals for display must not affect acceptance.

Every valid structure produces 41 required reports:

- Primary/secondary/muted against base/raised/sunken and tooltip (12), minimum 4.5.
- OnAccent against accent base/hover over base/raised/sunken (6), minimum 4.5.
- Primary against accent subtle over those three surfaces (3), minimum 4.5.
- Each status against base/raised (8), minimum 4.5.
- Strong/focus border and accent base against raised (3), minimum 3.
- Eight chart series and chart axis against raised (9), minimum 3.

Seven adjacent-series reports add advisory-only minimum 3 checks. **Each adjacent
series colour composites independently over raised**, then their effective opaque
colours are compared: neither series overlays the other. Identical translucent
series therefore have ratio 1. All 48 reports include foreground/background/
backdrop token paths, full ratio, minimum, pass, required/advisory policy and a
luminance-separation action naming the tokens and minimum; no automatic repair or
replacement palette is promised.

`border.subtle`, `chart.grid` and `surface.overlay` are decorative, not text or
control affordances. Consumers using them for those roles need extra checks.
Token validation is **not application-level WCAG AA or colour-blindness
certification**; actual components, sizes, states and non-colour cues need review.

## Verification and versioning

```sh
npm ci --include=dev
npm run check
npm run build
npm run typecheck
npm test
git diff --check
```

Node 22, exactly TypeScript 5.9.3, no runtime dependencies. Tests import built
local ESM and type fixtures check inferred product keys and immutable types.
Fixtures are synthetic validation cases, not Art Bro-approved presets. Tests
cover exact parser/field boundaries, nested getter rejection, seed `0x5eed`
1,000-case malformed inputs, independent numeric alpha vectors, threshold
comparators, all pair roles and strict/advisory behavior. CI retains the existing
bootstrap/publication guard. Generated `dist` and `node_modules` are ignored.

Any schema change invalidating accepted v1 documents needs a future major/
migration scope; new defaults or optional core tokens need versioning review.
CSS application, SSR, adapters, presets, builder, persistence, permissions,
entitlements, Klar/Bronan product changes, publishing and releases are excluded.

## Approved product constraints (not implemented here)

- Klar Light / Dark / System in the dashboard and app; Klar Night is default. Amend the dark-only rule during implementation; marketing can retain deliberate branding.
- Private/dashboard views: explicit personal preference, then optional site default, then Klar default. Public/shared views: site-owner theme, then Klar default. Separate branding from mode/accessibility, preserve readability, and keep shared theme edits owner-only initially.
- Personal presets, accessibility modes and the custom-theme builder are included on every plan/trial. Customer-facing themes, logos and branding removal belong to Business and Unlimited. Business coming-soon source is a rollout gap, not evidence of availability or enforcement.
- Art Bro designs curated palettes; Code Bro implements and validates. Generic presets live in the package and product-specific palettes live in products. Initial Klar set: Night, Day, High Contrast, Colour-safe; analytics-inspired variants follow design review.
- Use neutral picker names. Meadow, Signal, Console and Ledger are working examples, not trademark-cleared final names. Competitor names appear only in factual migration/comparison copy with exact wording reviewed; no affiliation claim or brand assets.

These approved choices remain binding on later products. The foundation only
validates data; it does not implement preferences, pricing, owner permissions or
palette design. MIT framework-agnostic tooling keeps strict user-created and
advisory curated validation separate.
