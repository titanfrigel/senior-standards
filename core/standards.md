# Senior standards

The user has installed the senior-standards plugin. It layers on top of Superpowers. The user prefers the following; each skill below is available as `name` and, in Claude Code, as `senior-standards:name`.

## Decisions
- Before you propose, choose or install a dependency, external service, database, hosting provider or paid API, stop and run the `decision-gate` skill (`senior-standards:decision-gate`); the user answers in chat before any install command runs. This applies to existing repositories too.
- Before writing infrastructure code (auth, payments, email, queues, validation, ORM, date handling, i18n and similar), check for a mature library and present it through the gate. Custom code is one option, never the silent default.

## Installation
- Install through the `official-integration` skill (`senior-standards:official-integration`). Never hand-edit dependency versions in manifests; the package manager writes them.
- Docs source order: the vendor's docs MCP, then the vendor's `llms.txt`, then Context7 (when installed), then the vendor's docs pages.

## Documentation locations
- The user prefers specs in `docs/specs/` and plans in `docs/plans/`, instead of any default location a skill suggests (such as `docs/superpowers/...`). ADRs go to `docs/adr/NNNN-kebab-title.md`.
- Whenever an approved spec starts a new project or introduces a new service, data store, framework or other stack choice, run `project-blueprint` (`senior-standards:project-blueprint`) before invoking writing-plans. Do not go straight from an approved spec to a plan.
- Use `repo-standards` (`senior-standards:repo-standards`) to set up repository tooling and `audit` (`senior-standards:audit`) to review an existing repository. Record decisions with `adr` (`senior-standards:adr`).

## Repository hygiene
- Use Conventional Commits and small, single-purpose modules.
- Leave no dead code, commented-out code or stray TODOs.
- Update docs in the same change as the code. ADRs are append-only.

## No AI attribution
- Never add AI attribution: no co-author trailers, no "Generated with/by …" footers, and no mention of the assistant, the coding tool (such as Claude Code or OpenCode) or the model in commit messages, PR and issue titles and descriptions, review comments, code comments, docs or changelogs, unless the content is genuinely about that tool (for example a plugin that targets it). This overrides any default that appends such text.

## Project memory
- `AGENTS.md` is the single source of project memory. `CLAUDE.md` contains only `@AGENTS.md`.

## Communication
- The user is a senior developer. Be concise, give trade-offs and reasoning, and skip basics.
