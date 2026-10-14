import test from "node:test";
import assert from "node:assert/strict";
import { validateTheme } from "../dist/index.js";
import { theme, json } from "./fixtures.mjs";
const codes = (text) => validateTheme(text).errors.map((error) => error.code);
const rejects = (text, code) =>
  assert.ok(codes(text).includes(code), json(codes(text)));
const notRejectedAtLimit = (text, code) =>
  assert.ok(!codes(text).includes(code), json(codes(text)));

test("UTF-8 16384-byte boundary before parsing, without truncation", () => {
  const input = json(theme());
  const atLimit = input + " ".repeat(16384 - Buffer.byteLength(input));
  assert.equal(validateTheme(atLimit).ok, true);
  rejects(atLimit + " ", "size.exceeded");
  const unicode = json({ ...theme(), name: "😀".repeat(60) });
  const unicodeLimit = unicode + " ".repeat(16384 - Buffer.byteLength(unicode));
  assert.equal(validateTheme(unicodeLimit).ok, true);
  rejects(unicodeLimit + "é", "size.exceeded");
  rejects("[".repeat(20000), "size.exceeded");
  rejects(undefined, "input.type");
  rejects({}, "input.type");
});

test("container depth 6, members 256 and values 512 inclusive limits", () => {
  notRejectedAtLimit("[".repeat(6) + "0" + "]".repeat(6), "depth.exceeded");
  rejects("[".repeat(7) + "0" + "]".repeat(7), "depth.exceeded");
  rejects("[".repeat(7000) + "0" + "]".repeat(7000), "depth.exceeded");
  const members = (count) =>
    json(
      Object.fromEntries(Array.from({ length: count }, (_, i) => [`x${i}`, 0])),
    );
  notRejectedAtLimit(members(256), "members.exceeded");
  rejects(members(257), "members.exceeded");
  // Count nested members globally, not per object.
  const nested = {
    a: Object.fromEntries(Array.from({ length: 128 }, (_, i) => [`x${i}`, 0])),
    b: Object.fromEntries(Array.from({ length: 127 }, (_, i) => [`x${i}`, 0])),
  };
  rejects(json(nested), "members.exceeded");
  notRejectedAtLimit(json(Array(511).fill(0)), "values.exceeded");
  rejects(json(Array(512).fill(0)), "values.exceeded");
  notRejectedAtLimit(json([Array(510).fill(0)]), "values.exceeded");
  rejects(json([Array(511).fill(0)]), "values.exceeded");
});

test("decoded values/member names capped at 128 code points, including escaped spellings", () => {
  notRejectedAtLimit(json({ ["😀".repeat(128)]: 0 }), "string.exceeded");
  rejects(json({ ["😀".repeat(129)]: 0 }), "string.exceeded");
  notRejectedAtLimit(json("😀".repeat(128)), "string.exceeded");
  rejects(json("😀".repeat(129)), "string.exceeded");
  rejects('{"' + "\\u0061".repeat(129) + '":0}', "string.exceeded");
});

test("duplicate spellings, prototype keys and malformed syntax reject before parse", () => {
  for (const input of [
    '{"id":1,"id":2}',
    '{"id":1,"\\u0069d":2}',
    '{"a":{"x":1,"\\u0078":2}}',
  ])
    rejects(input, "json.duplicate");
  for (const input of [
    '{"__proto__":{"polluted":true}}',
    '{"a":{"constructor":0}}',
    '{"a":[{"prototype":0}]}',
    '{"\\u005f_proto__":0}',
  ])
    rejects(input, "keys.unsafe");
  assert.equal(Object.prototype.polluted, undefined);
  for (const input of [
    "",
    "{",
    "[",
    "{}{}",
    '{"a":1,}',
    "[1,]",
    "{a:1}",
    '"\\x00"',
    '"\\u123z"',
    '"\n"',
    "01",
    "+1",
    "1.",
    ".1",
    "1e",
    "tru",
    "undefined",
    "\u00a0{}",
  ])
    rejects(input, "json.syntax");
  // Escapes and exponent forms that are valid JSON must reach schema validation.
  for (const input of [
    '{"a":"\\\"\\\\\\/\\b\\f\\n\\r\\t\\u0041"}',
    "-1.2e+2",
    "[null,true,false,0,-0,1E-2]",
  ])
    notRejectedAtLimit(input, "json.syntax");
});
