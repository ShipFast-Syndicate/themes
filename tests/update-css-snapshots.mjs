// Regenerates tests/snapshots after an intentional contract change:
// npm run build && node tests/update-css-snapshots.mjs
import { writeFile } from "node:fs/promises";
import { snapshotCases } from "./css-cases.mjs";
import { prefix } from "../dist/css.js";

for (const { file, css } of snapshotCases())
  await writeFile(
    new URL(`snapshots/${file}`, import.meta.url),
    css().replaceAll(`--${prefix}-`, "--<P>-"),
  );
