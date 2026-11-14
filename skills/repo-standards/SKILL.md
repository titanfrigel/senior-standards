---
name: repo-standards
description: Use when setting up or bringing a repository up to standard (formatter, linter, type strictness, tests and coverage, unused-code and architecture checks, dependency hygiene, CI, GitHub settings, a single check command), for any language or stack, new or existing.
---

# Repo standards

Sets up a clean, well-documented, well-structured repository for any stack: the baseline the project's setup record calls for, plus a researched checklist per language, delivered as one bundled decision and one ADR. Builds on `core/standards.md`; the install rules there apply.

Files (read as needed): `<plugin root>/skills/repo-standards/checklist.md` (the 13 concerns, the baseline with concrete config, the optional items), `<plugin root>/skills/repo-standards/profiles/<language>.md` and `<plugin root>/skills/repo-standards/templates/` (PR and release templates) — the plugin root is `${CLAUDE_PLUGIN_ROOT}` in Claude Code; in OpenCode it is two directories above this SKILL.md file.

Profiles are seed defaults, not truth: every row is verified against current official docs before it is presented. Never state versions, settings or maturity from memory.

## Setup record

Read `## Project setup` in the root `AGENTS.md` (the Git top-level directory). It sets which baseline items apply (checklist part 2, "By setup record"): Docs, Tests, Public repository, Maintained over time, Versioned releases, and `Overrides`, which turns single items on or off by ID. The integration branch is `dev` when Versioned releases is `yes`, otherwise `main`.

- No record, or invalid values: run `project-init` (`senior-standards:project-init`) first; do not guess the levels.
- Propose the Always items, the items the record's values turn on, and the overrides; nothing else from part 2. An item the user drops goes into `Overrides` (through `project-init`) and the ADR.
- Changing a value is `project-init`'s job; it then calls this skill in item mode.

## Flow

