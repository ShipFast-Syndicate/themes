import { groups, ownData } from "./extensions.js";
import { registeredSpec } from "./provenance.js";
import type { ProductTokenSpec, ValidatedTheme } from "./types.js";

// Custom-property prefix <P>. Proposed until the Q2 prefix decision is
// recorded in ADR-themes-0002; changing it only needs a snapshot refresh.
export const prefix = "t";

export type CssForm = "root" | "data-theme" | "declarations";

const forms: readonly string[] = ["root", "data-theme", "declarations"];
const fontStacks: Readonly<Record<string, string>> = {
  "system-sans": "ui-sans-serif, system-ui, sans-serif",
  "system-serif": "ui-serif, serif",
  "system-mono": "ui-monospace, monospace",
};
const densityScales: Readonly<Record<string, number>> = {
  compact: 0.875,
  comfortable: 1,
  spacious: 1.125,
};
const idPattern = /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?(?![\s\S])/;

const kebab = (segment: string) =>
  segment.replace(/[A-Z]/g, (char) => "-" + char.toLowerCase());
const variable = (path: string) =>
  `--${prefix}-${path.split(".").map(kebab).join("-")}`;
// Inputs are validated as finite, non-negative and at most 999.
const number = (value: number) => {
  const rounded = Math.round(value * 10000) / 10000;
  return String(rounded === 0 ? 0 : rounded);
};

/**
 * Serialises a theme returned by validateTheme into CSS custom properties.
 * Anything else, including clones, spreads and Proxies, throws TypeError.
 */
export function serializeThemeCss<T extends ProductTokenSpec>(
  theme: ValidatedTheme<T>,
  options?: { form?: CssForm },
): string {
  const spec = registeredSpec(theme);
  if (!spec) throw new TypeError("theme must be returned by validateTheme");
  let form = "root";
  if (options !== undefined) {
    let data: ReturnType<typeof ownData>;
    try {
      data = ownData(options);
    } catch {
      data = null;
    }
    if (
      !data ||
      Object.keys(data).some((key) => key !== "form") ||
      (data.form && !forms.includes(data.form.value as string))
    )
      throw new TypeError("invalid serialisation options");
    if (data.form) form = data.form.value as string;
  }
  if (form === "data-theme" && !idPattern.test(theme.id))
    throw new TypeError("theme id is not serialisable");
  const lines: [string, string][] = [["color-scheme", theme.mode]];
  for (const [group, leaves] of Object.entries(groups)) {
    const values = theme.color[group as keyof typeof groups] as Record<
      string,
      string
    >;
    for (const leaf of leaves)
      lines.push([variable(`color.${group}.${leaf}`), values[leaf]!]);
  }
  theme.color.chart.series.forEach((value, i) =>
    lines.push([variable(`color.chart.series.${i}`), value]),
  );
  for (const key of ["sm", "md", "lg", "pill"] as const)
    lines.push([variable(`radius.${key}`), number(theme.radius[key]) + "px"]);
  for (const key of ["body", "heading", "mono"] as const)
    lines.push([variable(`font.${key}`), fontStacks[theme.font[key]]!]);
  lines.push([variable("font.scale"), number(theme.font.scale)]);
  lines.push([
    variable("density.scale"),
    number(densityScales[theme.density]!),
  ]);
  const product = theme.product as Readonly<Record<string, string | number>>;
  for (const key of Object.keys(spec).sort()) {
    const value = product[key]!;
    lines.push([
      variable(`ext.${key}`),
      spec[key]!.type === "color"
        ? String(value)
        : number(value as number) + "px",
    ]);
  }
  const indent = form === "declarations" ? "" : "  ";
  const body = lines
    .map(([name, value]) => `${indent}${name}: ${value};\n`)
    .join("");
  if (form === "declarations") return body;
  const selector = form === "root" ? ":root" : `[data-theme="${theme.id}"]`;
  return `${selector} {\n${body}}\n`;
}
