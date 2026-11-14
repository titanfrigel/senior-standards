# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-11-14

### Added

- `project-init` skill: agrees on the project goal and, in one message of questions that each say what they turn on, the docs level (`basic|full`), test extent (`light|standard|strict`) and whether the repository is public, maintained over time and versioned; writes a setup record (`## Project setup`, marker `senior-standards:setup v1`) to the root `AGENTS.md` (ADR 0005) and hands the resulting items to `project-blueprint` and `repo-standards` item mode. Also changes a single setting later.
- Setup record reader (`core/setup-record.mjs`) and a session-start reminder when a project has no record: "This repository has no project setup record. Before planning features, run project-init." (Claude Code at session start and after a clear or compaction, OpenCode on each turn).
- Always-on standards for question style (all questions for a stage in one message, with context, described options and a recommendation), a changelog in chat after every plan, fix or change, PR titles and descriptions, release PRs, `main` as the default branch with feature branches, English, and following the setup record (test-first only at `strict`).
- Short subagent standards (`core/standards-subagent.md`), injected through the Claude Code `SubagentStart` hook and into OpenCode child sessions.
- Guard branch hygiene (`core/branch-hygiene.mjs`): asks before `git init` without `-b main` when `init.defaultBranch` is not `main`, before creating (or renaming or copying a branch to) `master`, and before a direct push to `main` (and to `dev` when the project is versioned).
- CI dependency check (`core/dependency-check.mjs`, checklist D6): `scripts/vendor-dependency-check.mjs <projectDir>` copies it and the `core/` files it imports into `.github/scripts/senior-standards/` with a `VERSION` and a `README.md`; CI runs it with `--base <sha>` and plain Node, so it binds collaborators without the plugin. Exit 0 covered, 1 uncovered, 2 usage, Git or other runtime error; non-registry sources need the exact source string (including `#ref`) in an accepted ADR; unparseable manifests fail.
- `repo-standards`: checklist split into Always and By setup record, item mode, new items C4 (`CONTRIBUTING.md` workflow), D6 (dependency check), D7 (dependency audit), R7 (`dev` integration branch) and V5 (release PR template); PR and release PR templates. For versioned projects, `dev` is the integration branch and `main` takes release PRs from `dev` with merge commits.
- `audit`: drift checks between the setup record and the repository, a missing record, and an outdated vendored dependency check.
- Evals: `init-questions`, `init-existing-repo`, `setup-reminder`, `chat-changelog` and `question-style`.
- README section "Working with senior-standards" on the day-to-day workflow; ADR 0005.

### Changed

- `project-blueprint` scales to the docs level: at `basic` it skips requirements and architecture docs, and README links follow the setup record.
- This repository records its own setup in `AGENTS.md` and runs the dependency check in CI.

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
