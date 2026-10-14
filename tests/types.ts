import {
  defineProductTokens,
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
