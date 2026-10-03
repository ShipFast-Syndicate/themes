---
version: "alpha"
name: "Alpha Bros themes bootstrap"
description: "Design boundaries for unreleased framework-independent theme tooling."
omitted:
  - section: colors
    reason: "This unreleased bootstrap has no implemented theme engine, presets or editor and defines no colors values; consumers own product identity."
  - section: typography
    reason: "This unreleased bootstrap has no implemented theme engine, presets or editor and defines no typography values; consumers own product identity."
  - section: spacing
    reason: "This unreleased bootstrap has no implemented theme engine, presets or editor and defines no spacing values; consumers own product identity."
  - section: rounded
    reason: "This unreleased bootstrap has no implemented theme engine, presets or editor and defines no rounded values; consumers own product identity."
  - section: components
    reason: "This unreleased bootstrap has no implemented theme engine, presets or editor and defines no components values; consumers own product identity."
---

## Overview

`@alphabros/themes` is an unreleased bootstrap containing project direction, package metadata and repository checks. The README marks the theme engine, adapters, presets and optional editor as planned; `package.json` remains private. There is no runtime API or editor UI from which to derive visual values.

The planned architecture separates appearance mode from brand identity. Consumers own product palettes and branding; generic shared presets and token schema are future implementation work. This guide documents that boundary and leaves all visual token groups intentionally omitted.

## Do's and Don'ts

- Do retain the bootstrap and private-package status until the documented implementation/release gates are satisfied.
- Do keep appearance preferences, public branding and plan entitlements separate as the README requires.
- Do derive later tokens from the concrete versioned schema and implemented presets/editor.
- Don't turn architecture examples or proposed presets into current supported API or palette claims.
- Don't assign a studio product brand to applications that consume future theme tooling.

## Source references

Repository source: `develop` at `ae228575beb58fa587d4337426859381ea7e1e24`.

- [README.md](https://github.com/ShipFast-Syndicate/themes/blob/ae228575beb58fa587d4337426859381ea7e1e24/README.md)
- [docs/architecture.md](https://github.com/ShipFast-Syndicate/themes/blob/ae228575beb58fa587d4337426859381ea7e1e24/docs/architecture.md)
- [package.json](https://github.com/ShipFast-Syndicate/themes/blob/ae228575beb58fa587d4337426859381ea7e1e24/package.json)
