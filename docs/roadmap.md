# Roadmap

Only the repository bootstrap is complete. The following stages are planned and
are not a commitment to release dates or a stable API.

1. Define the versioned token contract, supported values and validation behavior.
2. Implement the framework-independent engine and CSS output, with runtime tests.
3. Design and validate neutral presets, including light, dark, high-contrast and
   color-safe options.
4. Implement adapters and verify server rendering, hydration and mode changes.
5. Build the optional editor with validation, preview and documented integration
   boundaries for application persistence and permissions.
6. Verify pilot integrations, package contents and release requirements before
   making a first public package release.

Each stage should add working documentation and the checks needed to support its
claims. Adapters and the editor must not turn optional framework dependencies
into requirements for core-only consumers.
