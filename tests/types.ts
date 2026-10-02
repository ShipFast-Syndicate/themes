import {
  defineProductTokens,
  validateTheme,
  type Theme,
  type CoreColorPath,
  type CoreLengthPath,
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
