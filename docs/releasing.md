# Release requirements

This bootstrap has no publishing workflow. The package remains `private: true`
until a separately reviewed first-release change makes it publishable.

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
that the repository metadata and documentation are consistent.
