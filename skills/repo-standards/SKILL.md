---
name: repo-standards
description: Use when setting up or bringing a repository up to standard (formatter, linter, type strictness, tests and coverage, unused-code and architecture checks, dependency hygiene, CI, GitHub settings, a single check command), for any language or stack, new or existing.
---

# Repo standards

Sets up a clean, well-documented, well-structured repository for any stack: a universal baseline plus a researched checklist per language, delivered as one bundled decision and one ADR. Builds on `core/standards.md`; the install rules there apply.

Files (read as needed): `<plugin root>/skills/repo-standards/checklist.md` (the 13 concerns, the baseline with concrete config, the optional items) and `<plugin root>/skills/repo-standards/profiles/<language>.md` — the plugin root is `${CLAUDE_PLUGIN_ROOT}` in Claude Code; in OpenCode it is two directories above this SKILL.md file.

Profiles are seed defaults, not truth: every row is verified against current official docs before it is presented. Never state versions, settings or maturity from memory.

## Flow

1. **Detect languages from manifests.** Look at the repository root and workspace directories for the manifests recognised by `<plugin root>/core/manifests/index.mjs` (for example `package.json`, `*.csproj`, `Cargo.toml`, `pyproject.toml`, `go.mod`). For a new project with no manifests, take the language from the approved stack ADRs. List what you found and confirm with the user.
2. **Load profiles.** Available: `typescript-node`, `dotnet`, `rust`, `python`, `go`. Load the profile for each detected language. A language without a profile has none: research every concern from scratch. Polyglot repo: run steps 3-4 per language and share the baseline.
3. **Verify each candidate against current official docs.** For every profile row (or researched candidate): fetch the tool's official docs (vendor docs MCP, `llms.txt`, then docs pages, per `official-integration`), confirm the tool still exists and is maintained, the current major version, and that each config key and flag exists. Replace stale rows. Record the URL and date. A page that cannot be fetched means the row is marked "verify at run time" and said so to the user. Where docs conflict with the profile or the spec, the docs win.
4. **Fill the checklist per language.** The 13 concerns of `checklist.md` part 1, each with a candidate, an alternative and a one-line reason. Check the repository state: what already exists is kept or improved, never silently replaced.
5. **Present one bundled decision** through `decision-gate` (`senior-standards:decision-gate`): the universal baseline (core items from `checklist.md` part 2, each switchable), every language's choices, and the optional items offered once (V3, D5, S5, A3, R3, R6, C3, T2). Include the package-health check for every package and tool, and a `Source` column on every row: the official docs URL that row was verified against (the docs for the mechanism itself, such as the toolchain-file or lint-config page, not only a release page), with the fetch date stated once above the table. A row without one is marked "verify at run time". Ask with the harness's structured-question tool if it has one, otherwise in chat; stop until the user answers. After the answer, write one ADR with `adr` (`senior-standards:adr`) listing every package and tool in `packages:`, with rejected alternatives under "Considered options". This is one decision, not one per tool. If nobody can answer, write a `proposed` ADR and install nothing.
6. **Apply through `official-integration`** (`senior-standards:official-integration`): install with each tool's documented command and the project's package manager, never hand-edit manifests, run generators and `init` commands the docs prescribe, then write config files from the approved rows. Order: toolchain pin and lockfile, supply-chain settings, format/lint/types, tests and coverage, unused-code and architecture rules, the `check` entry point, then `.editorconfig`, `.gitattributes`, `renovate.json`, workflows (pinned by SHA, least-privilege `permissions`), PR/issue templates, markdownlint/lychee, pre-commit hooks. Architecture layer rules come from `docs/architecture/overview.md`; if it is missing, run `project-blueprint` (`senior-standards:project-blueprint`) first rather than inventing layers.
7. **Finish green.** Run the project's `check` entry point; fix what it reports until it passes. Then commit in small Conventional Commits. A hook or CI that is not wired to `check` is not done.

## GitHub repository settings

These change account or repository settings, so ask before each one, naming the setting and what changes; never batch them under one yes, and never change them silently:

- Branch/tag ruleset on the default branch (R1).
- Secret scanning and push protection (S1); availability depends on the repository's plan.
- CodeQL default setup, if used instead of the workflow (S2).
- Installing the Renovate app (D1).
- Default workflow token permissions (S3).

If the user declines or lacks admin rights, write the file-based parts (workflows, `renovate.json`) and list the remaining settings as manual steps in the ADR.

## Rules

- Language-neutral: ask which tool for a concern; do not assume the repository's language or package manager.
- No dead config: every file written is used by the `check` entry point, CI or a documented workflow.
- Docs in the same change: update `README.md`, `CONTRIBUTING.md` and `AGENTS.md` (commands, check entry point, tools) when tooling lands.
- Existing repository: show a diff of each changed existing file and ask before overwriting; use `audit` (`senior-standards:audit`) first to see the gaps.
