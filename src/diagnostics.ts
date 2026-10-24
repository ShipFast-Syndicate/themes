import type { Diagnostic } from "./types.js";
export const pointer = (base: string, key: string) =>
  `${base}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`;
export const diagnostic = (
  code: string,
  path: string,
  message: string,
): Diagnostic => ({ code, path, message });
export const unsafe = (key: string) =>
  ["__proto__", "prototype", "constructor"].includes(key);
export function ordered(items: Diagnostic[]): Diagnostic[] {
  return items.sort((a, b) =>
    a.path < b.path
      ? -1
      : a.path > b.path
        ? 1
        : a.code < b.code
          ? -1
          : a.code > b.code
            ? 1
            : 0,
  );
}
export function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
