import test from "node:test";
import assert from "node:assert/strict";
import { contrastRatio, validateTheme } from "../dist/index.js";
import { meetsMinimum } from "../dist/contrast.js";
import { theme, set, json } from "./fixtures.mjs";
const near = (actual, expected, tolerance = 1e-10) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${actual} != ${expected}`,
  );
// Independent numeric oracle: explicit channel vectors in encoded sRGB. Never
// round composites to bytes; do not call production parsing/compositing helpers.
const over = (channels, alpha, base) =>
  channels.map((channel, i) => alpha * channel + (1 - alpha) * base[i]);
const luminance = (channels) =>
  channels.reduce(
    (sum, c, i) =>
      sum +
      [0.2126, 0.7152, 0.0722][i] *
        (c > 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92),
    0,
  );
const referenceRatio = (a, b) => {
  const x = luminance(a),
    y = luminance(b);
  return x >= y ? (x + 0.05) / (y + 0.05) : (y + 0.05) / (x + 0.05);
};
const pair = (result, fg, bg, backdrop) =>
  result.contrast.find(
    (report) =>
      report.foregroundPath === fg &&
      report.backgroundPath === bg &&
      (!backdrop || report.backdropPath === backdrop),
  );

test("known WCAG vectors and fixed RangeError handling", () => {
  near(contrastRatio("#000000", "#ffffff"), 21, 1e-12);
  near(contrastRatio("#ffffff", "#000000"), 21, 1e-12);
  near(contrastRatio("#123456", "#123456"), 1, 1e-12);
  near(contrastRatio("#777777", "#ffffff"), 4.478089453577214, 1e-5);
  for (const args of [
    ["#fff", "#ffffff"],
    ["var(secret)", "#ffffff"],
    ["#000000", "rgb(0,0,0)"],
    ["#000000", "#ffffff80"],
    ["#000000", "#ffffff80", "#00000080"],
    ["#000000", "#ffffff", "#00000080"],
  ]) {
    assert.throws(
      () => contrastRatio(...args),
      (error) =>
        error instanceof RangeError && !error.message.includes("secret"),
    );
  }
});

test("alpha foreground and background compositing matches independent vectors", () => {
  const white = [1, 1, 1],
    red = [1, 0, 0],
    black = [0, 0, 0];
  const redOnWhite = over(red, 128 / 255, white);
  near(
    contrastRatio("#ff000080", "#ffffff"),
    referenceRatio(redOnWhite, white),
  );
  const translucentWhiteOnBlack = over(white, 128 / 255, black);
  const redOnEffective = over(red, 64 / 255, translucentWhiteOnBlack);
  near(
    contrastRatio("#ff000040", "#ffffff80", "#000000"),
    referenceRatio(redOnEffective, translucentWhiteOnBlack),
  );
  near(contrastRatio("#00000000", "#ffffff80", "#000000"), 1);
  near(contrastRatio("#000000", "#ffffff", "#000000"), 21);
});

test("threshold comparator uses unrounded >= at 4.5 and 3 exactly", () => {
  for (const minimum of [4.5, 3]) {
    assert.equal(
      meetsMinimum(minimum - Number.EPSILON * minimum, minimum),
      false,
    );
    assert.equal(meetsMinimum(minimum, minimum), true);
    assert.equal(
      meetsMinimum(minimum + Number.EPSILON * minimum, minimum),
      true,
    );
  }
  // Public discrete hex vectors on either side; expectations from the oracle.
  for (const [color, channel, minimum, expected] of [
    ["#777777", 119 / 255, 4.5, false],
    ["#767676", 118 / 255, 4.5, true],
    ["#959595", 149 / 255, 3, false],
    ["#949494", 148 / 255, 3, true],
  ]) {
    const result = contrastRatio(color, "#ffffff");
    near(result, referenceRatio([channel, channel, channel], [1, 1, 1]));
    assert.equal(result >= minimum, expected);
  }
  for (const alphaByte of [136, 137]) {
    const alphaHex = alphaByte.toString(16);
    const result = contrastRatio(`#000000${alphaHex}`, "#ffffff");
    near(
      result,
      referenceRatio(over([0, 0, 0], alphaByte / 255, [1, 1, 1]), [1, 1, 1]),
    );
    assert.equal(result >= 4.5, alphaByte === 137);
  }
});

test("same low-contrast data: strict null/errors vs advisory normalized/warnings and identical reports", () => {
  const source = set(theme(), "color.text.primary", "#eeeeee");
  const strict = validateTheme(json(source));
  const advisory = validateTheme(json(source), { mode: "advisory" });
  assert.equal(strict.ok, false);
  assert.equal(strict.theme, null);
  assert.equal(advisory.ok, true);
  assert.notEqual(advisory.theme, null);
  assert.equal(strict.errors.length, 7); // four surface/tooltip + three subtle
  assert.equal(advisory.errors.length, 0);
  assert.deepEqual(strict.contrast, advisory.contrast);
  for (const report of strict.contrast.filter((report) => !report.pass)) {
    assert.ok(report.suggestion.includes(report.foregroundPath));
    assert.ok(report.suggestion.includes(report.backgroundPath));
    assert.ok(report.suggestion.includes(report.backdropPath));
    assert.ok(report.suggestion.includes(`${report.minimum}:1`));
    assert.ok(report.suggestion.includes("luminance separation"));
  }
  assert.deepEqual(strict, validateTheme(json(source)));
  assert.deepEqual(advisory, validateTheme(json(source), { mode: "advisory" }));
});

