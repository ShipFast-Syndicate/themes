import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import * as api from "../dist/index.js";
import { validated } from "./css-cases.mjs";
import { theme, set } from "./fixtures.mjs";

const { systemBootScript, systemBootScriptCspSource, themeHtmlAttributes } =
  api;
const EXPECTED_HASH = "'sha256-foCTvNoUB9XS/pGj3Y2eLtgy+7en967pvmsFOG63d2M='";

test("published CSP source is the sha256 of the exported text and a literal", () => {
  const computed = `'sha256-${createHash("sha256").update(Buffer.from(systemBootScript, "utf8")).digest("base64")}'`;
  assert.equal(systemBootScriptCspSource, computed);
  assert.equal(systemBootScriptCspSource, EXPECTED_HASH);
  assert.match(systemBootScriptCspSource, /^'sha256-[A-Za-z0-9+/]{43}='$/);
});

test("boot-script text: size budget, forbidden content, embedding safety", () => {
  assert.ok(Buffer.byteLength(systemBootScript, "utf8") <= 400);
  assert.equal(Buffer.byteLength(systemBootScript, "utf8"), 266);
  assert.doesNotMatch(
    systemBootScript,
    /cookie|localStorage|sessionStorage|eval|fetch|innerHTML|<\/script|<!--/i,
  );
  assert.equal(systemBootScript, systemBootScript.trim());
  assert.doesNotMatch(systemBootScript, /[\n\r\\<>&]/);
  assert.ok(systemBootScript.startsWith("(function(){"));
  assert.ok(systemBootScript.endsWith("})()"));
  const html = `<script>${systemBootScript}</script>`;
  assert.equal(html.match(/<\/?script/g).length, 2);
});

test("attribute names in the script equal the keys themeHtmlAttributes emits", () => {
  const attrs = themeHtmlAttributes({
    preference: "system",
    light: validated(set(theme("light"), "id", "demo-light")),
    dark: validated(set(theme("dark"), "id", "demo-dark")),
    fallback: "dark",
  });
  const names = Object.keys(attrs);
  assert.equal(names.length, 3);
  for (const name of names) assert.ok(systemBootScript.includes(`"${name}"`));
  assert.deepEqual(
    [...new Set([...systemBootScript.matchAll(/"(data-theme[a-z-]*)"/g)].map((m) => m[1]))].sort(),
    [...names].sort(),
  );
});

function sandbox(attributes, { listener = true } = {}) {
  const attrs = new Map(Object.entries(attributes));
  const log = { sets: [], reads: [], media: [], listeners: [], touched: [] };
  const mql = { matches: false };
  if (listener)
    mql.addEventListener = (type, fn) => log.listeners.push([type, fn]);
  const record = (name) => ({
    get() {
      log.touched.push(name);
      return undefined;
    },
  });
  const document = {
    documentElement: {
      getAttribute: (name) => (log.reads.push(name), attrs.get(name) ?? null),
      setAttribute: (name, value) => (log.sets.push(name), attrs.set(name, value)),
    },
  };
  Object.defineProperty(document, "cookie", record("cookie"));
  const context = {
    document,
    matchMedia: (query) => (log.media.push(query), mql),
  };
  for (const name of ["localStorage", "sessionStorage", "fetch", "XMLHttpRequest"])
    Object.defineProperty(context, name, record(name));
  vm.createContext(context);
  return { attrs, log, mql, run: () => vm.runInContext(systemBootScript, context) };
}

test("boot script applies the matching member and follows the media query", () => {
  const box = sandbox({
    "data-theme": "demo-dark",
    "data-theme-light": "demo-light",
    "data-theme-dark": "demo-dark",
  });
  box.run();
  assert.equal(box.attrs.get("data-theme"), "demo-light");
  assert.deepEqual(box.log.media, ["(prefers-color-scheme: dark)"]);
  assert.equal(box.log.listeners.length, 1);
  assert.equal(box.log.listeners[0][0], "change");
  box.mql.matches = true;
  box.log.listeners[0][1]();
  assert.equal(box.attrs.get("data-theme"), "demo-dark");
  assert.deepEqual(box.log.touched, []);
  assert.deepEqual([...new Set(box.log.sets)], ["data-theme"]);
});

test("boot script is a no-op without member attributes and tolerates old MediaQueryList", () => {
  const fixed = sandbox({ "data-theme": "demo-light" });
  fixed.run();
  assert.equal(fixed.attrs.get("data-theme"), "demo-light");
  assert.deepEqual(fixed.log.sets, []);
  const old = sandbox(
    {
      "data-theme": "demo-dark",
      "data-theme-light": "demo-light",
      "data-theme-dark": "demo-dark",
    },
    { listener: false },
  );
  assert.doesNotThrow(() => old.run());
  assert.equal(old.attrs.get("data-theme"), "demo-light");
});

test("sources outside the script text hold no ambient access", async () => {
  const strip = (text) =>
    text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const ambient =
    /\b(globalThis|window|document|matchMedia|process|require)\b|import\(/;
  const apply = strip(await readFile(new URL("../dist/apply.js", import.meta.url), "utf8"));
  assert.doesNotMatch(apply, ambient);
  const boot = strip(
    await readFile(new URL("../dist/boot-script.js", import.meta.url), "utf8"),
  ).replace(/systemBootScript = "(?:[^"\\]|\\.)*"|systemBootScript = '(?:[^'\\]|\\.)*'/, "");
  assert.doesNotMatch(boot, ambient);
});
