import type { ProductTokenSpec } from "./types.js";

// Module-private record of themes returned by validateTheme. It is not
// re-exported from index.ts; separately loaded package copies do not share it.
const registered = new WeakMap<object, ProductTokenSpec>();

export const register = (theme: object, spec: ProductTokenSpec): void => {
  registered.set(theme, spec);
};
export const registeredSpec = (theme: unknown): ProductTokenSpec | undefined =>
  theme && typeof theme === "object" ? registered.get(theme) : undefined;
