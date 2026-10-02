import { diagnostic, pointer, unsafe } from "./diagnostics.js";
import type { Diagnostic } from "./types.js";

// A bounded lexical pass before JSON.parse: counts decoded keys/values and
// detects duplicates even when their source spellings use different escapes.
export function decode(input: unknown): {
  value?: unknown;
  error?: Diagnostic;
} {
  const fail = (code: string, path: string, message: string): never => {
    throw diagnostic(code, path, message);
  };
  if (typeof input !== "string")
    return { error: diagnostic("input.type", "", "Expected JSON text.") };
  // UTF-8 counting stops at the budget; no unbounded temporary byte buffer.
  let bytes = 0;
  for (const char of input) {
    const point = char.codePointAt(0)!;
    bytes += point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
    if (bytes > 16384)
      return {
        error: diagnostic(
          "size.exceeded",
          "",
          "JSON exceeds 16384 UTF-8 bytes.",
        ),
      };
  }
  let pos = 0,
    members = 0,
    values = 0;
  const syntax = (): never => fail("json.syntax", "", "Malformed JSON.");
  const whitespace = () => {
    while (/[\x20\t\r\n]/.test(input[pos] ?? "\0")) pos++;
  };
  const string = (path: string): string => {
    const start = pos++;
    while (pos < input.length) {
      const char = input[pos++];
      if (char === '"') {
        let decoded: string;
        try {
          decoded = JSON.parse(input.slice(start, pos)) as string;
        } catch {
          return syntax();
        }
        if ([...decoded].length > 128)
          fail(
            "string.exceeded",
            path,
            "Decoded string exceeds 128 code points.",
          );
        return decoded;
      }
      if (char === "\\") {
        const escape = input[pos++];
        if (escape === "u") {
          if (!/^[0-9a-fA-F]{4}$/.test(input.slice(pos, pos + 4))) syntax();
          pos += 4;
        } else if (!escape || !'"\\/bfnrt'.includes(escape)) syntax();
      } else if (char!.charCodeAt(0) < 32) syntax();
    }
    return syntax();
  };
  const value = (path: string, depth: number): void => {
    whitespace();
    if (++values > 512)
      fail("values.exceeded", path, "JSON exceeds 512 values.");
    const char = input[pos];
    if (char === "{" || char === "[") {
      if (depth > 6)
        fail("depth.exceeded", path, "JSON exceeds container depth 6.");
      const object = char === "{",
        end = object ? "}" : "]";
      const keys = new Set<string>();
      pos++;
      whitespace();
      if (input[pos] === end) {
        pos++;
        return;
      }
      let index = 0;
      while (true) {
        let child = pointer(path, String(index++));
        if (object) {
          if (input[pos] !== '"') syntax();
          const key = string(path);
          child = pointer(path, key);
          if (++members > 256)
            fail("members.exceeded", child, "JSON exceeds 256 object members.");
          if (unsafe(key))
            fail("keys.unsafe", child, "Prototype-related keys are forbidden.");
          if (keys.has(key))
            fail("json.duplicate", child, "Duplicate object key.");
          keys.add(key);
          whitespace();
          if (input[pos++] !== ":") syntax();
        }
        value(child, depth + 1);
        whitespace();
        if (input[pos] === end) {
          pos++;
          return;
        }
        if (input[pos++] !== ",") syntax();
        whitespace();
      }
    }
    if (char === '"') {
      string(path);
      return;
    }
    const token =
      /^(?:true|false|null|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)/.exec(
        input.slice(pos),
      );
    if (!token) syntax();
    pos += token![0].length;
    if (/^-?[0-9]/.test(token![0]) && !Number.isFinite(Number(token![0])))
      fail("value.range", path, "Number must be finite.");
  };
  try {
    value("", 1);
    whitespace();
    if (pos !== input.length) syntax();
    return { value: JSON.parse(input) as unknown };
  } catch (error) {
    return { error: error as Diagnostic };
  }
}
