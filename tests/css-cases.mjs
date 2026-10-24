import {
  defineProductTokens,
  serializeThemeCss,
  validateTheme,
} from "../dist/index.js";
import { theme, json } from "./fixtures.mjs";

export const demoTokens = () => {
  const declared = defineProductTokens({
    "demo.heroEnd": { type: "color", defaultFrom: "color.accent.subtle" },
    "demo.gap": { type: "length", defaultFrom: "radius.md" },
  });
  if (!declared.ok) throw new Error("demo declarations rejected");
  return declared.tokens;
};
export function validated(source, productTokens) {
  const result = validateTheme(
    json(source),
    productTokens ? { productTokens } : undefined,
  );
  if (!result.ok) throw new Error(json(result.errors));
  return result.theme;
}
export function snapshotCases() {
  const cases = [];
  for (const mode of ["light", "dark"])
    for (const product of [false, true])
      for (const form of ["root", "data-theme", "declarations"]) {
        const file = `${mode}${product ? "-product" : ""}-${form}.css`;
        const css = () =>
          serializeThemeCss(
            validated(theme(mode), product ? demoTokens() : undefined),
            { form },
          );
        cases.push({ file, css });
      }
  return cases;
}
