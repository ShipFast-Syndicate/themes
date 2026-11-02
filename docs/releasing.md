# Release requirements

This bootstrap has no publishing workflow. The package remains `private: true`
until a separately reviewed first-release change makes it publishable.

## Pre-publication consumption

Until a first release passes its own gate, a product can consume the package as a
tarball packed from a named `develop` commit. This is **not a release**: nothing is
published, there is no GitHub Release, no npm dist-tag and no semver promise. The
version stays `0.0.0-development` and the pin is the source commit plus the
tarball's `sha512` integrity.

- The package exposes one entry point, `.`, resolving `dist/index.js` and
  `dist/index.d.ts`. `files` limits the archive to `dist`, `LICENSE` and
  `README.md`; `sideEffects` is `false`. The package stays `private: true`, which
  `npm pack` ignores and which makes an authenticated `npm publish` fail.
- `npm pack` runs `prepack`, which deletes `dist/` and rebuilds it, so the archive
  never carries stale output. The archive is reproducible: the same tree gives the
  same integrity.
- `npm run check:package` (part of CI) fails if the archive contains anything other
  than the allowlist, then installs the tarball into a temporary project, imports
  every export listed in `src/index.ts` as ESM and type-checks a consumer that
  names each of them.
- CI on a push to `develop` uploads the tarball as the workflow artifact
  `alphabros-themes-<commit>` (kept 30 days) and prints its integrity and source
  commit in the log and job summary. This is evidence, not distribution: artifacts
  expire, so a consumer commits the tarball it installs (for example under
  `vendor/`) and records the integrity in its lockfile.
- To pin a consumer, run `npm pack` at the chosen `develop` merge commit (or take
  the CI artifact for it), install it with a `file:` dependency and cite the
  commit and `sha512` in the consumer's change.
- The boot-script CSP hash returned by `systemBootScriptCspSource` is
  contract-proposed until ADR-themes-0003 (boot-script versioning) is accepted.
  Re-check it against the consumer's CSP whenever the tarball is bumped.
- Publication, dist-tags, GitHub Releases and promotion to `main` remain separate,
  release-approved gates described below.

## Before a first release

- Implement and document the exported API and compatibility contract.
- Add meaningful lint, type, runtime test, build and package-content checks for
  the implementation, including server and browser integration where relevant.
- Verify theme-input validation, accessible presets and pilot integration.
- Review dependency licenses and the files included in the package archive.
- Confirm package scope ownership and first-publication requirements against the
  registry's current guidance.
- Obtain release approval, choose a version and promote the reviewed change from
  `develop` to `main`.

## Publishing automation

Future publishing should use a GitHub-hosted runner, a protected `npm`
environment and npm trusted publishing with provenance. Keep publication
permissions limited to the publishing job, validate the released version and
make retries safe. Do not introduce a long-lived npm token into this repository.

Release automation, registry configuration and publication are separate gates
from a successful repository CI run. A green bootstrap check establishes only
that the repository metadata and documentation are consistent, and a green package
check only that the archive content and install path work.
