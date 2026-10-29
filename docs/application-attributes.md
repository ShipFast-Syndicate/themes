# Application attributes and system boot script (proposed)

This page is the local contract for `themeHtmlAttributes`, `themeColorMetas`,
`systemBootScript` and `systemBootScriptCspSource`, the FEAT-themes-0003 slice.
It is implemented in this repository but unreleased: there is no installable
package (`private: true`, no package exports) and no product adoption. The
contract stays **proposed** until ADR-themes-0003 is accepted. The boot-script
semver question (is a script or hash change a major change for hash-CSP hosts?)
is open and recorded in that ADR.

The helpers take an already-resolved input. The package does not read
cookies, storage, accounts or site settings, and it has no preference
precedence: the product decides which theme or pair applies.

## API

```ts
type ThemeApplicationInput =
  | { preference: "fixed"; theme: ValidatedTheme }
  | { preference: "system"; light: ValidatedTheme; dark: ValidatedTheme; fallback: "light" | "dark" };
type ThemeColorMeta = { readonly content: string; readonly media?: string };

themeHtmlAttributes(input): Readonly<Record<string, string>>
themeColorMetas(input): readonly ThemeColorMeta[]
systemBootScript: string
systemBootScriptCspSource: string
```

- Every theme must be the exact frozen object returned by a successful
  `validateTheme` call (strict or advisory). Raw JSON, parsed objects, clones,
  spreads, Proxies, `null` and failed results throw. The `ValidatedTheme` type
  is a convenience; the runtime registry is the boundary, as for
  `serializeThemeCss`. Separately loaded copies do not share the registry.
- The input must be a plain object with own data properties only (no getters,
  symbols or arrays) and exactly the keys of its shape: `preference` and
  `theme` for `fixed`; `preference`, `light`, `dark` and `fallback` for
  `system`. `fallback` is required and has no default: it is the no-JS fallback
  and the product's call.
- For `system`, `light.mode` must be `light`, `dark.mode` must be `dark` and the
  two ids must differ.
- Every rejection throws `TypeError("invalid theme application input")`. The
  message never contains input data.
- Both helpers are pure and DOM-free, return frozen data and emit no markup:
  values are validated ids and hex colours, never escaped or caller text.

## Attributes

| Input | Output (in this key order) |
| --- | --- |
| `fixed` | `data-theme` = the theme id |
| `system` | `data-theme` = the id of the member named by `fallback`; `data-theme-light` = light id; `data-theme-dark` = dark id |

Ids match `/^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/`, so they need no escaping
inside double quotes. `data-theme` is the same attribute the `data-theme` form
of [`serializeThemeCss`](css-serialisation.md) selects on. Renaming the
`data-theme-light` / `data-theme-dark` attributes after they are frozen would be
a major change.

## theme-color

`themeColorMetas` reads `color.surface.base` (never `surface.raised`) and
returns it unchanged, including an explicit `ff` alpha channel:

| Input | Output |
| --- | --- |
| `fixed` | `[{ content }]`, no `media` key |
| `system` | `[{ content: light base, media: "(prefers-color-scheme: light)" }, { content: dark base, media: "(prefers-color-scheme: dark)" }]` |

The `fallback` does not change theme-color. `validateTheme` requires an opaque
`surface.base`, so the value is always a valid `#rrggbb` or `#rrggbbff`. The host
builds the `<meta name="theme-color">` tags from the data.

## Boot script

`systemBootScript` is one constant classic inline script (266 UTF-8 bytes, no
leading or trailing whitespace, no newline):

```js
(function(){var d=document.documentElement,m=matchMedia("(prefers-color-scheme: dark)");function a(){var t=d.getAttribute(m.matches?"data-theme-dark":"data-theme-light");if(t)d.setAttribute("data-theme",t)}a();if(m.addEventListener)m.addEventListener("change",a)})()
```

It reads `data-theme-dark` or `data-theme-light` from the root element according
to `matchMedia("(prefers-color-scheme: dark)")`, sets `data-theme` to it, runs
once immediately and re-runs on the query's `change` event. If the chosen
attribute is absent it does nothing, so the server-rendered `data-theme` stays
(this is the fixed-mode no-op). It reads no cookie, `localStorage` or
`sessionStorage`, writes no custom property and uses no `eval`, `fetch` or
`innerHTML`. It contains no `</script` or `<!--`, so it can be embedded verbatim
between script tags.

`systemBootScriptCspSource` is the matching CSP source, precomputed (SHA-256 of
the UTF-8 bytes, base64, single quotes included):

```text
'sha256-foCTvNoUB9XS/pGj3Y2eLtgy+7en967pvmsFOG63d2M='
```

Tests compare the constant with the computed hash and with a literal kept in the
test, so any change to the text fails loudly. Hosts must emit the text byte for
byte (no minifier, no trailing newline) for the hash to match.

Size budget: at most 400 bytes (currently 266). Raising the ceiling needs a new
review, and any text change changes the hash (the open semver question above).

## Limits

- Browsers whose `MediaQueryList` only has `addListener` get the initial value
  but no live updates.
- There is no nonce option, no per-request variation and no high-contrast or
  forced-colors branch.
- No cookies, storage, precedence, framework helper, markup emitter or
  custom-property emission. Presets, adapters and the editor remain planned.
- The package never touches `validateTheme`, `serializeThemeCss` or the CSS
  name map.

## Illustrative SvelteKit example

This is a source-read illustration, not runtime-verified, and does not claim
that any product has adopted it or that first paint is flash-free. Put
placeholders in `src/app.html`:

```html
<html lang="en" %theme.attributes%>
  <head>
    %theme.meta%
    <script>%theme.boot%</script>
```

and fill them in `src/hooks.server.ts` with the already-resolved theme(s):

```ts
import { themeHtmlAttributes, themeColorMetas, systemBootScript } from "@alphabros/themes";

export const handle = async ({ event, resolve }) => {
  const input = resolveThemeInput(event); // product-owned: cookies, precedence, validateTheme
  const attrs = Object.entries(themeHtmlAttributes(input))
    .map(([name, value]) => `${name}="${value}"`)
    .join(" ");
  const meta = themeColorMetas(input)
    .map((m) => `<meta name="theme-color" content="${m.content}"${m.media ? ` media="${m.media}"` : ""}>`)
    .join("");
  return resolve(event, {
    transformPageChunk: ({ html }) =>
      html
        .replace("%theme.attributes%", attrs)
        .replace("%theme.meta%", meta)
        .replace("%theme.boot%", input.preference === "system" ? systemBootScript : ""),
  });
};
```

(The package is private and unreleased, so the import specifier is a
placeholder.) For `fixed` input a host can drop the script tag entirely.

## Hash-CSP note

A host with a hash-based CSP adds `systemBootScriptCspSource` to `script-src`,
for example `script-src 'self' 'sha256-...'`, and emits `systemBootScript`
unchanged. This note is not runtime-verified against any deployed CSP header.
Output of `serializeThemeCss` can be placed in a host `<style>` element; that is
a documentation note only, and stored or site-owner themes need re-validation
before that.

## Proposed versus shipped

Shipped in this repository (unreleased): the helpers, the constant script and its
hash, and their tests. Proposed: the contract itself (ADR-themes-0003), the
attribute names and the semver rule for the script. Not done: Klar or any other
product integration, runtime CSP verification, publication.
