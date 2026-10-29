import test from "node:test";
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as api from "../dist/index.js";
import { prefix } from "../dist/css.js";
import { coreNames } from "./css-names.mjs";
import { demoTokens, snapshotCases, validated } from "./css-cases.mjs";
import { theme, set, json } from "./fixtures.mjs";

const { defineProductTokens, serializeThemeCss, validateTheme } = api;
const P = (text) => text.replaceAll("<P>", prefix);
const names = (css) =>
  css
    .split("\n")
    .filter((line) => line.includes(": "))
    .map((line) => line.trim().split(": ")[0]);
const valueOf = (css, name) =>
  css
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.startsWith(name + ": "))
    ?.slice(name.length + 2, -1);

test("dark root snapshot: 39 declarations in documented order, deterministic", async () => {
  const dark = validated(theme("dark"));
  const css = serializeThemeCss(dark);
  const lines = css.split("\n");
  assert.equal(lines[0], ":root {");
  assert.equal(lines[1], "  color-scheme: dark;");
  assert.equal(lines.length, 39 + 3);
  assert.equal(lines.at(-2), "}");
  assert.equal(lines.at(-1), "");
  assert.deepEqual(names(css), coreNames.map(P));
  assert.equal(serializeThemeCss(dark), css);
  assert.equal(serializeThemeCss(dark, { form: "root" }), css);
  assert.equal(serializeThemeCss(dark, {}), css);
});

test("snapshots match for light/dark, all forms, with and without product tokens", async () => {
  for (const { file, css } of snapshotCases()) {
    const expected = await readFile(
      new URL(`snapshots/${file}`, import.meta.url),
      "utf8",
    );
    assert.equal(css(), P(expected), file);
  }
});

test("selector forms share one body; data-theme uses the validated id", () => {
  for (const mode of ["light", "dark"]) {
    const value = validated(theme(mode));
    const root = serializeThemeCss(value, { form: "root" });
    const scoped = serializeThemeCss(value, { form: "data-theme" });
    const bare = serializeThemeCss(value, { form: "declarations" });
    assert.ok(scoped.startsWith('[data-theme="test-theme"] {\n'));
    assert.ok(!/[{}]/.test(bare) && !bare.startsWith(" "));
    assert.ok(bare.endsWith(";\n"));
    const body = (css) =>
      css
        .split("\n")
        .slice(1, -2)
        .map((line) => line.slice(2))
        .join("\n") + "\n";
    assert.equal(body(root), bare);
    assert.equal(body(scoped), bare);
    assert.equal(valueOf(bare, "color-scheme"), mode);
  }
});

test("product tokens follow density-scale in code-unit order; omitted values equal core leaves", () => {
  const source = theme("dark");
  source.color.accent.subtle = "#12345678";
  source.radius.md = 6;
  const omitted = serializeThemeCss(validated(source, demoTokens()));
  source.product = { "demo.heroEnd": "#ABCDEF", "demo.gap": 12.5 };
  const explicit = serializeThemeCss(validated(source, demoTokens()));
  for (const [css, gap, hero] of [
    [omitted, "6px", "#12345678"],
    [explicit, "12.5px", "#abcdef"],
  ]) {
    const list = names(css);
    assert.deepEqual(list.slice(0, 39), coreNames.map(P));
    assert.deepEqual(list.slice(39), [
      `--${prefix}-ext-demo-gap`,
      `--${prefix}-ext-demo-hero-end`,
    ]);
    assert.equal(valueOf(css, `--${prefix}-ext-demo-gap`), gap);
    assert.equal(valueOf(css, `--${prefix}-ext-demo-hero-end`), hero);
  }
});

test("number formatting rounds to four decimals without exponent, -0 or trailing zeros", () => {
  const emit = (path, value, name) =>
    valueOf(
      serializeThemeCss(validated(set(theme(), path, value))),
      `--${prefix}-${name}`,
    );
  const cases = [
    ["radius.lg", 0, "0px"],
    ["radius.lg", 64, "64px"],
    ["radius.lg", 2.5, "2.5px"],
    ["radius.lg", 1.23456, "1.2346px"],
    ["radius.lg", 0.00001, "0px"],
    ["radius.lg", -0, "0px"],
    ["radius.pill", 999, "999px"],
    ["radius.pill", 1.00005, "1.0001px"],
    ["radius.pill", 0.00015, "0.0001px"],
    ["radius.sm", 4, "4px"],
  ];
  for (const [path, value, expected] of cases)
    assert.equal(
      emit(path, value, path.replace(".", "-")),
      expected,
      `${path}=${value}`,
    );
  for (const [value, expected] of [
    [0.75, "0.75"],
    [1, "1"],
    [1.125, "1.125"],
    [1.5, "1.5"],
  ])
    assert.equal(emit("font.scale", value, "font-scale"), expected);
});

