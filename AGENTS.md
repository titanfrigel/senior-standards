# senior-standards

Claude Code + OpenCode v2 plugin, layered on Superpowers: decision gate, ADRs, project blueprint and a dependency guard. Language-neutral.

## Layout
- `core/`: harness-agnostic logic (install parsing, manifest extractors in `core/manifests/`, ADR index, guard evaluation, branch hygiene `branch-hygiene.mjs`, setup record reader `setup-record.mjs`, Git reader `git-reader.mjs`, CI dependency check `dependency-check.mjs`, `standards.md` and the short `standards-subagent.md`).
- `adapters/claude/`: hook scripts (`session-start`, `subagent-start`, `pre-tool-use`), wired by the root `hooks/hooks.json`. `adapters/opencode/plugin.mjs`: OpenCode v2 plugin.
- `skills/`: one folder per skill with `SKILL.md`.
- `scripts/`: `adr-index.mjs`, `make-icon.mjs`, `vendor-dependency-check.mjs`. `tests/`: `core/`, `adapters/`, `skills/`, `evals/`.
- `.github/scripts/senior-standards/`: this repository's own vendored dependency check (generated; do not edit by hand).
- `docs/`: `specs/`, `plans/`, `adr/`.
- `.claude/CLAUDE.md`: imports this file for Claude Code (kept out of the plugin root, which is also the repo root).

## Commands
- `pnpm check`: biome + all tests (run before committing).
- `pnpm test`: tests only.
- `node scripts/adr-index.mjs`: regenerate the ADR index.
- `node scripts/make-icon.mjs`: regenerate the plugin icon.
- `node scripts/vendor-dependency-check.mjs <projectDir>`: copy the CI dependency check into `<projectDir>/.github/scripts/senior-standards/`; run with `.` after changing its `core/` files or the version.
- `claude plugin validate . --strict`: manifest validation (pre-release, not CI).

## Rules
- Zero runtime dependencies: runtime files import only `node:*` built-ins or repo files.
- `core/` stays harness-agnostic; adapters translate to and from each harness.
- Skills follow the cross-harness format enforced by `tests/skills/format.test.mjs`: frontmatter is only `name` (equals folder name) and a single-line `description`; bodies name actions, not harness tools.
- Language neutrality: stack knowledge lives only in `skills/repo-standards/profiles/`, `core/manifests/` and the `parse-install` rule table.
- The guard never grants `allow`; outcomes are pass or ask. Adapters never let an exception escape into the host (except the deliberate OpenCode fallback throw).
- Every new dependency goes through an ADR first.
- Paths via `node:path`; accept `\` and `/`. Must work on Windows and Linux.
- Conventional Commits; update docs with the code; ADRs are append-only.

## Project setup

<!-- senior-standards:setup v1 -->
- Goal: Claude Code and OpenCode plugin that enforces senior engineering standards: decision gate, ADRs, project blueprint and a dependency guard.
- Docs: full
- Tests: standard
- Public repository: yes
- Maintained over time: yes
- Versioned releases: no
- Overrides: V1 on, V4 on: plugin releases keep semantic versions, `v*` tags and CHANGELOG.md, published from `main`
- Recorded: 2026-11-14