test("48 report matrix covers every role and decorative tokens do not block", () => {
  const result = validateTheme(json(theme()));
  assert.equal(result.ok, true);
  assert.equal(result.contrast.length, 48);
  const keys = result.contrast.map(
    (p) => `${p.foregroundPath}|${p.backgroundPath}|${p.backdropPath}`,
  );
  assert.equal(new Set(keys).size, 48);
  const required = result.contrast.filter((p) => p.policy === "required");
  assert.equal(required.filter((p) => p.minimum === 4.5).length, 29);
  assert.equal(required.filter((p) => p.minimum === 3).length, 12);
  assert.ok(
    result.contrast.every(
      (p) =>
        ![p.foregroundPath, p.backgroundPath].some((path) =>
          [
            "color.border.subtle",
            "color.chart.grid",
            "color.surface.overlay",
          ].includes(path),
        ),
    ),
  );
  for (const text of ["primary", "secondary", "muted"])
    for (const surface of ["base", "raised", "sunken"])
      assert.ok(pair(result, `color.text.${text}`, `color.surface.${surface}`));
  for (const status of ["positive", "negative", "warning", "info"])
    for (const surface of ["base", "raised"])
      assert.ok(
        pair(result, `color.status.${status}`, `color.surface.${surface}`),
      );
  for (const ui of [
    "color.border.strong",
    "color.border.focus",
    "color.accent.base",
    "color.chart.axis",
  ])
    assert.ok(pair(result, ui, "color.surface.raised"));
});

test("tooltip-only required failures are assessed", () => {
  const source = set(theme(), "color.chart.tooltipBg", "#000000");
  const result = validateTheme(json(source));
  assert.equal(result.ok, false);
  assert.equal(result.errors.length, 3);
  for (const text of ["primary", "secondary", "muted"])
    assert.equal(
      pair(result, `color.text.${text}`, "color.chart.tooltipBg").pass,
      false,
    );
  assert.equal(
    pair(result, "color.text.primary", "color.surface.base").pass,
    true,
  );
});

test("alpha subtle over each real surface; onAccent/status/series/axis retain alpha semantics", () => {
  const source = theme();
  source.color.surface.base = "#ffffff";
  source.color.surface.raised = "#eeeeee";
  source.color.surface.sunken = "#dddddd";
  source.color.accent.subtle = "#ff000040";
  source.color.text.onAccent = "#ffffff80";
  source.color.status.info = "#00000080";
  source.color.chart.series[0] = "#00000080";
  source.color.chart.axis = "#00000080";
  const result = validateTheme(json(source), { mode: "advisory" });
  assert.equal(result.ok, true);
  for (const [surface, channel] of [
    ["base", 1],
    ["raised", 238 / 255],
    ["sunken", 221 / 255],
  ]) {
    const effective = over([1, 0, 0], 64 / 255, [channel, channel, channel]);
    near(
      pair(
        result,
        "color.text.primary",
        "color.accent.subtle",
        `color.surface.${surface}`,
      ).ratio,
      referenceRatio([0, 0, 0], effective),
    );
  }
  near(
    pair(
      result,
      "color.text.onAccent",
      "color.accent.base",
      "color.surface.base",
    ).ratio,
    referenceRatio([128 / 255, 128 / 255, 128 / 255], [0, 0, 0]),
  );
  const raised = [238 / 255, 238 / 255, 238 / 255];
  for (const path of [
    "color.status.info",
    "color.chart.series.0",
    "color.chart.axis",
  ])
    near(
      pair(result, path, "color.surface.raised").ratio,
      referenceRatio(over([0, 0, 0], 128 / 255, raised), raised),
    );
});

test("adjacent translucent series compare independent effective colours, never layers", () => {
  const source = theme();
  source.color.chart.series.fill("#ff000080");
  for (const mode of ["strict", "advisory"]) {
    const result = validateTheme(json(source), { mode });
    const adjacent = result.contrast.filter((p) => p.policy === "advisory");
    assert.equal(adjacent.length, 7);
    for (const report of adjacent) {
      near(report.ratio, 1);
      assert.equal(report.pass, false);
    }
    assert.equal(
      result.warnings.filter((p) => p.code === "contrast.below").length >= 7,
      true,
    );
  }
  source.color.chart.series[1] = "#00ff0040";
  const result = validateTheme(json(source), { mode: "advisory" });
  near(
    pair(result, "color.chart.series.0", "color.chart.series.1").ratio,
    referenceRatio(
      over([1, 0, 0], 128 / 255, [1, 1, 1]),
      over([0, 1, 0], 64 / 255, [1, 1, 1]),
    ),
  );
});

test("standalone contrast rejects hex with a trailing line break", () => {
  assert.throws(() => contrastRatio("#000000\n", "#ffffff"), RangeError);
});
