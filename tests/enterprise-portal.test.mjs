import test from "node:test";
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import * as portal from "../dist/enterprise-portal.js";
import { validateTheme, serializeThemeCss } from "../dist/index.js";
import { prefix } from "../dist/css.js";
import { validated } from "./css-cases.mjs";
import { theme, json } from "./fixtures.mjs";
import {
  klarHost,
  portalSnapshot,
  portalSnapshotFile,
} from "./enterprise-portal-cases.mjs";

const { portalAliasDeclarations } = portal;
const THEME_ERROR = "theme must be returned by validateTheme";
const HOST_ERROR = "invalid portal host values";
const light = () => validated(theme("light"));
const dark = () => validated(theme("dark"));
const call = (overrides = {}) =>
  portalAliasDeclarations(light(), { ...klarHost(), ...overrides });
const rejectsHost = (host) =>
  assert.throws(
    () => portalAliasDeclarations(light(), host),
    (error) => error instanceof TypeError && error.message === HOST_ERROR,
  );
const rejectsTheme = (value) =>
  assert.throws(
    () => portalAliasDeclarations(value, klarHost()),
    (error) => error instanceof TypeError && error.message === THEME_ERROR,
  );
const lines = (css) => css.split("\n").slice(0, -1);
const fixture = JSON.parse(
  await readFile(
    new URL("fixtures/enterprise-portal-tokens.json", import.meta.url),
    "utf8",
  ),
);
const namesOf = (css) => lines(css).map((line) => line.split(": ")[0]);
const LINE = /^--ab-[a-z0-9-]+: [^;{}\n\r\\"'<>@!*\u2028\u2029\u0000]+;$/;

test("module exports exactly portalAliasDeclarations", () => {
  assert.deepEqual(Object.keys(portal), ["portalAliasDeclarations"]);
});

test("full output for light and dark equals the snapshot, byte for byte", async () => {
  const expected = (
    await readFile(
      new URL(`snapshots/${portalSnapshotFile}`, import.meta.url),
      "utf8",
    )
  ).replaceAll("<P>", prefix);
  const first = portalSnapshot("light");
  assert.equal(first, expected);
  assert.equal(portalSnapshot("dark"), expected);
  assert.equal(lines(first).length, 18);
  assert.ok(first.endsWith(";\n") && !first.includes("\r"));
  assert.ok(!/[{}]/.test(first));
});

test("contract: names equal the vendored enterprise list, in order", () => {
  assert.equal(fixture.version, "1.1.3");
  assert.equal(fixture.tag, "v1.1.3");
  assert.equal(fixture.commit, "d48fc6301c3e59482aba9e94bf0aec24fb14bd60");
  assert.match(fixture.fileSha256, /^[0-9a-f]{64}$/);
  assert.equal(fixture.names.length, 18);
  const sameNames = (list) =>
    list.length === namesOf(call()).length &&
    list.every((name, i) => name === namesOf(call())[i]);
  assert.ok(sameNames(fixture.names));
  // Negative cases on modified copies: the comparison must fail.
  assert.ok(!sameNames(fixture.names.map((n) => n.replace("--ab-radius", "--ab-rad"))));
  assert.ok(!sameNames(fixture.names.slice(1)));
  assert.ok(!sameNames([...fixture.names].reverse()));
});

test("contract: every var() name exists in the serialiser output; one border reference", () => {
  for (const mode of ["light", "dark"]) {
    const value = validated(theme(mode));
    const serialised = new Set(
      serializeThemeCss(value, { form: "declarations" })
        .split("\n")
        .filter(Boolean)
        .map((line) => line.split(": ")[0]),
    );
    const css = portalAliasDeclarations(value, klarHost());
    const referenced = [...css.matchAll(/var\((--[a-z0-9-]+)\)/g)].map((m) => m[1]);
    assert.ok(referenced.length >= 11);
    for (const name of referenced) {
      assert.ok(name.startsWith(`--${prefix}-`), name);
      assert.ok(serialised.has(name), `dangling reference ${name}`);
    }
  }
  const css = call();
  const value = (name) =>
    lines(css).find((line) => line.startsWith(name + ": ")).slice(name.length + 2, -1);
  const reference = value("--ab-color-border");
  assert.equal(reference, `var(--${prefix}-color-border-strong)`);
  assert.ok(value("--ab-border").endsWith(" " + reference));
  assert.equal(value("--ab-border"), "1px solid " + reference);
  assert.ok(!css.includes("border-subtle") && !css.includes(`--${prefix}-color-text-muted`));
});

test("source: the adapter module hard-codes no prefix literal and uses no template literal", async () => {
  const text = await readFile(
    new URL("../src/enterprise-portal.ts", import.meta.url),
    "utf8",
  );
  const scanner = ts.createScanner(
    ts.ScriptTarget.ES2022,
    false,
    ts.LanguageVariant.Standard,
    text,
  );
  let tokens = 0;
  for (let kind = scanner.scan(); kind !== ts.SyntaxKind.EndOfFileToken; kind = scanner.scan()) {
    tokens++;
    assert.notEqual(kind, ts.SyntaxKind.TemplateHead);
    assert.notEqual(kind, ts.SyntaxKind.NoSubstitutionTemplateLiteral);
    if (kind === ts.SyntaxKind.StringLiteral)
      assert.ok(!scanner.getTokenValue().includes(prefix), scanner.getTokenValue());
  }
  assert.ok(tokens > 200);
  assert.ok(!/\b(?:fetch|process|document|window|globalThis|require)\b/.test(text));
});

test("admission: only a validateTheme result is accepted", () => {
  const source = json(theme());
  const real = light();
  for (const value of [
    source,
    JSON.parse(source),
    structuredClone(real),
    { ...real },
    new Proxy(real, {}),
    null,
    undefined,
    validateTheme("{}").theme,
    { id: "x}", color: "red; background: url(//evil)" },
  ])
    rejectsTheme(value);
});

test("host shape: every malformed container or value throws the fixed error", () => {
  const good = klarHost();
  const keys = Object.keys(good);
  for (const key of keys) {
    const missing = { ...good };
    delete missing[key];
    rejectsHost(missing);
    for (const bad of [1, null, undefined, new String("1px"), ["1px"], {}])
      rejectsHost({ ...good, [key]: bad });
    let reads = 0;
    const accessor = { ...good };
    Object.defineProperty(accessor, key, {
      enumerable: true,
      get() {
        reads++;
        return good[key];
      },
    });
    rejectsHost(accessor);
    assert.equal(reads, 0, "a getter must never be invoked");
  }
  rejectsHost({ ...good, extra: "1px" });
  const inherited = Object.create(good);
  rejectsHost(inherited);
  rejectsHost(Object.assign(Object.create(good), { fontSize: "1rem" }));
  rejectsHost({ ...good, [Symbol("k")]: "1px" });
  rejectsHost(Object.values(good));
  rejectsHost(null);
  rejectsHost(undefined);
  rejectsHost("1px");
  rejectsHost(new (class Host {
    constructor() {
      Object.assign(this, good);
    }
  })());
  rejectsHost(
    new Proxy(good, {
      ownKeys() {
        throw new Error("trap");
      },
      getOwnPropertyDescriptor() {
        throw new Error("trap");
      },
    }),
  );
  rejectsHost(new Proxy([], {}));
});

test("host shape: null-prototype and frozen objects are accepted", () => {
  const plain = call();
  const bare = Object.assign(Object.create(null), klarHost());
  assert.equal(portalAliasDeclarations(light(), bare), plain);
  assert.equal(portalAliasDeclarations(light(), Object.freeze(klarHost())), plain);
  const accessorOnBare = Object.create(null);
  for (const [key, value] of Object.entries(klarHost()))
    Object.defineProperty(accessorOnBare, key, { enumerable: true, get: () => value });
  rejectsHost(accessorOnBare);
});

const sizes = {
  accept: ["0.25rem", "1rem", "999.9999px", "1em", "0.0001px"],
  reject: [
    "-1px", "1000px", "1.12345rem", "01px", "1PX", "1vw", "50%", "1", "", " ",
    "calc(1px + 1px)", "var(--x)", "1px;", "1px }", " 1px", "1px ", "1px\n",
    "1px/**/", "1px !important", ".5rem", "1.rem", "1e3px", "+1px", "1\\3 px",
  ],
};
const spaceAccept = ["0", ...sizes.accept];
const spaceReject = [...sizes.reject, "00", "0px0"].filter((v) => v !== "0");

test("grammar: fontSize", () => {
  for (const value of ["1rem", "0.875rem", "16px", "0.0001em"])
    assert.ok(call({ fontSize: value }).includes(`--ab-font-size: ${value};\n`));
  for (const value of [
    "0", "0px", "0.0px", "0.0000rem", "0em", ...sizes.reject.filter((v) => !/^-?1px$/.test(v) || v === "-1px"),
  ])
    assert.throws(() => call({ fontSize: value }), TypeError, value);
});

test("grammar: space1..4 and borderWidth", () => {
  for (const [key, name] of [
    ["space1", "--ab-space-1"],
    ["space2", "--ab-space-2"],
    ["space3", "--ab-space-3"],
    ["space4", "--ab-space-4"],
    ["borderWidth", "--ab-border"],
  ]) {
    for (const value of spaceAccept) {
      const css = call({ [key]: value });
      assert.ok(
        key === "borderWidth"
          ? css.includes(`--ab-border: ${value} solid var(`)
          : css.includes(`${name}: ${value};\n`),
        `${key} ${value}`,
      );
    }
    for (const value of spaceReject)
      assert.throws(() => call({ [key]: value }), TypeError, `${key} ${value}`);
  }
});

test("grammar: borderStyle", () => {
  for (const value of ["none", "solid", "dashed", "dotted", "double"])
    assert.ok(call({ borderStyle: value }).includes(`1px ${value} var(`));
  for (const value of [
    "SOLID", "inset", "solid;", "hidden", "solid var(--x)", "solid !important",
    "", " solid", "solid ", "solid\n", "groove", "ridge", "outset", "dashed dotted",
  ])
    assert.throws(() => call({ borderStyle: value }), TypeError, value);
});

test("grammar: shadow", () => {
  const layer = "0 1px 3px rgb(0 0 0 / 20%)";
  const accepted = [
    "none", layer, "0 0 0 #000", "-1px 2px 3px 4px #fff0", "0 0 0 #ABCDEF",
    "0 0 0 #AbC", "0 0 0 rgb(255 255 255 / 100%)", "0 0 #12345678",
    "0 0 0 rgb(0 0 0)", `${layer}, ${layer}`, `${layer}, ${layer}, ${layer}`,
    "-0.5rem -1em 0 0 #0008",
  ];
  for (const value of accepted)
    assert.ok(call({ shadow: value }).endsWith(`--ab-shadow: ${value};\n`), value);
  const rejected = [
    `${layer}, ${layer}, ${layer}, ${layer}`, "inset 0 0 0 #000", "0 0 0 red",
    "0 0 0 url(x)", "0 0 0 rgb(256 0 0)", "0 0 0 rgb(0 0 0 / 101%)", "none, none",
    "0 0 0 rgb(00 0 0)", "0 0 0 rgb(0 0 0 / 020%)", "0 0 0 RGB(0 0 0)",
    "0 0 0 rgb(0,0,0)", "0 0 0 rgb(0 0 0/20%)", "0 0 0 #abcde", "0 0 0 #ggg",
    "0 0 0 #000 !important", "0 0 0 #000;", "0 0 0 #000}", `${layer}\n`, " none",
    "none ", "0 #000", "0 0 0 0 0 #000", "0 0 -1px #000", `${layer},${layer}`,
    `${layer} , ${layer}`, "0  0 0 #000", "0 0 0 #000\n", "0 0 0 rgb(0 0 0 / 20)",
    "", "NONE", "0 0 0 rgb(0 0 0 /*20%)", "0 0 0 #000 /* c */",
  ];
  for (const value of rejected)
    assert.throws(() => call({ shadow: value }), TypeError, value);
  // The length cap is part of the grammar: a valid value of exactly 200
  // characters passes, an otherwise valid one of 201 fails.
  const exact = exactShadow(200);
  assert.equal(exact.length, 200);
  assert.ok(call({ shadow: exact }).includes(exact));
  assert.throws(() => call({ shadow: exactShadow(201) }), TypeError);
});

// A grammar-valid shadow of exactly `length` characters: three layers whose
// components are varied (deterministically) until the total fits.
function exactShadow(length) {
  const parts = ["0", "1px", "1.5px", "10.25px", "100.125px", "999.9999px", "-999.9999px", "-0.5em"];
  const colors = ["#000", "#0008", "#000000", "#00000088", "rgb(0 0 0)", "rgb(0 0 0 / 5%)", "rgb(255 255 255 / 100%)"];
  const byLength = new Map();
  for (const x of parts)
    for (const y of parts)
      for (const blur of parts.filter((part) => !part.startsWith("-")))
        for (const spread of ["", ...parts.map((part) => " " + part)])
          for (const color of colors) {
            const layer = `${x} ${y} ${blur}${spread} ${color}`;
            if (!byLength.has(layer.length)) byLength.set(layer.length, layer);
          }
  for (const [la, a] of byLength)
    for (const [lb, b] of byLength) {
      const lc = length - la - lb - 4;
      if (byLength.has(lc)) return [a, b, byLength.get(lc)].join(", ");
    }
  throw new Error("no shadow of length " + length);
}

// --- seeded property test ---------------------------------------------------------
const mulberry32 = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const alphabet = [
  ..."0123456789abcdefABCDEFxyzpremRGB .-#%(),/;{}\"'\t*!@<>:\n\r",
  "\u00a0", "\u2028", "\u0000",
];
const EXPECTED_NAMES = fixture.names;

function generators(random) {
  const pick = (list) => list[Math.floor(random() * list.length)];
  const int = (max) => Math.floor(random() * (max + 1));
  const num = () => {
    const whole = random() < 0.3 ? "0" : String(1 + int(998));
    return random() < 0.5 ? whole : whole + "." + String(int(9999)).padStart(1 + int(3), "0").slice(0, 1 + int(3));
  };
  const length = () => num() + pick(["px", "rem", "em"]);
  const zl = () => (random() < 0.2 ? "0" : length());
  const signed = () => (random() < 0.4 ? "-" : "") + zl();
  const hex = (n) => Array.from({ length: n }, () => pick([..."0123456789abcdefABCDEF"])).join("");
  const color = () =>
    pick([
      () => "#" + hex(pick([3, 4, 6, 8])),
      () => `rgb(${int(255)} ${int(255)} ${int(255)})`,
      () => `rgb(${int(255)} ${int(255)} ${int(255)} / ${int(100)}%)`,
    ])();
  const layer = () => {
    let text = signed() + " " + signed();
    if (random() < 0.7) {
      text += " " + zl();
      if (random() < 0.5) text += " " + signed();
    }
    return text + " " + color();
  };
  const shadow = () => {
    if (random() < 0.1) return "none";
    return Array.from({ length: 1 + int(2) }, layer).join(", ");
  };
  const fontSize = () => {
    let value;
    do value = length();
    while (!(parseFloat(value) > 0));
    return value;
  };
  return {
    pick,
    int,
    valid: {
      fontSize,
      space1: zl,
      space2: zl,
      space3: zl,
      space4: zl,
      borderWidth: zl,
      borderStyle: () => pick(["none", "solid", "dashed", "dotted", "double"]),
      shadow,
    },
    garbage: () =>
      Array.from({ length: int(300) }, () => pick(alphabet)).join(""),
  };
}

const CASES = 5000;
test("fuzz: no host value yields a declaration outside the closed grammar", () => {
  const random = mulberry32(0x7468656d);
  const gen = generators(random);
  const value = light();
  const cap = (key) => (key === "shadow" ? 200 : 16);
  for (const key of Object.keys(klarHost())) {
    let accepted = 0;
    let rejected = 0;
    for (let i = 0; i < CASES; i++) {
      const valid = i % 2 === 0;
      let candidate = valid ? gen.valid[key]() : gen.garbage();
      // Mutate a valid value half of the time to stay near the grammar edge.
      if (valid && i % 4 === 0 && candidate.length) {
        const at = gen.int(candidate.length - 1);
        candidate = candidate.slice(0, at) + gen.pick(alphabet) + candidate.slice(at + 1);
      }
      const host = { ...klarHost(), [key]: candidate };
      let css;
      try {
        css = portalAliasDeclarations(value, host);
      } catch (error) {
        assert.ok(error instanceof TypeError && error.message === HOST_ERROR);
        rejected++;
        // Generator-valid input within the caps must never be rejected.
        if (valid && i % 4 !== 0 && candidate.length <= cap(key))
          assert.fail(`valid ${key} rejected: ${candidate}`);
        continue;
      }
      accepted++;
      const out = lines(css);
      assert.equal(out.length, 18);
      assert.deepEqual(namesOf(css), EXPECTED_NAMES);
      for (const line of out) {
        assert.match(line, LINE);
        assert.ok(!/url\(|\/\*|!important/.test(line), line);
      }
      assert.ok(candidate.length <= cap(key));
      assert.ok(
        css.includes((key === "borderStyle" ? " " : ": ") + candidate),
        "accepted value must be emitted verbatim",
      );
    }
    assert.ok(accepted > CASES / 4 && rejected > 0, `${key}: ${accepted}/${rejected}`);
  }
});

test("injection: breakout attempts throw before any output", () => {
  const attempts = {
    fontSize: ["1rem; --ab-color-bg: red", "1px/**/", "1px !important", "1\\3 px"],
    space1: ["1px}\n:root{", "1px\r\n", "1px\u2028", "1px\u0000"],
    borderStyle: ["solid var(--x)", "solid !important"],
    shadow: [
      "0 0 0 #000; background: url(//evil)",
      "0 0 0 #000 !important",
      "0 0 0 rgb(0 0 0 /*20%)",
    ],
  };
  for (const [key, values] of Object.entries(attempts))
    for (const attack of values) {
      const host = { ...klarHost(), [key]: attack };
      rejectsHost(host);
      rejectsHost(new Proxy(host, {}));
      let reads = 0;
      const withGetter = { ...klarHost() };
      Object.defineProperty(withGetter, key, {
        enumerable: true,
        get() {
          reads++;
          return attack;
        },
      });
      rejectsHost(withGetter);
      assert.equal(reads, 0);
    }
});

test("no partial output: one bad field among seven good ones throws", () => {
  for (const key of Object.keys(klarHost())) {
    let result;
    assert.throws(() => {
      result = call({ [key]: "nope;" });
    }, TypeError);
    assert.equal(result, undefined);
  }
});

test("determinism and isolation across theme and package copies", async (t) => {
  const first = call();
  assert.equal(call(), first);
  assert.equal(portalAliasDeclarations(dark(), klarHost()), first);
  const directory = await mkdtemp(path.join(tmpdir(), "themes-portal-copy-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await cp(new URL("../dist/", import.meta.url), directory, { recursive: true });
  const copy = await import(pathToFileURL(path.join(directory, "enterprise-portal.js")).href);
  const copyApi = await import(pathToFileURL(path.join(directory, "index.js")).href);
  assert.notEqual(copy.portalAliasDeclarations, portalAliasDeclarations);
  const fromCopy = copyApi.validateTheme(json(theme())).theme;
  assert.throws(() => portalAliasDeclarations(fromCopy, klarHost()), TypeError);
  assert.throws(() => copy.portalAliasDeclarations(light(), klarHost()), TypeError);
  assert.equal(copy.portalAliasDeclarations(fromCopy, klarHost()), first);
});
