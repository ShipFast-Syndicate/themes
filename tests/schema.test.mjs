import test from "node:test";
import assert from "node:assert/strict";
import { defineProductTokens, validateTheme } from "../dist/index.js";
import { theme, set, json } from "./fixtures.mjs";

function rejected(input, code, path, options) {
  const result = validateTheme(input, options);
  assert.equal(result.ok, false);
  assert.equal(result.theme, null);
  assert.deepEqual(result.contrast, []);
  assert.ok(
    result.errors.some(
      (error) =>
        error.code === code && (path === undefined || error.path === path),
    ),
    json(result.errors),
  );
  return result;
}
function checkField(path, value, code = "value.format") {
  for (const mode of ["strict", "advisory"])
    rejected(
      json(set(theme(), path, value)),
      code,
      "/" + path.replaceAll(".", "/"),
      { mode },
    );
}

test("opaque light/dark fixtures normalize, clone and freeze; adjacency warnings do not block", () => {
  for (const mode of ["light", "dark"]) {
    const source = theme(mode);
    source.product = {};
    const before = json(source);
    const result = validateTheme(before);
    assert.equal(result.ok, true);
    assert.equal(result.errors.length, 0);
    assert.equal(result.contrast.length, 48);
    assert.equal(
      result.contrast.filter((pair) => pair.policy === "required").length,
      41,
    );
    assert.equal(result.warnings.length, 7);
    assert.equal(json(source), before);
    assert.equal(
      result.theme.color.surface.base,
      mode === "light" ? "#ffffff" : "#000000",
    );
    assert.deepEqual(result.theme.product, {});
    for (const object of [
      result.theme,
      result.theme.color,
      result.theme.color.chart.series,
      result.theme.product,
    ])
      assert.equal(Object.isFrozen(object), true);
    assert.throws(() => {
      result.theme.color.text.primary = "#aaaaaa";
    }, TypeError);
    assert.equal(validateTheme(json(theme(mode))).ok, true);
  }
});

test("exact schema, version, modes and required leaves", () => {
  for (const version of [0, 2, "1", null, true, 1.1])
    checkField("schemaVersion", version, "version.unsupported");
  checkField("mode", "system");
  for (const input of ["null", "[]", '"text"', "1", "true"])
    rejected(input, "value.type", "");
  const missingMode = theme();
  delete missingMode.mode;
  rejected(json(missingMode), "value.type", "/mode");
  for (const path of [
    "extends",
    "color.text.unknown",
    "font.url",
    "radius.x",
    "color.other",
  ])
    checkField(path, "bad", "keys.unknown");
  const missing = theme();
  delete missing.color.text.primary;
  rejected(json(missing), "value.type", "/color/text/primary");
  checkField("color.text", [], "value.type");
  checkField("product", null, "value.type");
});

test("ID and Unicode name boundaries, display-only safety", () => {
  for (const id of ["a", "0", "a".repeat(48), "a-b"])
    assert.equal(validateTheme(json(set(theme(), "id", id))).ok, true);
  for (const id of ["", "a".repeat(49)]) checkField("id", id, "value.range");
  for (const id of ["-a", "a-", "A", "a_b", "é"]) checkField("id", id);
  for (const name of ["x", "😀".repeat(60), "日本語", "a b"])
    assert.equal(validateTheme(json(set(theme(), "name", name))).ok, true);
  for (const name of ["", "😀".repeat(61)])
    checkField("name", name, "value.range");
  for (const name of [
    " a",
    "a ",
    "a\n",
    "\u007f",
    "\u0085",
    "\ud800",
    "\udc00",
    "<a>",
    "a&b",
    'a"b',
    "a'b",
    "a\\b",
  ])
    checkField("name", name);
});

test("only 6/8 hex accepted; opacity is explicit and no injected value is echoed", () => {
  const paths = [
    "color.text.primary",
    "color.surface.base",
    "color.accent.hover",
    "color.border.focus",
    "color.status.info",
    "color.chart.series.0",
  ];
  for (const value of [
    "#fff",
    "#ffff",
    "#12345g",
    "rgb(0,0,0)",
    "hsl(0,0%,0%)",
    "black",
    "var(--x)",
    "calc(1)",
    "url(https://example.test/secret)",
    "@import secret",
    "#000000/*secret*/",
    "#000000;secret",
    "{secret}",
    "<script>secret</script>",
    "https://secret.test/font",
  ]) {
    for (const path of paths) {
      const result = rejected(
        json(set(theme(), path, value)),
        "value.format",
        "/" + path.replaceAll(".", "/"),
        { mode: "advisory" },
      );
      assert.ok(!json(result).includes(value));
    }
  }
  assert.equal(
    validateTheme(json(set(theme(), "color.text.primary", "#000000FF"))).theme
      .color.text.primary,
    "#000000ff",
  );
  for (const path of [
    "color.surface.base",
    "color.surface.raised",
    "color.surface.sunken",
    "color.chart.tooltipBg",
  ])
    checkField(path, "#fffffffe", "value.range");
});

