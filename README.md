# @alphabros/themes

Planned shared, framework-agnostic theme tooling for web applications: token
contracts, validation, adapters and an optional editor.

## Status

This repository is unreleased. It contains a local schema/value-validation and
contrast-reporting foundation, a proposed CSS custom-property serialiser, package
metadata and repository checks, and a proposed adapter that produces the
enterprise portal's `--ab-*` declarations. Other adapters, the editor and presets
are planned. There is no published release.
The package is marked `private: true` to prevent publication during this stage, but
it can be packed into a tarball for
[pre-publication consumption](docs/releasing.md#pre-publication-consumption).

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
npm run check:package
```

`npm run check:package` packs the package, checks the archive's file list and
installs the tarball into a temporary project to use every public export.
CI runs these checks on GitHub-hosted runners. The original bootstrap guard
continues to validate metadata, documentation links and disabled publication.
See the [local schema/validation contract](docs/schema-validation.md) for APIs,
limits, contrast semantics and the distinction between source checks and product
accessibility acceptance. The proposed
[CSS custom-property serialisation contract](docs/css-serialisation.md) covers
`serializeThemeCss`, its name map and output forms. The proposed
[application attributes and boot script contract](docs/application-attributes.md)
covers `themeHtmlAttributes`, `themeColorMetas` and the constant system boot
script with its CSP hash. The proposed
[enterprise portal alias adapter](docs/enterprise-portal-alias.md) covers
`portalAliasDeclarations`, its host-value grammar and the enterprise pin.

Changes target `develop`. Releases are promoted to `main` after the relevant
validation and release approval. Publication automation is not enabled yet.

## License

[MIT](LICENSE), copyright 2026 Alpha Bros.
