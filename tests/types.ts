import {
  defineProductTokens,
  serializeThemeCss,
  themeColorMetas,
  themeHtmlAttributes,
  systemBootScript,
  systemBootScriptCspSource,
  validateTheme,
  type Theme,
  type CoreColorPath,
  type CoreLengthPath,
  type HexColor,
  type ProductTokenSpec,
} from "../src/index.js";
const declaration = defineProductTokens({
  "demo.heroEnd": { type: "color", defaultFrom: "color.accent.subtle" },
  "demo.gap": { type: "length", defaultFrom: "radius.md" },
});
if (declaration.ok) {
  const result = validateTheme("{}", { productTokens: declaration.tokens });
  if (result.theme) {
    const color: string = result.theme.product["demo.heroEnd"];
    const gap: number = result.theme.product["demo.gap"];
    void color;
    void gap;
    // @ts-expect-error inferred length is not a string
    const incorrect: string = result.theme.product["demo.gap"];
    // @ts-expect-error undeclared product key
    result.theme.product["demo.unknown"];
    // @ts-expect-error immutable returned theme
    result.theme.color.chart.series[0] = "#ffffff";
    // @ts-expect-error immutable product
    result.theme.product["demo.gap"] = 10;
    void incorrect;
  }
}
// Colour tokens must type as colours, never as numbers, including when the
// declaration is widened and the descriptor type is a union.
const widened = defineProductTokens({
  "demo.mixed": {
    type: "color",
    defaultFrom: "color.accent.base",
  } as ProductTokenSpec[string],
});
if (widened.ok) {
  const mixed = validateTheme("{}", { productTokens: widened.tokens });
  if (mixed.theme) {
    const value: HexColor | number = mixed.theme.product["demo.mixed"];
    // @ts-expect-error a widened descriptor may be a colour, not only a number
    const asNumber: number = mixed.theme.product["demo.mixed"];
    void value;
    void asNumber;
  }
}
const colorOnly = defineProductTokens({
  "demo.brand": { type: "color", defaultFrom: "color.accent.base" },
});
if (colorOnly.ok) {
  const only = validateTheme("{}", { productTokens: colorOnly.tokens });
  if (only.theme) {
    const brand: HexColor = only.theme.product["demo.brand"];
    // @ts-expect-error colour tokens are not numbers
    const asNumber: number = only.theme.product["demo.brand"];
    void brand;
    void asNumber;
  }
}
defineProductTokens({
  // @ts-expect-error color cannot default from a numeric token
  "demo.color": { type: "color", defaultFrom: "radius.md" },
});
// @ts-expect-error no literal defaults
defineProductTokens({ "demo.gap": { type: "length", defaultFrom: 4 } });
// @ts-expect-error arbitrary product path
const badColor: CoreColorPath = "product.demo.color";
// @ts-expect-error invalid series index
const badSeries: CoreColorPath = "color.chart.series.8";
// @ts-expect-error no non-radius length tokens
const badLength: CoreLengthPath = "font.scale";
// @ts-expect-error system is a preference, not a theme mode
const mode: Theme["mode"] = "system";
const plain = validateTheme("{}");
if (plain.theme) {
  // @ts-expect-error default validation has no product keys
  plain.theme.product["anything"];
}
void badColor;
void badSeries;
void badLength;
void mode;
// serializeThemeCss accepts what validateTheme returns; the runtime registry,
// not this type, is the boundary.
if (declaration.ok) {
  const validated = validateTheme("{}", { productTokens: declaration.tokens });
  if (validated.theme) {
    const css: string = serializeThemeCss(validated.theme, {
      form: "data-theme",
    });
    void css;
    // @ts-expect-error unsupported form
    serializeThemeCss(validated.theme, { form: "body" });
    // @ts-expect-error selectors are not caller-supplied
    serializeThemeCss(validated.theme, { selector: ":root" });
  }
}
// Application helpers accept validated themes with and without product tokens;
// the runtime registry, not these types, is the boundary.
const applied = validateTheme("{}");
if (applied.theme && declaration.ok) {
  const withProduct = validateTheme("{}", { productTokens: declaration.tokens });
  if (withProduct.theme) {
    const attrs: Readonly<Record<string, string>> = themeHtmlAttributes({
      preference: "fixed",
      theme: withProduct.theme,
    });
    const metas: readonly { readonly content: string; readonly media?: string }[] =
      themeColorMetas({
        preference: "system",
        light: applied.theme,
        dark: withProduct.theme,
        fallback: "dark",
      });
    void attrs;
    void metas;
  }
  themeHtmlAttributes({ preference: "fixed", theme: applied.theme });
  // @ts-expect-error system input requires a fallback
  themeHtmlAttributes({ preference: "system", light: applied.theme, dark: applied.theme });
  themeColorMetas({
    preference: "system",
    light: applied.theme,
    dark: applied.theme,
    // @ts-expect-error fallback is light or dark only
    fallback: "auto",
  });
  // @ts-expect-error a raw theme object is not a validated theme
  themeHtmlAttributes({ preference: "fixed", theme: {} as Theme });
}
const bootScript: string = systemBootScript;
const bootSource: string = systemBootScriptCspSource;
void bootScript;
void bootSource;