1. **Read the record** (above) and **detect languages from manifests.** Look at the repository root and workspace directories for the manifests recognised by `<plugin root>/core/manifests/index.mjs` (for example `package.json`, `*.csproj`, `Cargo.toml`, `pyproject.toml`, `go.mod`). For a new project with no manifests, take the language from the approved stack ADRs. List what you found and confirm with the user.
2. **Load profiles.** Available: `typescript-node`, `dotnet`, `rust`, `python`, `go`. Load the profile for each detected language. A language without a profile has none: research every concern from scratch. Polyglot repo: run steps 3-4 per language and share the baseline.
3. **Verify each candidate against current official docs.** For every profile row (or researched candidate): fetch the tool's official docs (vendor docs MCP, `llms.txt`, then docs pages, per `official-integration`), confirm the tool still exists and is maintained, the current major version, and that each config key and flag exists. Replace stale rows. Record the URL and date. A page that cannot be fetched means the row is marked "verify at run time" and said so to the user. Where docs conflict with the profile or the spec, the docs win.
4. **Fill the checklist per language.** The 13 concerns of `checklist.md` part 1, each with a candidate, an alternative and a one-line reason. Check the repository state: what already exists is kept or improved, never silently replaced.
5. **Present one bundled decision** through `decision-gate` (`senior-standards:decision-gate`): the baseline items the record turns on (each switchable), every language's choices, and the part 3 optional items offered once (D5, A3, R3, R6, C3, T2) where they apply. Include the package-health check for every package and tool, and a `Source` column on every row: the official docs URL that row was verified against (the docs for the mechanism itself, such as the toolchain-file or lint-config page, not only a release page), with the fetch date stated once above the table. A row without one is marked "verify at run time". Ask with the harness's structured-question tool if it has one, otherwise in chat; stop until the user answers. After the answer, write one ADR with `adr` (`senior-standards:adr`) listing every package and tool in `packages:`, with rejected alternatives under "Considered options". This is one decision, not one per tool. If nobody can answer, write a `proposed` ADR and install nothing.
6. **Apply through `official-integration`** (`senior-standards:official-integration`) in the [order](#order) below: install with each tool's documented command and the project's package manager, never hand-edit manifests, run generators and `init` commands the docs prescribe, then write config files from the approved rows. Architecture layer rules (A1, Docs `full`) come from `docs/architecture/overview.md`; if it is missing, run `project-blueprint` (`senior-standards:project-blueprint`) first rather than inventing layers.
7. **Finish green.** Run the project's `check` entry point; fix what it reports until it passes. Then commit in small Conventional Commits. A hook or CI that is not wired to `check` is not done.

## Order

1. Toolchain pin and lockfile, supply-chain settings, format/lint/types, tests and coverage, unused-code and architecture rules, the `check` entry point (it succeeds with no tests yet).
2. `.editorconfig`, `.gitattributes`, PR template (R2, `templates/pull_request_template.md` → `.github/pull_request_template.md`), release template V5 only when Versioned is `yes` (`templates/release.md` → `.github/PULL_REQUEST_TEMPLATE/release.md`), markdownlint/lychee, pre-commit hooks, the `CONTRIBUTING.md` workflow section (C4).
3. The vendored dependency check (D6): from the plugin root, `node scripts/vendor-dependency-check.mjs <projectDir>`.
4. When Versioned is `yes`: create `dev` from `main` (R7; ask first).
5. Workflows (pinned by SHA, least-privilege `permissions`), triggered on PRs into `main` and, when Versioned is `yes`, `dev` too, so release PRs get the same checks: the CI workflow first, then PR title, gitleaks, dependency check, and the record's items (dependency audit D7, CodeQL, Scorecard, release tool); `renovate.json` when Maintained is `yes`.
6. Open a PR with the workflows. Make checks required in R1 only after the CI workflow has reported them once on that PR, using the check names from that run; a check that never reported would block every PR. R1 covers `main`, and `dev` when Versioned is `yes`.

## Item mode

When `project-init` hands over a list of checklist IDs (after a new record or a changed setting), apply only those items:

- Skip items already present and correct; say so.
- Still verify against current docs, run `decision-gate` for every new tool, and ask before each GitHub setting.
- Follow the [order](#order); required checks still wait for a CI report.
- Removals (an item the record no longer calls for) are proposed, never done: list each with what it removes and ask per item. For Versioned `yes` → `no`, in order, each asked: merge `dev` into `main`, retarget open PRs to `main`, delete `dev` and its ruleset, switch `main`'s ruleset back to squash only with linear history, drop `dev` from the CI branch filters and from Renovate's `baseBranches`, remove the release template.
- D6 in item mode also refreshes an outdated copy: re-run the vendor script and commit the result.

## GitHub repository settings

These change account or repository settings, so ask before each one, naming the setting and what changes; never batch them under one yes, and never change them silently:

- Rulesets on `main`, and on `dev` when Versioned is `yes` (R1, R7); required checks after the first CI report.
- Creating or deleting the `dev` branch (R7).
- Secret scanning and push protection (S1, Public).
- CodeQL default setup (S2).
- Installing the Renovate app (D1).
- Default workflow token permissions (S3).

If the user declines or lacks admin rights, write the file-based parts (workflows, `renovate.json`, templates) and list the remaining settings as manual steps in the ADR.

## Rules

- Language-neutral: ask which tool for a concern; do not assume the repository's language or package manager.
- Collaborators without the plugin: no workflow, script, template or config written here may require senior-standards to be installed. The vendored dependency check runs with Node alone.
- No dead config: every file written is used by the `check` entry point, CI or a documented workflow.
- Docs in the same change: update `README.md`, `CONTRIBUTING.md` and `AGENTS.md` (commands, check entry point, tools, integration branch, hook install) when tooling lands.
- Existing repository: show a diff of each changed existing file and ask before overwriting; use `audit` (`senior-standards:audit`) first to see the gaps.