test("font stacks and density scales are the documented constants", () => {
  const stacks = {
    "system-sans": "ui-sans-serif, system-ui, sans-serif",
    "system-serif": "ui-serif, serif",
    "system-mono": "ui-monospace, monospace",
  };
  for (const [id, stack] of Object.entries(stacks))
    for (const key of ["body", "heading"]) {
      const css = serializeThemeCss(validated(set(theme(), `font.${key}`, id)));
      assert.equal(valueOf(css, `--${prefix}-font-${key}`), stack);
      assert.equal(
        valueOf(css, `--${prefix}-font-mono`),
        stacks["system-mono"],
      );
    }
  for (const [density, scale] of [
    ["compact", "0.875"],
    ["comfortable", "1"],
    ["spacious", "1.125"],
  ])
    assert.equal(
      valueOf(
        serializeThemeCss(validated(set(theme(), "density", density))),
        `--${prefix}-density-scale`,
      ),
      scale,
    );
});

test("unvalidated themes and invalid options throw fixed TypeErrors", () => {
  const valid = validated(theme());
  const strictFailure = validateTheme(
    json(set(theme(), "color.text.primary", "#ffffff")),
  );
  assert.equal(strictFailure.ok, false);
  const themes = [
    json(theme()),
    JSON.parse(json(theme())),
    structuredClone(valid),
    { ...valid },
    new Proxy(valid, {}),
    null,
    undefined,
    strictFailure.theme,
  ];
  for (const input of themes)
    assert.throws(
      () => serializeThemeCss(input),
      (error) =>
        error instanceof TypeError &&
        error.message === "theme must be returned by validateTheme",
    );
  let invoked = false;
  const getter = {
    get form() {
      invoked = true;
      return "root";
    },
  };
  const options = [
    { form: "body" },
    { selector: ":root" },
    { form: "root", selector: ":root" },
    getter,
    Object.create({ form: "root" }),
    null,
    "root",
    [],
  ];
  for (const option of options)
    assert.throws(
      () => serializeThemeCss(valid, option),
      (error) =>
        error instanceof TypeError &&
        error.message === "invalid serialisation options",
    );
  assert.equal(invoked, false);
});

test("injection payloads in hand-built themes never reach output or errors", () => {
  const valid = validated(theme());
  const payload = structuredClone(valid);
  payload.color.surface.base = "red;}body{background:url(//x)}";
  payload.id = 'x"] , * {';
  for (const input of [
    payload,
    new Proxy(payload, {}),
    new Proxy(valid, {
      get: (target, key) => (key === "id" ? 'x"] , * {' : target[key]),
    }),
  ])
    for (const form of ["root", "data-theme", "declarations"])
      assert.throws(
        () => serializeThemeCss(input, { form }),
        (error) =>
          error instanceof TypeError &&
          !error.message.includes("url(") &&
          !error.message.includes('x"]'),
      );
});

test("advisory themes with contrast warnings serialise normally", () => {
  const result = validateTheme(
    json(set(theme(), "color.text.primary", "#ffffff")),
    { mode: "advisory" },
  );
  assert.equal(result.ok, true);
  assert.ok(result.warnings.some((entry) => entry.code === "contrast.below"));
  const css = serializeThemeCss(result.theme);
  assert.equal(valueOf(css, `--${prefix}-color-text-primary`), "#ffffff");
  assert.ok(!css.includes("contrast"));
});

test("serialising leaves the theme frozen and unchanged", () => {
  const value = validated(theme(), demoTokens());
  const before = json(value);
  serializeThemeCss(value);
  assert.equal(json(value), before);
  assert.equal(Object.isFrozen(value), true);
  assert.throws(() => {
    value.color.surface.base = "red";
  }, TypeError);
  assert.equal(json(value), before);
});

test("provenance stays private and is not shared across module copies", async (t) => {
  assert.deepEqual(Object.keys(api).sort(), [
    "contrastRatio",
    "defineProductTokens",
    "serializeThemeCss",
    "systemBootScript",
    "systemBootScriptCspSource",
    "themeColorMetas",
    "themeHtmlAttributes",
    "validateTheme",
  ]);
  // A query-string import would still share dist/provenance.js, so load a
  // physically separate copy of the built package.
  const directory = await mkdtemp(path.join(tmpdir(), "themes-copy-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await cp(new URL("../dist/", import.meta.url), directory, {
    recursive: true,
  });
  const copy = await import(
    pathToFileURL(path.join(directory, "index.js")).href
  );
  assert.notEqual(copy.serializeThemeCss, serializeThemeCss);
  const fromCopy = copy.validateTheme(json(theme())).theme;
  assert.throws(() => serializeThemeCss(fromCopy), TypeError);
  assert.throws(() => copy.serializeThemeCss(validated(theme())), TypeError);
  assert.equal(typeof copy.serializeThemeCss(fromCopy), "string");
});