test("inclusive numeric/font/density limits, no coercion and exact series size", () => {
  for (const path of ["radius.sm", "radius.md", "radius.lg"]) {
    for (const value of [0, 64])
      assert.equal(validateTheme(json(set(theme(), path, value))).ok, true);
    for (const value of [-0.01, 64.01]) checkField(path, value, "value.range");
  }
  for (const value of [0, 999])
    assert.equal(
      validateTheme(json(set(theme(), "radius.pill", value))).ok,
      true,
    );
  for (const value of [-1, 999.01])
    checkField("radius.pill", value, "value.range");
  for (const value of [0.75, 1.5])
    assert.equal(
      validateTheme(json(set(theme(), "font.scale", value))).ok,
      true,
    );
  for (const value of [0.749, 1.501, -1])
    checkField("font.scale", value, "value.range");
  for (const value of ["1", null, {}, []])
    checkField("font.scale", value, "value.type");
  checkField("font.body", "remote-font");
  checkField("font.mono", "system-sans");
  checkField("density", "dense");
  for (const density of ["compact", "comfortable", "spacious"])
    assert.equal(
      validateTheme(json(set(theme(), "density", density))).ok,
      true,
    );
  for (const count of [7, 9])
    checkField(
      "color.chart.series",
      Array(count).fill("#000000"),
      "value.range",
    );
  checkField("color.chart.series", {}, "value.type");
  rejected(
    json(theme()).replace('"scale":1', '"scale":1e400'),
    "value.range",
    "/font/scale",
  );
  for (const literal of ["NaN", "Infinity", "-Infinity"])
    rejected(
      json(theme()).replace('"scale":1', `"scale":${literal}`),
      "json.syntax",
    );
});

test("typed declarations derive validated core and accept partial explicit overrides", () => {
  const spec = {
    "demo.heroEnd": { type: "color", defaultFrom: "color.accent.subtle" },
    "demo.gap": { type: "length", defaultFrom: "radius.md" },
  };
  const definition = defineProductTokens(spec);
  assert.equal(definition.ok, true);
  spec["demo.gap"].defaultFrom = "radius.pill";
  const options = { productTokens: definition.tokens };
  assert.equal(Object.isFrozen(definition.tokens), true);
  for (const product of [
    undefined,
    {},
    { "demo.heroEnd": "#ABCDEF" },
    { "demo.gap": 0 },
  ]) {
    const source = theme();
    if (product !== undefined) source.product = product;
    const result = validateTheme(json(source), options);
    assert.equal(result.ok, true);
    assert.equal(
      result.theme.product["demo.heroEnd"],
      product?.["demo.heroEnd"] ? "#abcdef" : "#00000000",
    );
    assert.equal(result.theme.product["demo.gap"], product?.["demo.gap"] ?? 8);
  }
  for (const value of [0, 999])
    assert.equal(
      validateTheme(
        json({ ...theme(), product: { "demo.gap": value } }),
        options,
      ).ok,
      true,
    );
  for (const value of [-1, 1000])
    rejected(
      json({ ...theme(), product: { "demo.gap": value } }),
      "value.range",
      "/product/demo.gap",
      options,
    );
  rejected(
    json({ ...theme(), product: { "demo.heroEnd": "url(secret)" } }),
    "value.format",
    "/product/demo.heroEnd",
    options,
  );
  rejected(
    json({ ...theme(), product: { "unknown.gap": 1 } }),
    "keys.unknown",
    "/product/unknown.gap",
    options,
  );
  rejected(
    json({ ...theme(), product: { "demo.gap": 1 } }),
    "keys.unknown",
    "/product/demo.gap",
  );
  const series = defineProductTokens({
    "demo.series": { type: "color", defaultFrom: "color.chart.series.7" },
  });
  assert.equal(
    validateTheme(json(theme()), { productTokens: series.tokens }).theme
      .product["demo.series"],
    "#000000",
  );
});

