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
- Use `project-init` (`senior-standards:project-init`) to record how a project is set up, `repo-standards` (`senior-standards:repo-standards`) to set up repository tooling and `audit` (`senior-standards:audit`) to review an existing repository. Record decisions with `adr` (`senior-standards:adr`).

## Questions
- When you need decisions from the user, ask all the questions for the current stage in one message, numbered. Give each its context (why it matters, what it changes), the options with a short description and trade-offs, and your recommendation. Use an open question only when the options cannot be named yet. This replaces any skill default of one question at a time or questions without options.

## Changelog in chat
- After implementing a plan, a fix or a modification, end with a changelog in chat: what changed, why, the files touched, how it was verified (commands and results), and what is not done or not verified. It is for the user only; do not write it to a file.

## Pull requests
- PR titles follow Conventional Commits. The description follows the repository's PR template; where there is none: summary, motivation, changes, how it was tested, risks and rollback, linked issues and ADRs. Write it for a reviewer, not as a commit log.
- Open release PRs (`dev` → `main`) with the `release` PR template and list the PRs merged since the last release from `git log main..dev`.

## Branches and language
- The default branch is `main`, never `master`; create repositories with `git init -b main` (or the forge's equivalent). Work on feature branches named `<type>/<short-topic>` and merge through PRs.
- Code, identifiers, comments, commit messages, PRs, issues and documentation are in English, whatever language the conversation is in.

## Project setup
- The project's `AGENTS.md` setup record (`## Project setup`) sets the docs level, test extent and protection items; follow it.
- `superpowers:test-driven-development` applies only when Tests is `strict`; at `standard`, write tests in the same change as the feature; at `light`, test the critical paths.
- If there is no setup record, run `project-init` (`senior-standards:project-init`) before planning the first feature.

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
