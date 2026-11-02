import { rm } from "node:fs/promises";

// Remove stale build output so a packed tarball never carries files from an earlier build.
await rm(new URL("../../dist/", import.meta.url), { recursive: true, force: true });
