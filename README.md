# @alphabros/themes

Planned shared, framework-agnostic theme tooling for web applications: token
contracts, validation, adapters and an optional editor.

## Status

This repository is an unreleased bootstrap. It contains the project direction,
package metadata and repository checks. The theme engine, adapters, editor and
presets are planned; no runtime API or installable release is provided here yet.
The package is marked `private: true` to prevent publication during this stage.

## Direction

- A framework-independent core for theme definitions and CSS custom properties.
- Validation for supported values and accessibility checks.
- Optional framework adapters and a theme editor.
- Neutral shared presets, with product-specific palettes maintained by consumers.

Appearance preferences, public branding and plan entitlements remain separate
concerns. Applications decide who can edit a theme and where it applies.

Read the [architecture](docs/architecture.md), [roadmap](docs/roadmap.md) and
[release requirements](docs/releasing.md) for the planned boundaries and gates.

## Repository checks

Node.js 22 or newer is required for the repository checks. No dependencies need
to be installed at this stage.

```sh
node .github/scripts/check-bootstrap.mjs
```

CI runs this check on GitHub-hosted runners. It validates the bootstrap metadata,
documentation links and publication guard; runtime tests and builds will be
added alongside the implementation.

Changes target `develop`. Releases are promoted to `main` after the relevant
validation and release approval. Publication automation is not enabled yet.

## License

[MIT](LICENSE), copyright 2026 Alpha Bros.
