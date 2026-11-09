# Enterprise portal `--ab-*` alias adapter (proposed)

This page is the local contract for `portalAliasDeclarations`, the
FEAT-themes-0004 adapter. It is implemented in this repository but unreleased:
there is no published package, no release and no product adoption. The package
stays `private: true` with version `0.0.0-development`. The contract is recorded
as proposed in ADR-themes-0004 and is not accepted.

The adapter turns a validated theme plus a few host-supplied values into the 18
`--ab-*` custom properties that the `@alphabros/enterprise` portal reads. It
does not render anything. Whether the portal looks right with these values in
light, dark or white-label is not established here; that belongs to a product
pilot.

## API

```ts
import {
  portalAliasDeclarations,
  type PortalHostValues,
} from "@alphabros/themes/enterprise-portal";

portalAliasDeclarations(theme, host: PortalHostValues): string
```

The function lives in a separate entry point, `@alphabros/themes/enterprise-portal`.
It is not re-exported from the core `@alphabros/themes` entry.

- `theme` must be the exact frozen object returned by a successful
  `validateTheme` call, the same admission rule as `serializeThemeCss`. Raw
  JSON, parsed objects, clones, spreads, Proxies and `null` throw
  `TypeError("theme must be returned by validateTheme")`.
- `host` must be a plain object with exactly the eight own data keys of
  `PortalHostValues` and nothing else. A missing, extra, inherited, accessor or
  non-string value throws `TypeError("invalid portal host values")`. Getters are
  never invoked, and error messages never contain input.
- The result is all 18 declarations or an exception, never a subset. Each line
  is `name: value;` with an LF ending, no selector and no indentation, in the
  order of the table below. Output is byte-identical for equal input.
- The function is isomorphic: no DOM, globals, I/O or dependencies.

`PortalHostValues` has eight string fields: `fontSize`, `space1`, `space2`,
`space3`, `space4`, `borderWidth`, `borderStyle` and `shadow`.

## The 18 declarations

Eleven values are `var(--abt-*)` references to properties emitted by
`serializeThemeCss`, one is composed from host values and a reference, and six
are host literals. The mapping of rows 4, 11 and 12 was decided by the Art Bro
Q5 review (2026-11-08): `text.secondary` for muted text, `border.strong` for the
border.

| # | Declaration | Value | Origin |
|---|---|---|---|
| 1 | `--ab-font-family` | `var(--abt-font-body)` | schema |
| 2 | `--ab-font-size` | host `fontSize` | host |
| 3 | `--ab-color-text` | `var(--abt-color-text-primary)` | schema |
| 4 | `--ab-color-text-muted` | `var(--abt-color-text-secondary)` | schema (Q5) |
| 5 | `--ab-color-bg` | `var(--abt-color-surface-base)` | schema |
| 6 | `--ab-color-surface` | `var(--abt-color-surface-raised)` | schema |
| 7 | `--ab-color-primary` | `var(--abt-color-accent-base)` | schema |
| 8 | `--ab-color-on-primary` | `var(--abt-color-text-on-accent)` | schema |
| 9 | `--ab-color-danger` | `var(--abt-color-status-negative)` | schema |
| 10 | `--ab-color-success` | `var(--abt-color-status-positive)` | schema |
| 11 | `--ab-color-border` | `var(--abt-color-border-strong)` | schema (Q5) |
| 12 | `--ab-border` | `<borderWidth> <borderStyle> var(--abt-color-border-strong)` | composed (colour: Q5) |
| 13 | `--ab-radius` | `var(--abt-radius-md)` | schema |
| 14 | `--ab-space-1` | host `space1` | host |
| 15 | `--ab-space-2` | host `space2` | host |
| 16 | `--ab-space-3` | host `space3` | host |
| 17 | `--ab-space-4` | host `space4` | host |
| 18 | `--ab-shadow` | host `shadow` | host |

Rows 11 and 12 always use the same border reference, so they never diverge.
Because every schema-backed value is a `var(--abt-*)` reference, the output does
not vary by theme: light and dark themes give byte-identical declarations, and
the theme argument is an admission gate rather than a value source. The
references name the `abt` prefix; a prefix change after a first release would be
semver-major for this adapter as well as for the serialiser.

## Host values