test("declarations reject wrong references, names, cycles, accessors, symbols, inheritance and too many keys", () => {
  const valid = { type: "color", defaultFrom: "color.text.primary" };
  for (const spec of [
    null,
    [],
    { "demo.x": { type: "color", defaultFrom: "radius.md" } },
    { "demo.x": { type: "length", defaultFrom: "product.demo.y" } },
    { "demo.x": { type: "color", defaultFrom: "#ffffff" } },
    { "demo.x": { ...valid, extra: 1 } },
    { bad: valid },
    { "constructor.x": valid },
    { "demo.prototype": valid },
    { "demo.x": { type: "color", defaultFrom: "color.chart.series.8" } },
    Object.fromEntries(
      Array.from({ length: 33 }, (_, i) => [`demo.x${i}`, valid]),
    ),
    Object.create({ "demo.inherited": valid }),
    { "demo.x": Object.create(valid) },
    { [Symbol("field")]: valid },
    { "demo.x": { ...valid, [Symbol("field")]: 1 } },
  ]) {
    assert.equal(defineProductTokens(spec).ok, false);
  }
  const cyclic = {};
  cyclic["demo.x"] = cyclic;
  assert.equal(defineProductTokens(cyclic).ok, false);
  let calls = 0;
  const outer = Object.defineProperty({}, "demo.x", {
    enumerable: true,
    get() {
      calls++;
      return valid;
    },
  });
  const inner = {
    type: "color",
    get defaultFrom() {
      calls++;
      return "color.text.primary";
    },
  };
  const typeGetter = {
    get type() {
      calls++;
      return "color";
    },
    defaultFrom: "color.text.primary",
  };
  for (const spec of [outer, { "demo.x": inner }, { "demo.x": typeGetter }])
    assert.equal(defineProductTokens(spec).ok, false);
  assert.equal(calls, 0);
  assert.equal(defineProductTokens(Object.create(null)).ok, true);
  const nullDescriptor = Object.assign(Object.create(null), valid);
  assert.equal(defineProductTokens({ "demo.x": nullDescriptor }).ok, true);
  assert.equal(
    defineProductTokens(Object.defineProperty({}, "demo.x", { value: valid }))
      .ok,
    false,
  );
  const proxy = new Proxy(
    {},
    {
      ownKeys() {
        throw Error("caller trap");
      },
    },
  );
  assert.equal(defineProductTokens(proxy).ok, false);
});

test("invalid options and counterfeit declarations never enable advisory acceptance", () => {
  for (const options of [
    { mode: "other" },
    { mode: undefined },
    { productTokens: {} },
    { productTokens: undefined },
    { unexpected: true },
    null,
    [],
    {
      get mode() {
        throw Error("must not read");
      },
    },
  ])
    rejected(json(theme()), "options.invalid", "", options);
  assert.equal(validateTheme(json(theme()), {}).ok, true);
});

test("malformed-input generator seed 0x5eed: 1000 bounded CSS/structural regressions in both modes", () => {
  let seed = 0x5eed;
  const next = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed;
  };
  const paths = [
    "color.text.primary",
    "color.accent.base",
    "color.chart.series.3",
    "font.body",
    "radius.md",
  ];
  const values = [
    "url(secret)",
    "var(--secret)",
    "#ffff",
    {},
    [],
    null,
    "calc(secret)",
    "<secret>",
  ];
  for (let i = 0; i < 1000; i++) {
    const path = paths[next() % paths.length];
    const value = values[next() % values.length];
    const result = validateTheme(json(set(theme(), path, value)), {
      mode: i % 2 ? "strict" : "advisory",
    });
    assert.equal(result.ok, false, `case ${i}`);
    assert.equal(result.theme, null);
    assert.deepEqual(result.contrast, []);
    assert.ok(!json(result.errors).includes("secret"));
  }
});

test("structural diagnostics are deterministic, lexical and capped at 64", () => {
  const input = json(
    Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`x${i}`, null])),
  );
  const a = validateTheme(input),
    b = validateTheme(input);
  assert.deepEqual(a, b);
  assert.equal(a.errors.length, 64);
  assert.ok(a.errors.some((error) => error.code === "limit.exceeded"));
  assert.deepEqual(
    a.errors,
    [...a.errors].sort((a, b) =>
      a.path < b.path
        ? -1
        : a.path > b.path
          ? 1
          : a.code < b.code
            ? -1
            : a.code > b.code
              ? 1
              : 0,
    ),
  );
});

test("exact allowlists reject terminal line breaks (JavaScript dollar-anchor regression)", () => {
  for (const suffix of ["\n", "\r", "\r\n", "\u2028", "\u2029"]) {
    checkField("id", "a" + suffix);
    checkField("color.text.primary", "#000000" + suffix);
    assert.equal(
      defineProductTokens({
        ["demo.x" + suffix]: {
          type: "color",
          defaultFrom: "color.text.primary",
        },
      }).ok,
      false,
    );
  }
});
