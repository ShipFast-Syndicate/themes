import { ownData } from "./extensions.js";
import { registeredSpec } from "./provenance.js";
import type { ProductTokenSpec, ValidatedTheme } from "./types.js";

export type ThemeApplicationInput =
  | { preference: "fixed"; theme: ValidatedTheme<ProductTokenSpec> }
  | {
      preference: "system";
      light: ValidatedTheme<ProductTokenSpec>;
      dark: ValidatedTheme<ProductTokenSpec>;
      fallback: "light" | "dark";
    };

export type ThemeColorMeta = {
  readonly content: string;
  readonly media?: string;
};

const idPattern = /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?(?![\s\S])/;
const colorPattern = /^#[0-9a-f]{6}(?:ff)?(?![\s\S])/;
const shapes: Readonly<Record<string, readonly string[]>> = {
  fixed: ["preference", "theme"],
  system: ["preference", "light", "dark", "fallback"],
};

type Member = { id: string; base: string; mode: string };
type Checked =
  | { preference: "fixed"; theme: Member }
  | { preference: "system"; light: Member; dark: Member; fallback: string };

const invalid = () => new TypeError("invalid theme application input");

// Only themes registered by validateTheme pass; ids and colours are re-asserted
// against their grammars and never escaped or accepted from caller text.
function member(value: unknown): Member {
  if (!registeredSpec(value)) throw invalid();
  const theme = value as ValidatedTheme<ProductTokenSpec>;
  const id: unknown = theme.id,
    base: unknown = theme.color.surface.base,
    mode: unknown = theme.mode;
  if (
    typeof id !== "string" ||
    !idPattern.test(id) ||
    typeof base !== "string" ||
    !colorPattern.test(base) ||
    (mode !== "light" && mode !== "dark")
  )
    throw invalid();
  return { id, base, mode };
}

function check(input: unknown): Checked {
  try {
    const data = ownData(input);
    if (!data) throw invalid();
    const kind = data.preference?.value;
    const shape =
      typeof kind === "string" && Object.hasOwn(shapes, kind)
        ? shapes[kind]
        : undefined;
    if (
      !shape ||
      Object.keys(data).length !== shape.length ||
      shape.some((key) => !(key in data))
    )
      throw invalid();
    const value = (key: string): unknown => data[key]!.value;
    if (value("preference") === "fixed")
      return { preference: "fixed", theme: member(value("theme")) };
    const fallback = value("fallback");
    if (fallback !== "light" && fallback !== "dark") throw invalid();
    const light = member(value("light")),
      dark = member(value("dark"));
    if (light.mode !== "light" || dark.mode !== "dark" || light.id === dark.id)
      throw invalid();
    return { preference: "system", light, dark, fallback };
  } catch {
    throw invalid();
  }
}

/**
 * Returns the html attributes that apply an already-resolved validated theme
 * (or a light/dark pair with a required no-JS fallback) before first paint.
 */
export function themeHtmlAttributes(
  input: ThemeApplicationInput,
): Readonly<Record<string, string>> {
  const checked = check(input);
  if (checked.preference === "fixed")
    return Object.freeze({ "data-theme": checked.theme.id });
  return Object.freeze({
    "data-theme": checked[checked.fallback as "light" | "dark"].id,
    "data-theme-light": checked.light.id,
    "data-theme-dark": checked.dark.id,
  });
}

/** Returns data for theme-color meta tags, taken from color.surface.base. */
export function themeColorMetas(
  input: ThemeApplicationInput,
): readonly ThemeColorMeta[] {
  const checked = check(input);
  const entry = (content: string, media?: string) =>
    Object.freeze(media === undefined ? { content } : { content, media });
  return Object.freeze(
    checked.preference === "fixed"
      ? [entry(checked.theme.base)]
      : [
          entry(checked.light.base, "(prefers-color-scheme: light)"),
          entry(checked.dark.base, "(prefers-color-scheme: dark)"),
        ],
  );
}
