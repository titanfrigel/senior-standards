# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-10-21

### Added

- Six skills: `project-blueprint`, `decision-gate`, `adr`, `official-integration`, `repo-standards` and `audit`, in a format shared by Claude Code and OpenCode.
- Always-on standards text injected at session start (Claude `SessionStart` hook, OpenCode session context hook).
- Dependency guard: detects added dependencies and tool installs in shell commands and in manifests of 11 ecosystems (npm, deno, .NET, Cargo, Go, Python, Maven, Gradle, Ruby, Dart, Composer), plus a fixed list of other manifests that always ask, and asks unless an accepted ADR lists the package. Install commands are recognised through executable paths and Windows shims (`npm.cmd`), `corepack`, Python launcher flags (`py -3 -m pip`) and leading global flags (`npm --prefix web install`); manifest edits match across CRLF and LF line endings; Cargo approvals treat `-` and `_` alike.
- Claude Code adapter (>= 2.1.295): `PreToolUse` hook on `Bash`, `PowerShell`, `Edit` and `Write` returning `ask`; a failing hook blocks the call (`onFailure: "block"`).
- OpenCode v2 adapter (>= 2.0.29): native approval prompt through `ctx.permission.assert`, with a throw fallback (ADR 0003); stacked hooks from a repeated `setup` share a decision only while it is in flight (keyed on session, message, call id, tool and input, never reused once settled, so a reused call id is evaluated again), a configured deny is kept, and guard errors block the call.
- AI-attribution rule in the always-on standards and a guard check (`core/attribution.mjs`, `core/parse-vcs-text.mjs`): `git commit|tag|merge|notes add` and `gh pr|issue` commands whose text (arguments, heredocs, `-F`/`--body-file` files) carries a `Co-Authored-By:` AI trailer, a "Generated with …" footer or a model identifier ask first; bare product mentions are not flagged.
- ADR index tooling (`scripts/adr-index.mjs`) and ADRs 0001 to 0004.
- MIT licence; public repository (ADR 0004).
- Behavioural evals for Next.js, .NET and Rust scenarios.
- README (including what the guard does not cover), contributing guide and agent instructions.
