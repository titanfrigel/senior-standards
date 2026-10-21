---
status: accepted
date: 2026-10-21
packages: [@biomejs/biome]
---

# Plugin repository tooling

## Context and problem

The plugin itself ships with zero runtime dependencies, but the repository needs a package manager and some way to lint and format its JavaScript and JSON. Which tooling, if any, do we adopt for developing the plugin repo?

## Decision drivers

- Zero runtime dependencies; any dev dependency must be minimal and justified.
- Consistent lint and format across Windows and Linux, enforced in CI.
- Fast, single-tool setup with little configuration.

## Considered options

| Option | Lint/format | Dev dependencies | Notes |
| --- | --- | --- | --- |
| pnpm + Biome | Biome `check` (lint + format) | 1 (`@biomejs/biome`) | Single binary, one config file |
| No dev dependencies | `node --check` + `node --test` only | 0 | Syntax checks only; no lint or formatting |

## Decision outcome

Chosen: pnpm as package manager with Biome as the only dev dependency, installed pinned to an exact version via `pnpm add -D -E @biomejs/biome`. Scripts: `pnpm test` runs `node --test "tests/**/*.test.mjs"`; `pnpm check` runs `biome check .` then the tests. CI runs `pnpm install --frozen-lockfile` then `pnpm check`.

License: the repository is private and marked `UNLICENSED` in `package.json`; no LICENSE file is created.

## Consequences

- Good: consistent linting and formatting with one tool and one config (`biome.json`).
- Good: exact pinning plus a committed lockfile and Renovate updates keep the dev toolchain reproducible.
- Bad: one dev dependency to maintain; contributors need pnpm (pinned via `packageManager`).

## Links

- [Biome getting started](https://biomejs.dev/guides/getting-started/)
- [pnpm](https://pnpm.io/)
- Licence superseded by [ADR 0004](0004-public-repository-under-mit.md)
