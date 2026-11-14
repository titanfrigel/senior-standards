---
name: audit
description: Use when asked to review, audit or health-check an existing repository against the senior standards, or to find what is missing in its tooling, security, CI, documentation or architecture checks, for any language; produces a prioritised gap report without changing anything.
---

# Audit

A read-only pass over an existing repository. Output is a prioritised gap report with the fix for each gap. It changes nothing: no file edits, no installs, no settings changes, no commits, until the user approves specific fixes.

## What it checks against

1. `core/standards.md` (always injected): decision gate and ADRs, official install, doc locations, hygiene, project memory (`AGENTS.md` with `CLAUDE.md` containing only `@AGENTS.md`).
2. The baseline in `<plugin root>/skills/repo-standards/checklist.md` part 2: the Always items, plus the items the setup record turns on ([Setup record drift](#setup-record-drift)) — the plugin root is `${CLAUDE_PLUGIN_ROOT}` in Claude Code; in OpenCode it is two directories above this SKILL.md file.
3. The per-language concerns (checklist part 1) for each language detected from manifests, using the matching profile in `<plugin root>/skills/repo-standards/profiles/` as a hint, or research for a language without a profile. Verify the expected tools and settings against current official docs; do not judge from memory.
4. The blueprint file set for the record's Docs level (`project-blueprint`, `senior-standards:project-blueprint`): `README.md`, at Docs `full` `docs/product/requirements.md` and `docs/architecture/overview.md` (threat model, layer rules), `docs/adr/` with `0001`, accepted ADRs for the stack, generated `README.md` index, `CONTRIBUTING.md`, `AGENTS.md`/`CLAUDE.md`, and `SECURITY.md` at Public `yes`.

## Setup record drift

Read `## Project setup` in the root `AGENTS.md` and compare each value with the repository. One check per setting; the integration branch is `dev` when Versioned releases is `yes`, otherwise `main`. `Overrides` turn single items on or off and are checked the same way.

| Setting | Check |
|---|---|
| Always | Ruleset on `main` with PRs required and the CI checks required (R1); CI runs `check` on PRs into the integration branch (R5); gitleaks hook config and CI job (S1); PR-title job (V2); `.github/pull_request_template.md` (R2); least-privilege, SHA-pinned workflows (S3); frozen installs (D3); `.editorconfig`, `.gitattributes` (R4); docs checks and ADR index (C1, C2); `CONTRIBUTING.md` workflow section; the dependency check job (D6) and `.github/scripts/senior-standards/` with a `VERSION` not older than the installed plugin's version (`<plugin root>/package.json`) — an outdated `VERSION` is a finding, fixed by re-running the vendor script |
| Docs: basic | `README.md`, `AGENTS.md`, `CONTRIBUTING.md`, `docs/adr/` with `0001` and accepted ADRs for the stack |
| Docs: full | Docs: basic plus `docs/product/requirements.md` and `docs/architecture/overview.md`; layer rules enforced in `check` (A1) |
| Tests: light | CI builds and runs the tests that exist; tests cover the critical paths |
| Tests: standard | Tests sit beside most source modules; CI reports coverage |
| Tests: strict | Coverage threshold on changed code enforced in CI (T1) |
| Public: yes | The repository is public on the forge (or the Public items are overrides); CodeQL enabled (S2); secret scanning with push protection on (S1); Scorecard workflow (S5); `SECURITY.md` (S4) |
| Maintained: yes | Renovate config with lockfile maintenance (D1); a dependency audit step in CI |
| Versioned: yes | `dev` exists with a ruleset (R1); `.github/PULL_REQUEST_TEMPLATE/release.md`; versioning scheme in `CONTRIBUTING.md` (V1); release tool config (V3); generated changelog and `v*` tags (V4) |
| Versioned: no | No `dev` branch; PRs target `main` |

- **No setup record** in the root `AGENTS.md` is itself a finding (Important): fix by running `project-init` (`senior-standards:project-init`). Without a record, check the Always items only and say the rest was skipped.
- Invalid record values are a finding; name the line and the allowed values.
- Items present that the record does not call for (for example a `dev` branch with Versioned `no`) are reported as drift, never as something to delete; changing them goes through `project-init`.

## Flow

1. **Survey.** Read the setup record. List the repository: manifests (languages), lockfiles, CI workflows, `.github/`, config files, `docs/`, `docs/adr/`. Read-only commands only. Run the project's `check` entry point only if it is documented, and say so; it must not modify files.
2. **Compare.** For each item in the four sources, record: present and correct, present but weak, or missing. Examples of weak: lockfile committed but CI installs without frozen mode; `permissions` missing or broad; actions pinned to tags not digests; coverage measured but no threshold; layer rules documented but not enforced; dependencies in manifests without an accepted ADR; unused-code check absent; docs out of date with the code.
3. **Check the repository settings you can read** (rulesets on `main` and `dev`, visibility, secret scanning, CodeQL), through the GitHub CLI when available. If they cannot be read without changing them or without access, list them under "needs manual check".
4. **Report** in this shape:

   ```
   ## Audit report
   Setup record: …   Languages: …   Sources checked: …

   ### Blocking
   - <gap> — why it matters — fix: <exact change, file and tool>
   ### Important
   - …
   ### Nice to have
   - …
   ### Needs manual check
   - …
   ### Fine
   - <short list of what already meets the standards>
   ```

   - **Blocking:** security exposure or broken guarantees (no secret scanning or leaked secret patterns, no lockfile or unfrozen CI installs, workflows with write-all tokens or unpinned third-party actions, no default-branch protection, unreviewed install scripts, dependencies with open high/critical advisories, `check` red).
   - **Important:** missing quality gates and docs (no `check` entry point, no ADRs for the stack, no Conventional Commit enforcement, and record items such as no coverage threshold at Tests `strict`, no Renovate at Maintained `yes`, missing `SECURITY.md` at Public `yes`, no architecture rules at Docs `full`).
   - **Nice to have:** optional items (D5, A3, R3, R6, C3, T2), polish, consistency.
   - Setup record drift goes under Blocking or Important by the item's own weight (for example a missing ruleset is Blocking, a missing release template Important).
   Every gap names its fix concretely enough to apply, and cites the checklist item (for example D1) or standard it comes from.
5. **Offer next steps and stop.** Ask which fixes to apply (ask with the harness's structured-question tool if it has one, otherwise in chat). Applying fixes goes through `repo-standards` (`senior-standards:repo-standards`) for tooling, `project-blueprint` for missing docs, and `decision-gate` (`senior-standards:decision-gate`) for any new dependency. Changing GitHub settings still needs a separate yes per setting.

## Rules

- Read-only, always. If a check would require writing (running a formatter in fix mode, installing a tool), describe it instead.
- Findings are evidence-based: name the file or setting inspected. Do not guess; unknowns go under "needs manual check".
- Do not duplicate the fix procedure: point to the skill that applies it.
