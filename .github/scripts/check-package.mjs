// Package-content check and install smoke test for the pre-publication tarball.
//
// 1. Packs the package (npm runs the clean `prepack` build) and checks the file list
//    against the allowlist in package.json `files` plus the always-included manifest,
//    and checks the manifest still says private: true.
// 2. Installs the tarball into a temp consumer, imports every public export at
//    runtime (ESM) and type-checks a consumer that names every public export.
// 3. Prints the tarball sha512 integrity and the source commit (and appends them to
//    the step summary when running in GitHub Actions).
//
// Usage: node .github/scripts/check-package.mjs [--out <dir>]
//   --out  keep the packed tarball in <dir> (CI uploads it as an artifact).
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const run = (cmd, args, cwd, options = {}) =>
  execFileSync(cmd, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], ...options });

const outIndex = process.argv.indexOf("--out");
const outDir = outIndex === -1 ? undefined : path.resolve(process.argv[outIndex + 1] ?? "");
assert.ok(outIndex === -1 || process.argv[outIndex + 1], "--out needs a directory.");

const metadata = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
assert.equal(metadata.private, true, "The package must stay private: true.");
assert.equal(metadata.version, "0.0.0-development");
assert.equal(metadata.sideEffects, false);
assert.deepEqual(metadata.files, ["dist", "LICENSE", "README.md"]);
assert.deepEqual(metadata.exports, {
  ".": { types: "./dist/index.d.ts", import: "./dist/index.js" },
});
assert.equal(metadata.main, "./dist/index.js");
assert.equal(metadata.types, "./dist/index.d.ts");

const work = await mkdtemp(path.join(tmpdir(), "themes-package-"));
try {
  // --- 1. pack and check the file list ---------------------------------------------
  const packDir = outDir ?? path.join(work, "pack");
  await mkdir(packDir, { recursive: true });
  const [packed] = JSON.parse(
    run(npm, ["pack", "--json", "--pack-destination", packDir], root, { stdio: ["ignore", "pipe", "pipe"] }),
  );
  const tarball = path.join(packDir, packed.filename);
  const files = packed.files.map((file) => file.path).sort();

  const fixed = new Set(["package.json", "LICENSE", "README.md"]);
  for (const file of files) {
    assert.ok(
      fixed.has(file) || /^dist\/[A-Za-z0-9_.-]+\.(js|d\.ts)$/.test(file),
      `Unexpected file in the package: ${file}`,
    );
  }
  for (const required of [...fixed, ...[...Object.values(metadata.exports["."])].map((p) => p.slice(2))]) {
    assert.ok(files.includes(required), `Missing from the package: ${required}`);
  }
  const sources = (await readFile(path.join(root, "src/index.ts"), "utf8")).matchAll(/from "\.\/([^"]+)\.js"/g);
  for (const [, module] of sources) {
    assert.ok(files.includes(`dist/${module}.js`), `dist/${module}.js missing from the package.`);
    assert.ok(files.includes(`dist/${module}.d.ts`), `dist/${module}.d.ts missing from the package.`);
  }
  console.log(`Package content ok: ${files.length} files.`);

  // --- 2. install the tarball and use every public export --------------------------
  const index = await readFile(path.join(root, "src/index.ts"), "utf8");
  const names = (pattern) =>
    [...index.matchAll(pattern)].flatMap((match) =>
      (match[1] ?? "").split(",").map((name) => name.trim()).filter(Boolean),
    );
  const typeNames = names(/export type \{([^}]*)\}/g);
  const valueNames = names(/export \{([^}]*)\}/g);
  assert.ok(typeNames.length > 0 && valueNames.length > 0, "Could not read the public exports from src/index.ts.");

  const consumer = path.join(work, "consumer");
  await mkdir(consumer);
  await writeFile(path.join(consumer, "package.json"), JSON.stringify({ name: "consumer", private: true, type: "module" }));
  run(npm, ["install", tarball, "--ignore-scripts", "--no-audit", "--no-fund", "--no-package-lock"], consumer);

  // Import through the package `exports` map from the consumer, as a real consumer would.
  await writeFile(
    path.join(consumer, "smoke.mjs"),
    `import * as themes from "@alphabros/themes";\nconsole.log(JSON.stringify(Object.keys(themes).sort()));\n`,
  );
  const runtime = JSON.parse(run(process.execPath, ["smoke.mjs"], consumer));
  assert.deepEqual(runtime, [...valueNames].sort(), "Runtime exports differ from src/index.ts.");

  const imports = [
    `import { ${valueNames.join(", ")} } from "@alphabros/themes";`,
    `import type { ${typeNames.join(", ")} } from "@alphabros/themes";`,
    `export const values = [${valueNames.join(", ")}];`,
    `export type Types = [${typeNames.map((name) => `${name} | undefined`).join(", ")}];`,
  ];
  await writeFile(path.join(consumer, "consumer.ts"), `${imports.join("\n")}\n`);
  await writeFile(
    path.join(consumer, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        strict: true,
        noEmit: true,
        skipLibCheck: false,
      },
      include: ["consumer.ts"],
    }),
  );
  run(process.execPath, [path.join(root, "node_modules/typescript/bin/tsc"), "-p", "tsconfig.json"], consumer);
  console.log(`Install smoke test ok: ${valueNames.length} runtime and ${typeNames.length} type exports.`);

  // --- 3. integrity and source commit ----------------------------------------------
  let commit = process.env.GITHUB_SHA;
  commit ||= run("git", ["rev-parse", "HEAD"], root).trim();
  const report = [
    `tarball: ${packed.filename}`,
    `integrity: ${packed.integrity}`,
    `sha1: ${packed.shasum}`,
    `source commit: ${commit}`,
  ];
  console.log(report.join("\n"));
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `### Pre-publication tarball\n\n${report.map((line) => `- ${line.replace(/^(\w[\w ]*): (.*)$/, "$1: \`$2\`")}`).join("\n")}\n`,
    );
  }
} finally {
  await rm(work, { recursive: true, force: true });
}
