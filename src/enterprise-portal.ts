import { prefix } from "./css.js";
import { ownData } from "./extensions.js";
import { registeredSpec } from "./provenance.js";
import type { ProductTokenSpec, ValidatedTheme } from "./types.js";

/**
 * Host-supplied values for the eight `--ab-*` tokens the theme schema has no
 * field for. Every value is checked against a closed grammar and emitted
 * verbatim.
 */
export interface PortalHostValues {
  readonly fontSize: string;
  readonly space1: string;
  readonly space2: string;
  readonly space3: string;
  readonly space4: string;
  readonly borderWidth: string;
  readonly borderStyle: string;
  readonly shadow: string;
}

// Closed grammar (ADR-themes-0004 item 3). No flags: hex digits are spelled
// out, so there is no case-insensitive matching and `RGB(` is rejected.
const NUM = "(?:0|[1-9][0-9]{0,2})(?:\\.[0-9]{1,4})?";
const LENGTH = NUM + "(?:px|rem|em)";
const ZL = "(?:0|" + LENGTH + ")";
const SIGNED = "-?" + ZL;
const INT255 = "(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])";
const ALPHA = "(?:100|[1-9]?[0-9])";
const COLOR =
  "(?:#[0-9a-fA-F]{3,4}|#[0-9a-fA-F]{6}|#[0-9a-fA-F]{8}|rgb\\(" +
  [INT255, INT255, INT255].join(" ") +
  "(?: / " +
  ALPHA +
  "%)?\\))";
const LAYER =
  SIGNED + " " + SIGNED + "(?: " + ZL + "(?: " + SIGNED + ")?)? " + COLOR;
const SHADOW = "none|" + LAYER + "(?:, " + LAYER + "){0,2}";
// The (?![\s\S]) end anchor is the one src/css.ts uses; `$` would accept a
// trailing newline.
const anchored = (source: string) =>
  new RegExp("^(?:" + source + ")(?![\\s\\S])");

const lengthPattern = anchored(LENGTH);
const zeroOrLengthPattern = anchored(ZL);
const shadowPattern = anchored(SHADOW);
const borderStyles: readonly string[] = [
  "none",
  "solid",
  "dashed",
  "dotted",
  "double",
];

const MAX_FIELD = 16;
const MAX_SHADOW = 200;

type Check = (value: string) => boolean;
const checks: Readonly<Record<keyof PortalHostValues, Check>> = {
  // The numeric check is on the parsed number, not a regex special case.
  fontSize: (value) => lengthPattern.test(value) && parseFloat(value) > 0,
  space1: (value) => zeroOrLengthPattern.test(value),
  space2: (value) => zeroOrLengthPattern.test(value),
  space3: (value) => zeroOrLengthPattern.test(value),
  space4: (value) => zeroOrLengthPattern.test(value),
  borderWidth: (value) => zeroOrLengthPattern.test(value),
  borderStyle: (value) => borderStyles.includes(value),
  shadow: (value) => shadowPattern.test(value),
};
const caps: Readonly<Record<keyof PortalHostValues, number>> = {
  fontSize: MAX_FIELD,
  space1: MAX_FIELD,
  space2: MAX_FIELD,
  space3: MAX_FIELD,
  space4: MAX_FIELD,
  borderWidth: MAX_FIELD,
  borderStyle: MAX_FIELD,
  shadow: MAX_SHADOW,
};
const hostKeys = Object.keys(checks) as (keyof PortalHostValues)[];

const ref = (path: string) => "var(--" + prefix + "-" + path + ")";
// One constant feeds --ab-color-border and the --ab-border shorthand.
const borderColor = ref("color-border-strong");

/**
 * Returns the 18 `--ab-*` declarations the enterprise portal reads, one
 * `name: value;` line each, LF endings, no selector. Schema-backed tokens are
 * var() references to the serialiser's custom properties; the host applies
 * those declarations itself. Anything but a validateTheme result, or a host
 * object that is not exactly the eight own data keys in their closed grammar,
 * throws TypeError and returns nothing.
 */
export function portalAliasDeclarations<T extends ProductTokenSpec>(
  theme: ValidatedTheme<T>,
  host: PortalHostValues,
): string {
  if (!registeredSpec(theme))
    throw new TypeError("theme must be returned by validateTheme");
  const values = hostValues(host);
  const lines: [string, string][] = [
    ["font-family", ref("font-body")],
    ["font-size", values.fontSize],
    ["color-text", ref("color-text-primary")],
    ["color-text-muted", ref("color-text-secondary")],
    ["color-bg", ref("color-surface-base")],
    ["color-surface", ref("color-surface-raised")],
    ["color-primary", ref("color-accent-base")],
    ["color-on-primary", ref("color-text-on-accent")],
    ["color-danger", ref("color-status-negative")],
    ["color-success", ref("color-status-positive")],
    ["color-border", borderColor],
    [
      "border",
      values.borderWidth + " " + values.borderStyle + " " + borderColor,
    ],
    ["radius", ref("radius-md")],
    ["space-1", values.space1],
    ["space-2", values.space2],
    ["space-3", values.space3],
    ["space-4", values.space4],
    ["shadow", values.shadow],
  ];
  return lines.map(([name, value]) => "--ab-" + name + ": " + value + ";\n").join("");
}

// Reads every value from its property descriptor, so a getter is never
// invoked, and returns a fresh plain record only when all eight pass.
function hostValues(host: unknown): Record<keyof PortalHostValues, string> {
  const invalid = () => new TypeError("invalid portal host values");
  let data: ReturnType<typeof ownData>;
  try {
    data = ownData(host);
  } catch {
    data = null;
  }
  if (!data) throw invalid();
  const keys = Object.keys(data);
  if (
    keys.length !== hostKeys.length ||
    keys.some((key) => !(hostKeys as string[]).includes(key))
  )
    throw invalid();
  const result = {} as Record<keyof PortalHostValues, string>;
  for (const key of hostKeys) {
    const value: unknown = data[key]!.value;
    if (
      typeof value !== "string" ||
      value.length > caps[key] ||
      !checks[key](value)
    )
      throw invalid();
    result[key] = value;
  }
  return result;
}
