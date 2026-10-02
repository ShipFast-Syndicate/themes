import { diagnostic, freeze, ordered, pointer } from "./diagnostics.js";
import { decode } from "./json.js";
import { getDeclarations, groups, ownData } from "./extensions.js";
import { coreValue, hexPattern, reportContrast } from "./contrast.js";
import type {
  Diagnostic,
  ProductTokens,
  ProductTokenSpec,
  Theme,
  ValidatedTheme,
  ValidationResult,
} from "./types.js";

export function validateTheme<
  T extends ProductTokenSpec = Record<never, never>,
>(
  jsonText: string,
  options?: { mode?: "strict" | "advisory"; productTokens?: ProductTokens<T> },
): ValidationResult<T> {
  const errors: Diagnostic[] = [],
    warnings: Diagnostic[] = [];
  const failure = (): ValidationResult<T> => ({
    ok: false,
    theme: null,
    errors: ordered(errors),
    warnings: ordered(warnings),
    contrast: [],
  });
  const add = (code: string, path: string, message: string) => {
    if (errors.length < 64) errors.push(diagnostic(code, path, message));
    else
      errors[63] = diagnostic(
        "limit.exceeded",
        "",
        "Diagnostic limit of 64 exceeded.",
      );
  };
  let mode: "strict" | "advisory" = "strict",
    spec: ProductTokenSpec = {};
  try {
    if (options !== undefined) {
      const data = ownData(options);
      if (
        !data ||
        Object.keys(data).some(
          (key) => !["mode", "productTokens"].includes(key),
        ) ||
        (data.mode &&
          !["strict", "advisory"].includes(data.mode.value as string))
      ) {
        add("options.invalid", "", "Invalid validation options.");
        return failure();
      }
      if (data.mode) mode = data.mode.value as typeof mode;
      if (data.productTokens) {
        const declared = getDeclarations(data.productTokens.value);
        if (!declared) {
          add(
            "options.invalid",
            "",
            "Product tokens must be issued by defineProductTokens.",
          );
          return failure();
        }
        spec = declared;
      }
    }
  } catch {
    add("options.invalid", "", "Invalid validation options.");
    return failure();
  }
  const decoded = decode(jsonText);
  if (decoded.error) {
    errors.push(decoded.error);
    return failure();
  }
  const object = (
    value: unknown,
    keys: readonly string[],
    path: string,
    optional: readonly string[] = [],
  ): Record<string, unknown> | null => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      add("value.type", path, "Expected an object.");
      return null;
    }
    const data = value as Record<string, unknown>;
    for (const key of Object.keys(data))
      if (!keys.includes(key))
        add("keys.unknown", pointer(path, key), "Unsupported key.");
    for (const key of keys)
      if (!optional.includes(key) && !Object.hasOwn(data, key))
        add("value.type", pointer(path, key), "Required field is missing.");
    return data;
  };
  const text = (value: unknown, path: string): value is string => {
    if (typeof value !== "string") {
      add("value.type", path, "Expected a string.");
      return false;
    }
    return true;
  };
  const choice = (value: unknown, choices: readonly string[], path: string) => {
    if (text(value, path) && !choices.includes(value))
      add("value.format", path, "Unsupported value.");
  };
  const number = (value: unknown, min: number, max: number, path: string) => {
    if (typeof value !== "number")
      add("value.type", path, "Expected a number.");
    else if (!Number.isFinite(value) || value < min || value > max)
      add(
        "value.range",
        path,
        `Expected a finite number from ${min} to ${max}.`,
      );
  };
  const color = (
    data: Record<string, unknown> | unknown[],
    key: string,
    path: string,
    opaque = false,
  ) => {
    const value = (data as Record<string, unknown>)[key];
    if (!text(value, path)) return;
    if (!hexPattern.test(value)) {
      add("value.format", path, "Expected a six- or eight-digit hex colour.");
      return;
    }
    if (opaque && value.length === 9 && value.slice(7).toLowerCase() !== "ff")
      add("value.range", path, "Colour must be opaque.");
    (data as Record<string, unknown>)[key] = value.toLowerCase();
  };
  const root = object(
    decoded.value,
    [
      "schemaVersion",
      "id",
      "name",
      "mode",
      "color",
      "radius",
      "font",
      "density",
      "product",
    ],
    "",
    ["product"],
  );
  if (!root) return failure();
  if (root.schemaVersion !== 1)
    add(
      "version.unsupported",
      "/schemaVersion",
      "Only numeric schema version 1 is supported.",
    );
  if (text(root.id, "/id")) {
    if (root.id.length < 1 || root.id.length > 48)
      add("value.range", "/id", "Identifier must contain 1 to 48 characters.");
    else if (!/^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?(?![\s\S])/.test(root.id))
      add("value.format", "/id", "Invalid identifier.");
  }
  if (text(root.name, "/name")) {
    if ([...root.name].length < 1 || [...root.name].length > 60)
      add("value.range", "/name", "Name must contain 1 to 60 code points.");
    if (
      root.name.trim() !== root.name ||
      /[\u0000-\u001f\u007f-\u009f<>&"'\\]/u.test(root.name) ||
      /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(
        root.name,
      )
    )
      add("value.format", "/name", "Invalid display name.");
  }
  choice(root.mode, ["light", "dark"], "/mode");
  choice(root.density, ["compact", "comfortable", "spacious"], "/density");
  const colors = object(root.color, Object.keys(groups), "/color");
  if (colors)
    for (const [group, leaves] of Object.entries(groups)) {
      const path = pointer("/color", group);
      const data = object(
        colors[group],
        group === "chart" ? [...leaves, "series"] : leaves,
        path,
      );
      if (!data) continue;
      for (const key of leaves)
        color(
          data,
          key,
          pointer(path, key),
          (group === "surface" && key !== "overlay") ||
            (group === "chart" && key === "tooltipBg"),
        );
      if (group === "chart") {
        const series = data.series;
        if (!Array.isArray(series))
          add("value.type", `${path}/series`, "Expected an array.");
        else {
          if (series.length !== 8)
            add(
              "value.range",
              `${path}/series`,
              "Expected exactly eight series colours.",
            );
          for (let i = 0; i < series.length; i++)
            color(series, String(i), `${path}/series/${i}`);
        }
      }
    }
  const radius = object(root.radius, ["sm", "md", "lg", "pill"], "/radius");
  if (radius)
    for (const key of ["sm", "md", "lg", "pill"])
      number(
        radius[key],
        0,
        key === "pill" ? 999 : 64,
        pointer("/radius", key),
      );
  const font = object(root.font, ["body", "heading", "mono", "scale"], "/font");
  if (font) {
    for (const key of ["body", "heading"])
      choice(
        font[key],
        ["system-sans", "system-serif", "system-mono"],
        pointer("/font", key),
      );
    choice(font.mono, ["system-mono"], "/font/mono");
    number(font.scale, 0.75, 1.5, "/font/scale");
  }
  const product = Object.hasOwn(root, "product")
    ? object(root.product, Object.keys(spec), "/product", Object.keys(spec))
    : {};
  if (product)
    for (const [key, descriptor] of Object.entries(spec))
      if (Object.hasOwn(product, key)) {
        if (descriptor.type === "color")
          color(product, key, pointer("/product", key));
        else number(product[key], 0, 999, pointer("/product", key));
      }
  if (errors.length) return failure();
  // All core data is validated before deriving defaults; no extension chains.
  root.product = product!;
  for (const [key, descriptor] of Object.entries(spec))
    if (!Object.hasOwn(product!, key))
      product![key] = coreValue(
        root as unknown as Theme,
        descriptor.defaultFrom,
      );
  const contrast = reportContrast(root as unknown as Theme);
  for (const pair of contrast)
    if (!pair.pass) {
      const entry = diagnostic(
        "contrast.below",
        "/" + pair.foregroundPath.replaceAll(".", "/"),
        pair.suggestion,
      );
      if (pair.policy === "required" && mode === "strict") errors.push(entry);
      else warnings.push(entry);
    }
  // Structure has already succeeded; the contrast matrix is fixed at 48 entries.
  // Enforce a global diagnostic cap even if future matrix changes expand it.
  if (errors.length + warnings.length > 64) {
    errors.push(
      diagnostic("limit.exceeded", "", "Diagnostic limit of 64 exceeded."),
    );
    const retainedErrors = errors.slice(0, 63);
    errors.splice(
      0,
      errors.length,
      ...retainedErrors,
      diagnostic("limit.exceeded", "", "Diagnostic limit of 64 exceeded."),
    );
    warnings.splice(Math.max(0, 64 - errors.length));
  }
  return {
    ok: errors.length === 0,
    theme: errors.length
      ? null
      : (freeze(root) as unknown as ValidatedTheme<T>),
    errors: ordered(errors),
    warnings: ordered(warnings),
    contrast,
  };
}