Every host value is checked against a closed grammar, then emitted verbatim.
Patterns are anchored full matches with no flags, so units and `rgb(` must be
lowercase and a trailing newline is rejected.

- `length`: a number followed by `px`, `rem` or `em`. The number has no sign, no
  leading zero (`0` or `1`-`999` with up to three digits) and at most four
  decimals. No `calc()`, `var()`, `%`, viewport units or keywords.
- `fontSize`: a `length` whose numeric value is above zero, so `0`, `0px` and
  `0.0px` are rejected.
- `space1` to `space4` and `borderWidth`: `0` or a `length`.
- `borderStyle`: one of `none`, `solid`, `dashed`, `dotted`, `double`.
- `shadow`: `none`, or one to three layers separated by a comma and one space.
  A layer is `<x> <y>[ <blur>[ <spread>]] <color>`: `x`, `y` and `spread` are `0`
  or a `length`, optionally preceded by `-`; `blur` is `0` or a `length`.
  `<color>` is `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa` (either case),
  `rgb(R G B)` or `rgb(R G B / A%)` with integers R, G, B in 0-255 and A in
  0-100 and no leading zeros. No `inset`, named colours, `var()`, `url()`,
  comma-syntax `rgb()`, `!important` or comments.
- Length caps run first: 16 characters for every field except `shadow`, 200 for
  `shadow`.

Host values are literals. They do not follow a theme switch and are not scaled by
`--abt-font-scale` or `--abt-density-scale`.

## Enterprise pin

Enterprise owns the list of 18 names; this package pins to it. The vendored
fixture `tests/fixtures/enterprise-portal-tokens.json` records the pin and the
adapter's contract test fails when its names differ from the fixture.

| Field | Value |
|---|---|
| Package | `@alphabros/enterprise` |
| Version | `1.1.3` |
| Tag | `v1.1.3` |
| Commit | `d48fc6301c3e59482aba9e94bf0aec24fb14bd60` (`d48fc63`) |
| File | `src/portal/tokens.md`, sha256 `a30b0c1a36f177c2e4409ccaefbb9ca430a8558a5be6852249856db138ed3d34` |

This is the version the first intended host, Klar, pins. The test compares the
adapter to the vendored fixture only; it makes no network call and cannot see
upstream changes until the fixture is refreshed in a deliberate pin bump.

## Wiring example (illustrative, not runtime-verified)

The sketch below shows how a host could use the adapter with Klar's literal
values. It has not been run in Klar or in a browser, and the page makes no claim
that it renders correctly. The selector and the way the string reaches the page
are the host's choice.

```ts
import { serializeThemeCss, validateTheme } from "@alphabros/themes";
import { portalAliasDeclarations } from "@alphabros/themes/enterprise-portal";

const { theme } = validateTheme(themeJson);
if (!theme) throw new Error("invalid theme");

const host = {
  fontSize: "0.875rem",
  space1: "0.25rem",
  space2: "0.5rem",
  space3: "0.75rem",
  space4: "1rem",
  borderWidth: "1px",
  borderStyle: "solid",
  shadow: "0 1px 3px rgb(0 0 0 / 20%)",
};

// The host owns the selector. The same scope carries the --abt-* declarations
// and the --ab-* aliases that reference them.
const css = `[data-theme="dark"] {
${serializeThemeCss(theme, { form: "declarations" })}${portalAliasDeclarations(theme, host)}}
`;
```

**The `--abt-*` declarations must be in scope.** Each `--ab-*` value above is a
`var(--abt-*)` reference. If no `--abt-*` property is defined in the same scope
or an ancestor, the reference resolves to the CSS initial value and the portal
loses its colours, radius and font. Apply the `serializeThemeCss` declarations
in the same selector, as shown, or in an ancestor.

## Not served

- Klar's white-label primary colour (`--klar-primary`) is not served by this
  adapter. A host that overrides the primary colour does so outside the adapter.
- Light, dark or white-label rendering of the portal, host integration, and any
  contrast result of the portal in a product are not established by this page or
  by the tests.
- `toMuiTheme()`, presets, schema fields for spacing, font size, border or
  shadow, changes to the enterprise token contract, publication and releases.

## Status

Proposed and unreleased. The adapter, its tests and this page exist in the
repository; nothing is published, released or adopted by a product. ADR-themes-0004
remains proposed until it is accepted.
