import test from "node:test";
import assert from "node:assert/strict";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as api from "../dist/index.js";
import { validateTheme } from "../dist/index.js";
import { demoTokens, validated } from "./css-cases.mjs";
import { theme, set, json } from "./fixtures.mjs";

const { themeHtmlAttributes, themeColorMetas } = api;
const MESSAGE = "invalid theme application input";
const light = () => validated(set(theme("light"), "id", "demo-light"));
const dark = () => validated(set(theme("dark"), "id", "demo-dark"));
const system = (fallback = "dark") => ({
  preference: "system",
  light: light(),
  dark: dark(),
  fallback,
});
const rejects = (input) => {
  for (const fn of [themeHtmlAttributes, themeColorMetas])
    assert.throws(
      () => fn(input),
      (error) => error instanceof TypeError && error.message === MESSAGE,
    );
};

test("fixed mode returns only data-theme with the validated id", () => {
  for (const value of [light(), dark()]) {
    const attrs = themeHtmlAttributes({ preference: "fixed", theme: value });
    assert.deepEqual(attrs, { "data-theme": value.id });
    assert.equal(Object.keys(attrs).length, 1);
    assert.ok(Object.isFrozen(attrs));
  }
  const input = { preference: "fixed", theme: light() };
  assert.deepEqual(themeHtmlAttributes(input), themeHtmlAttributes(input));
});

test("system mode names both members and uses the fallback id", () => {
  const dk = themeHtmlAttributes(system("dark"));
  assert.deepEqual(dk, {
    "data-theme": "demo-dark",
    "data-theme-light": "demo-light",
    "data-theme-dark": "demo-dark",
  });
  assert.deepEqual(Object.keys(dk), [
    "data-theme",
    "data-theme-light",
    "data-theme-dark",
  ]);
  const lt = themeHtmlAttributes(system("light"));
  assert.equal(lt["data-theme"], "demo-light");
  assert.equal(lt["data-theme-light"], "demo-light");
  assert.equal(lt["data-theme-dark"], "demo-dark");
  assert.ok(Object.isFrozen(lt));
});

test("theme-color uses surface.base, unchanged, as frozen data", () => {
  const fixed = themeColorMetas({ preference: "fixed", theme: light() });
  assert.deepEqual(fixed, [{ content: "#ffffff" }]);
  assert.ok(!("media" in fixed[0]));
  const pair = themeColorMetas(system());
  assert.deepEqual(pair, [
    { content: "#ffffff", media: "(prefers-color-scheme: light)" },
    { content: "#000000", media: "(prefers-color-scheme: dark)" },
  ]);
  assert.ok(Object.isFrozen(pair) && pair.every(Object.isFrozen));
  assert.deepEqual(themeColorMetas(system("light")), pair);
  const alpha = validated(
    set(set(theme("dark"), "id", "demo-dark"), "color.surface.base", "#112233FF"),
    undefined,
  );
  assert.equal(
    themeColorMetas({ preference: "fixed", theme: alpha })[0].content,
    "#112233ff",
  );
  const raised = validated(
    set(set(theme("light"), "color.surface.raised", "#fafafa"), "id", "r"),
  );
  assert.equal(
    themeColorMetas({ preference: "fixed", theme: raised })[0].content,
    "#ffffff",
  );
});

test("product-token themes and advisory themes are accepted", () => {
  const withProduct = validated(theme("light"), demoTokens());
  assert.deepEqual(
    themeHtmlAttributes({ preference: "fixed", theme: withProduct }),
    { "data-theme": "test-theme" },
  );
  const advisory = validateTheme(json(set(theme("dark"), "id", "adv-dark")), {
    mode: "advisory",
  });
  assert.ok(advisory.theme);
  assert.equal(
    themeHtmlAttributes({
      preference: "system",
      light: light(),
      dark: advisory.theme,
      fallback: "light",
    })["data-theme-dark"],
    "adv-dark",
  );
});

