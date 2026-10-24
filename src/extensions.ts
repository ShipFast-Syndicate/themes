import { diagnostic, freeze, ordered, pointer, unsafe } from "./diagnostics.js";
import type {
  CoreColorPath,
  CoreLengthPath,
  Diagnostic,
  ProductTokens,
  ProductTokenSpec,
} from "./types.js";
export const groups = {
  surface: ["base", "raised", "sunken", "overlay"],
  text: ["primary", "secondary", "muted", "onAccent"],
  accent: ["base", "hover", "subtle"],
  border: ["subtle", "strong", "focus"],
  status: ["positive", "negative", "warning", "info"],
  chart: ["grid", "axis", "tooltipBg"],
} as const;
export const colorPaths = new Set<CoreColorPath>([
  ...Object.entries(groups).flatMap(([group, leaves]) =>
    leaves.map((leaf) => `color.${group}.${leaf}` as CoreColorPath),
  ),
  ...Array.from(
    { length: 8 },
    (_, i) => `color.chart.series.${i}` as CoreColorPath,
  ),
]);
const lengthPaths = new Set<CoreLengthPath>([
  "radius.sm",
  "radius.md",
  "radius.lg",
  "radius.pill",
]);
const declarations = new WeakMap<object, ProductTokenSpec>();

// Introspection never reads properties, including nested descriptor accessors.
// Proxies are unsupported programming inputs; their traps may run, but errors
// are caught. Ordinary objects with inherited/accessor/symbol fields reject.
export function ownData(
  value: unknown,
): Record<string, PropertyDescriptor> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return null;
  const entries = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(value).some((key) => typeof key !== "string"))
    return null;
  if (
    Object.values(entries).some(
      (entry) => !entry.enumerable || !("value" in entry),
    )
  )
    return null;
  return entries;
}
export function defineProductTokens<const T extends ProductTokenSpec>(
  spec: T,
):
  | { ok: true; tokens: ProductTokens<T> }
  | { ok: false; errors: Diagnostic[] } {
  const invalid = (path = "") => ({
    ok: false as const,
    errors: [
      diagnostic(
        "extension.invalid",
        path,
        "Invalid product-token declaration.",
      ),
    ],
  });
  try {
    const entries = ownData(spec);
    if (!entries || Object.keys(entries).length > 32) return invalid();
    const errors: Diagnostic[] = [];
    const clone: ProductTokenSpec = {};
    for (const key of Object.keys(entries).sort()) {
      const descriptor = ownData(entries[key]!.value);
      const path = pointer("", key);
      if (
        !/^[a-z][a-z0-9]{0,15}\.[a-z][a-zA-Z0-9]{0,31}(?![\s\S])/.test(key) ||
        key.split(".").some(unsafe) ||
        !descriptor ||
        Object.keys(descriptor).sort().join(",") !== "defaultFrom,type"
      ) {
        errors.push(...invalid(path).errors);
        continue;
      }
      const type: unknown = descriptor.type!.value,
        source: unknown = descriptor.defaultFrom!.value;
      if (
        typeof source !== "string" ||
        !(
          (type === "color" && colorPaths.has(source as CoreColorPath)) ||
          (type === "length" && lengthPaths.has(source as CoreLengthPath))
        )
      ) {
        errors.push(...invalid(path).errors);
        continue;
      }
      clone[key] = { type, defaultFrom: source } as ProductTokenSpec[string];
    }
    if (errors.length) return { ok: false, errors: ordered(errors) };
    const tokens = Object.freeze({}) as ProductTokens<T>;
    declarations.set(tokens, freeze(clone));
    return { ok: true, tokens };
  } catch {
    return invalid();
  }
}
export const getDeclarations = (
  tokens: unknown,
): ProductTokenSpec | undefined =>
  tokens && typeof tokens === "object" ? declarations.get(tokens) : undefined;