test("name map equals the checked-in list and the documented table", async () => {
  assert.equal(coreNames.length, 39);
  assert.deepEqual(
    names(serializeThemeCss(validated(theme()))),
    coreNames.map(P),
  );
  const doc = await readFile(
    new URL("../docs/css-serialisation.md", import.meta.url),
    "utf8",
  );
  const documented = [...doc.matchAll(/^\| \d+ \| `([^`]+)` \|/gm)].map(
    (match) => match[1],
  );
  assert.deepEqual(documented, coreNames);
});

// Deterministic PRNG so failures are reproducible from the printed seed.
function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("seeded property test: every emitted line matches its value class", () => {
  const seed = 20261024;
  const random = mulberry32(seed);
  const pick = (list) => list[Math.floor(random() * list.length)];
  const hex = (alpha) =>
    "#" +
    Array.from({ length: alpha ? 8 : 6 }, () =>
      pick([..."0123456789abcdefABCDEF"]),
    ).join("");
  const length = (max) =>
    pick([0, 64, max, random() * max, Math.round(random() * max * 1e7) / 1e7]);
  const colorPaths = coreNames
    .filter((name) => name.startsWith("--<P>-color-"))
    .map((name) => name.slice(6));
  const stacks = new Set([
    "ui-sans-serif, system-ui, sans-serif",
    "ui-serif, serif",
    "ui-monospace, monospace",
  ]);
  const classes = {
    scheme: /^(light|dark)$/,
    color: /^#[0-9a-f]{6}([0-9a-f]{2})?$/,
    length: /^\d{1,3}(\.\d{1,4})?px$/,
    scale: /^\d(\.\d{1,4})?$/,
  };
  for (let iteration = 0; iteration < 2000; iteration++) {
    const source = theme(pick(["light", "dark"]));
    const walk = (object) => {
      for (const key of Object.keys(object))
        if (typeof object[key] === "object") walk(object[key]);
        else
          object[key] = hex(
            random() < 0.3 &&
              !(
                key === "base" ||
                key === "raised" ||
                key === "sunken" ||
                key === "tooltipBg"
              ),
          );
    };
    walk(source.color);
    for (const key of ["sm", "md", "lg"]) source.radius[key] = length(64);
    source.radius.pill = length(999);
    source.font = {
      body: pick(["system-sans", "system-serif", "system-mono"]),
      heading: pick(["system-sans", "system-serif", "system-mono"]),
      mono: "system-mono",
      scale: pick([0.75, 1.5, 1, 0.75 + random() * 0.75]),
    };
    source.density = pick(["compact", "comfortable", "spacious"]);
    const spec = {};
    const kinds = {};
    for (let i = Math.floor(random() * 6); i > 0; i--) {
      const key = `${pick(["demo", "app", "x9"])}.${pick(["a", "heroEnd", "gapX2", "zz"])}${i}`;
      const type = pick(["color", "length"]);
      spec[key] = {
        type,
        defaultFrom: type === "color" ? "color.accent.base" : "radius.md",
      };
      kinds[
        `--<P>-ext-${key.replace(".", "-").replace(/[A-Z]/g, (c) => "-" + c.toLowerCase())}`
      ] = type;
    }
    const declared = defineProductTokens(spec);
    assert.equal(declared.ok, true);
    source.product = {};
    for (const [key, { type }] of Object.entries(spec))
      if (random() < 0.5)
        source.product[key] =
          type === "color" ? hex(random() < 0.5) : length(999);
    const result = validateTheme(json(source), {
      mode: "advisory",
      productTokens: declared.tokens,
    });
    assert.equal(result.ok, true, `seed ${seed} iteration ${iteration}`);
    const css = serializeThemeCss(result.theme, {
      form: pick(["root", "data-theme", "declarations"]),
    });
    const context = `seed ${seed} iteration ${iteration}: ${css}`;
    assert.ok(!/[<>\\@!]|\/\*|url\(/.test(css), context);
    assert.ok((css.match(/\{/g) ?? []).length <= 1, context);
    const lines = css.split("\n").filter((line) => line.includes(": "));
    assert.equal(new Set(names(css)).size, lines.length, context);
    for (const line of lines) {
      const match = /^ {0,2}([a-z0-9-]+): ([^;]+);$/.exec(line);
      assert.ok(match, context);
      const name = match[1].replace(`--${prefix}-`, "--<P>-");
      const value = match[2];
      const kind =
        name === "color-scheme"
          ? "scheme"
          : name in kinds
            ? kinds[name]
            : colorPaths.some((path) => name === `--<P>-${path}`)
              ? "color"
              : name.startsWith("--<P>-radius-")
                ? "length"
                : name.endsWith("-scale")
                  ? "scale"
                  : "stack";
      if (kind === "stack") assert.ok(stacks.has(value), context);
      else assert.match(value, classes[kind], context);
    }
  }
});
