# Project name

<!-- fill: one sentence on what this project is. This file is the single source of project memory for Claude Code and OpenCode. -->

## Stack

<!-- fill: language and runtime, framework, data store, hosting; link the ADR for each. -->

## Commands

<!-- fill: the exact commands an agent should run, only commands that exist: check (lint, format, types, tests), run, test, build. -->

## Layout

<!-- fill: top-level directories and what lives in each; mention generated or vendored directories not to edit. -->

## Conventions

- Conventional Commits.
- Layer rules in `docs/architecture/overview.md` are enforced in CI; do not bypass them.
- Update docs in the same change as the code. ADRs are append-only.
- Add a dependency, service, database or hosting provider only through the decision gate and an accepted ADR.

<!-- fill: naming, error handling and testing conventions specific to this project. -->

## Documentation

- [Requirements](docs/product/requirements.md)
- [Architecture overview](docs/architecture/overview.md)
- [Decision records](docs/adr/README.md)
- [Contributing](CONTRIBUTING.md)

## MCP servers

<!-- fill: project MCP servers (documentation, database, observability) with what each is for and how it is configured; write "none" if there are none. -->
