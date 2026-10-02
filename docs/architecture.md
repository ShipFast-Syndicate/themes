# Planned architecture

This document describes implementation goals. It does not define a working API.
The first implementation must establish and document the concrete token schema
and versioning rules before adapters or applications depend on them.

## Core

The core is intended to represent theme definitions, validate supported values
and produce CSS custom properties without depending on a framework. Runtime
imports must not require a browser DOM in server-rendered applications.

The contract should distinguish appearance mode from brand identity. A product
may offer light, dark or system appearance while keeping its own branding.

## Validation

Theme definitions are untrusted input. Before accepting user-created themes,
the implementation must define allowed tokens and values, reject unsupported
CSS and external resources, and return useful validation errors.

Accessibility checks should expose contrast problems and accessible preset
choices. They do not by themselves establish accessibility for an application:
each consumer must verify its actual text, controls and visual states.

## Adapters and editor

Adapters should connect the core to framework lifecycle and rendering without
changing the theme contract. Browser behavior and server rendering must have
explicit boundaries to prevent hydration mismatches and appearance flashes.

The optional editor should consume the same validation as the core. Persistence,
authentication, authorization and plan entitlements belong to the application.

## Presets and integration

Shared presets use neutral names and generic palettes. Consumers own their
product-specific palettes and branding assets.

For private views, an application can prioritize an explicit personal appearance
preference, then its site default, then its product default. Public views can use
the site owner's branding. Brand selection must preserve accessibility and
personal appearance controls where the product permits them.
