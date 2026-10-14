# @alphabros/themes

Planned shared, framework-agnostic theme tooling for web applications: token
contracts, validation, adapters and an optional editor.

## Status

This repository is unreleased. It contains a local schema/value-validation and
contrast-reporting foundation, package metadata and repository checks. CSS
application, adapters, editor and presets are planned. No installable release or
package exports are provided.
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

Node.js 22 is required. Install the locked development compiler for local builds
and tests; there are no runtime dependencies.

```sh
npm ci --include=dev
npm run check
npm run build
npm run typecheck
npm test
```

CI runs these checks on GitHub-hosted runners. The original bootstrap guard
continues to validate metadata, documentation links and disabled publication.
See the [local schema/validation contract](docs/schema-validation.md) for APIs,
limits, contrast semantics and the distinction between source checks and product
accessibility acceptance.

Changes target `develop`. Releases are promoted to `main` after the relevant
validation and release approval. Publication automation is not enabled yet.

## License

[MIT](LICENSE), copyright 2026 Alpha Bros.
