import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const metadata = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));

assert.equal(metadata.name, "@alphabros/themes");
assert.equal(metadata.version, "0.0.0-development");
assert.equal(metadata.private, true, "Bootstrap must remain non-publishable.");
assert.equal(metadata.license, "MIT");
assert.equal(metadata.type, "module");
assert.equal(metadata.repository.url, "git+https://github.com/ShipFast-Syndicate/themes.git");
assert.equal(metadata.bugs.url, "https://github.com/ShipFast-Syndicate/themes/issues");
assert.equal(metadata.scripts.check, "node .github/scripts/check-bootstrap.mjs");
assert.equal(metadata.exports, undefined, "Do not advertise unimplemented exports.");

const license = await readFile(path.join(root, "LICENSE"), "utf8");
assert.ok(license.startsWith("MIT License\n"));
assert.ok(license.includes("Copyright (c) 2026 Alpha Bros"));

const documents = ["README.md", "docs/architecture.md", "docs/roadmap.md", "docs/releasing.md"];
for (const file of documents) {
  const content = await readFile(path.join(root, file), "utf8");
  assert.ok(content.trim().length > 0, `${file} must not be empty.`);
  for (const match of content.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const target = match[1];
    if (/^(https?:\/\/|#)/.test(target)) continue;
    assert.ok(!path.isAbsolute(target), `${file} must use portable documentation links.`);
    const resolved = path.resolve(root, path.dirname(file), target.split("#")[0]);
    assert.ok(resolved.startsWith(root), `${file} links outside the repository.`);
    await access(resolved);
  }
}

console.log("Bootstrap metadata, documentation links and publication guard passed.");
