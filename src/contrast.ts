import type { ContrastPairReport, CoreColorPath, Theme } from "./types.js";
// Use an absolute end assertion: JavaScript $ also matches before a final newline.
export const hexPattern = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?(?![\s\S])/;
type RGBA = readonly [number, number, number, number];
function parse(value: string): RGBA {
  if (typeof value !== "string" || !hexPattern.test(value))
    throw new RangeError("Expected a six- or eight-digit hex colour.");
  return [
    parseInt(value.slice(1, 3), 16) / 255,
    parseInt(value.slice(3, 5), 16) / 255,
    parseInt(value.slice(5, 7), 16) / 255,
    value.length === 9 ? parseInt(value.slice(7, 9), 16) / 255 : 1,
  ];
}
function composite(front: RGBA, back: RGBA): RGBA {
  const alpha = front[3];
  return [
    alpha * front[0] + (1 - alpha) * back[0],
    alpha * front[1] + (1 - alpha) * back[1],
    alpha * front[2] + (1 - alpha) * back[2],
    1,
  ];
}
function luminance(color: RGBA): number {
  const linear = color
    .slice(0, 3)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
}
function ratio(a: RGBA, b: RGBA): number {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
export function contrastRatio(
  foreground: string,
  background: string,
  backdrop?: string,
): number {
  const front = parse(foreground),
    back = parse(background);
  const base = backdrop === undefined ? undefined : parse(backdrop);
  if (base && base[3] !== 1) throw new RangeError("Backdrop must be opaque.");
  if (back[3] !== 1 && !base)
    throw new RangeError("Translucent background requires an opaque backdrop.");
  const effective = back[3] === 1 ? back : composite(back, base!);
  return ratio(composite(front, effective), effective);
}
// Adjacent chart series occupy separate regions, not overlapping layers.
function adjacentRatio(
  first: string,
  second: string,
  backdrop: string,
): number {
  const base = parse(backdrop);
  return ratio(composite(parse(first), base), composite(parse(second), base));
}
export const meetsMinimum = (ratio: number, minimum: number): boolean =>
  ratio >= minimum;
export function coreValue(theme: Theme, path: string): string | number {
  let value: unknown = theme;
  for (const segment of path.split("."))
    value = (value as Record<string, unknown>)[segment];
  return value as string | number;
}
export function reportContrast(theme: Theme): ContrastPairReport[] {
  const reports: ContrastPairReport[] = [];
  const add = (
    foregroundPath: CoreColorPath,
    backgroundPath: CoreColorPath,
    backdropPath: CoreColorPath,
    minimum: number,
    policy: "required" | "advisory" = "required",
  ) => {
    const colors = [foregroundPath, backgroundPath, backdropPath].map(
      (path) => coreValue(theme, path) as string,
    );
    const value =
      policy === "advisory"
        ? adjacentRatio(colors[0]!, colors[1]!, colors[2]!)
        : contrastRatio(colors[0]!, colors[1]!, colors[2]!);
    reports.push({
      foregroundPath,
      backgroundPath,
      backdropPath,
      ratio: value,
      minimum,
      pass: meetsMinimum(value, minimum),
      policy,
      suggestion: `Increase foreground/background luminance separation: adjust ${foregroundPath} or ${backgroundPath} over ${backdropPath} to reach ${minimum}:1.`,
    });
  };
  const surfaces = [
    "color.surface.base",
    "color.surface.raised",
    "color.surface.sunken",
  ] as const;
  for (const text of ["primary", "secondary", "muted"] as const) {
    for (const surface of [...surfaces, "color.chart.tooltipBg"] as const)
      add(`color.text.${text}`, surface, surface, 4.5);
  }
  for (const accent of ["base", "hover"] as const)
    for (const surface of surfaces)
      add("color.text.onAccent", `color.accent.${accent}`, surface, 4.5);
  for (const surface of surfaces)
    add("color.text.primary", "color.accent.subtle", surface, 4.5);
  for (const status of ["positive", "negative", "warning", "info"] as const)
    for (const surface of surfaces.slice(0, 2))
      add(`color.status.${status}`, surface, surface, 4.5);
  for (const ui of [
    "color.border.strong",
    "color.border.focus",
    "color.accent.base",
  ] as const)
    add(ui, "color.surface.raised", "color.surface.raised", 3);
  for (let i = 0; i < 8; i++)
    add(
      `color.chart.series.${i}` as CoreColorPath,
      "color.surface.raised",
      "color.surface.raised",
      3,
    );
  add("color.chart.axis", "color.surface.raised", "color.surface.raised", 3);
  for (let i = 0; i < 7; i++)
    add(
      `color.chart.series.${i}` as CoreColorPath,
      `color.chart.series.${i + 1}` as CoreColorPath,
      "color.surface.raised",
      3,
      "advisory",
    );
  return reports;
}
