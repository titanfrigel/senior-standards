# senior-standards

Claude Code + OpenCode v2 plugin, layered on Superpowers: decision gate, ADRs, project blueprint and a dependency guard. Language-neutral.

## Layout
- `core/`: harness-agnostic logic (install parsing, manifest extractors in `core/manifests/`, ADR index, guard evaluation, `standards.md`).
- `adapters/claude/`: hook scripts, wired by the root `hooks/hooks.json`. `adapters/opencode/plugin.mjs`: OpenCode v2 plugin.
- `skills/`: one folder per skill with `SKILL.md`.
- `scripts/`: `adr-index.mjs`, `make-icon.mjs`. `tests/`: `core/`, `adapters/`, `skills/`, `evals/`.
- `docs/`: `specs/`, `plans/`, `adr/`.
- `.claude/CLAUDE.md`: imports this file for Claude Code (kept out of the plugin root, which is also the repo root).

## Commands
- `pnpm check`: biome + all tests (run before committing).
- `pnpm test`: tests only.
- `node scripts/adr-index.mjs`: regenerate the ADR index.
- `node scripts/make-icon.mjs`: regenerate the plugin icon.
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