test("rejects every non-validated and malformed input with one fixed message", () => {
  const good = light();
  const failed = validateTheme("{}");
  const getter = {};
  Object.defineProperty(getter, "preference", { get: () => "fixed", enumerable: true });
  Object.defineProperty(getter, "theme", { value: good, enumerable: true });
  const inputs = [
    json(theme("light")),
    JSON.parse(json(theme("light"))),
    null,
    undefined,
    [],
    getter,
    new (class {
      preference = "fixed";
      theme = good;
    })(),
    { preference: "fixed", theme: json(theme("light")) },
    { preference: "fixed", theme: JSON.parse(json(theme("light"))) },
    { preference: "fixed", theme: structuredClone(good) },
    { preference: "fixed", theme: { ...good } },
    { preference: "fixed", theme: new Proxy(good, {}) },
    { preference: "fixed", theme: failed.theme },
    { preference: "fixed", theme: null },
    { preference: "fixed" },
    { preference: "fixed", theme: good, extra: 1 },
    { preference: "fixed", theme: good, light: good },
    { preference: "light", theme: good },
    { preference: "constructor", theme: good },
    { preference: "system", light: good, dark: dark() },
    { ...system(), fallback: "auto" },
    { ...system(), fallback: undefined },
    { ...system(), theme: good },
    { ...system(), light: dark(), dark: light() },
    { ...system(), light: dark() },
    { ...system(), dark: light() },
    {
      ...system(),
      light: validated(set(theme("light"), "id", "same-id")),
      dark: validated(set(theme("dark"), "id", "same-id")),
    },
    { ...system(), light: { ...light() } },
    { ...system(), dark: new Proxy(dark(), {}) },
  ];
  for (const input of inputs) rejects(input);
});

test("hand-built objects with hostile ids and colours never reach output", () => {
  const evil = {
    ...JSON.parse(json(theme("light"))),
    id: 'x" onload="alert(1)',
  };
  evil.color.surface.base = '#000"><script>';
  const withField = (field) => {
    const clone = structuredClone(light());
    if (field === "id") clone.id = evil.id;
    else clone.color.surface.base = evil.color.surface.base;
    return clone;
  };
  for (const field of ["id", "base"]) {
    rejects({ preference: "fixed", theme: evil });
    rejects({ preference: "fixed", theme: new Proxy(evil, {}) });
    rejects({ preference: "fixed", theme: withField(field) });
    rejects({ ...system(), light: withField(field) });
    rejects({ ...system(), dark: withField(field) });
  }
});

function prng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("output grammar fuzz: 500 seeded iterations", () => {
  const seed = 20261029;
  const rand = prng(seed);
  const pick = (chars, n) =>
    Array.from({ length: n }, () => chars[Math.floor(rand() * chars.length)]).join("");
  const alnum = "abcdefghijklmnopqrstuvwxyz0123456789";
  const mkId = () => {
    const length = 1 + Math.floor(rand() * 48);
    if (length === 1) return pick(alnum, 1);
    return pick(alnum, 1) + pick(alnum + "-", length - 2) + pick(alnum, 1);
  };
  const mkBase = () =>
    "#" + pick("0123456789abcdef", 6) + (rand() < 0.5 ? "ff" : "");
  const make = (mode) => {
    const id = mkId(),
      base = mkBase();
    const value = set(set(theme(mode), "id", id), "color.surface.base", base);
    const result = validateTheme(json(value), { mode: "advisory" });
    assert.ok(result.theme, `seed ${seed}: ${base}`);
    return { value: result.theme, id, base };
  };
  const idGrammar = /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/;
  const colorGrammar = /^#[0-9a-f]{6}(ff)?$/;
  const medias = [
    "(prefers-color-scheme: light)",
    "(prefers-color-scheme: dark)",
  ];
  for (let i = 0; i < 500; i++) {
    const l = make("light"),
      d = make("dark");
    if (l.id === d.id) continue;
    const inputs = [
      { preference: "fixed", theme: l.value },
      { preference: "fixed", theme: d.value },
      { preference: "system", light: l.value, dark: d.value, fallback: "light" },
      { preference: "system", light: l.value, dark: d.value, fallback: "dark" },
    ];
    for (const input of inputs) {
      const where = `seed ${seed} iteration ${i}`;
      for (const [name, value] of Object.entries(themeHtmlAttributes(input))) {
        assert.match(name, /^data-theme(-light|-dark)?$/, where);
        assert.match(value, idGrammar, where);
        assert.ok([l.id, d.id].includes(value), where);
      }
      for (const meta of themeColorMetas(input)) {
        assert.match(meta.content, colorGrammar, where);
        assert.ok(meta.media === undefined || medias.includes(meta.media), where);
        assert.ok([l.base, d.base].includes(meta.content), where);
      }
    }
  }
});

test("a separately loaded copy rejects themes validated by this copy", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "themes-apply-"));
  try {
    await cp(new URL("../dist", import.meta.url), path.join(dir, "dist"), {
      recursive: true,
    });
    const other = await import(pathToFileURL(path.join(dir, "dist/index.js")).href);
    assert.throws(
      () => other.themeHtmlAttributes({ preference: "fixed", theme: light() }),
      TypeError,
    );
    assert.throws(
      () => other.themeColorMetas({ preference: "fixed", theme: light() }),
      TypeError,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
