---
name: audit
description: Use when asked to review, audit or health-check an existing repository against the senior standards, or to find what is missing in its tooling, security, CI, documentation or architecture checks, for any language; produces a prioritised gap report without changing anything.
---

# Audit

A read-only pass over an existing repository. Output is a prioritised gap report with the fix for each gap. It changes nothing: no file edits, no installs, no settings changes, no commits, until the user approves specific fixes.

## What it checks against

1. `core/standards.md` (always injected): decision gate and ADRs, official install, doc locations, hygiene, project memory (`AGENTS.md` with `CLAUDE.md` containing only `@AGENTS.md`).
2. The universal baseline in `<plugin root>/skills/repo-standards/checklist.md` part 2 (V1, V2, V4, D1, D3, S1-S4, A1, A2, R1, R2, R4, R5, C1, C2, T1, `.editorconfig`) — the plugin root is `${CLAUDE_PLUGIN_ROOT}` in Claude Code; in OpenCode it is two directories above this SKILL.md file.
3. The per-language concerns (checklist part 1) for each language detected from manifests, using the matching profile in `<plugin root>/skills/repo-standards/profiles/` as a hint, or research for a language without a profile. Verify the expected tools and settings against current official docs; do not judge from memory.
4. The blueprint file set (`project-blueprint`, `senior-standards:project-blueprint`): `README.md`, `docs/product/requirements.md`, `docs/architecture/overview.md` (threat model, layer rules), `docs/adr/` with `0001`, accepted ADRs for the stack, generated `README.md` index, `CONTRIBUTING.md`, `AGENTS.md`/`CLAUDE.md`, `SECURITY.md`.

## Flow

1. **Survey.** List the repository: manifests (languages), lockfiles, CI workflows, `.github/`, config files, `docs/`, `docs/adr/`. Read-only commands only. Run the project's `check` entry point only if it is documented, and say so; it must not modify files.
2. **Compare.** For each item in the four sources, record: present and correct, present but weak, or missing. Examples of weak: lockfile committed but CI installs without frozen mode; `permissions` missing or broad; actions pinned to tags not digests; coverage measured but no threshold; layer rules documented but not enforced; dependencies in manifests without an accepted ADR; unused-code check absent; docs out of date with the code.
3. **Check the repository settings you can read** (ruleset, secret scanning, CodeQL). If they cannot be read without changing them or without access, list them under "needs manual check".
4. **Report** in this shape:

   ```
   ## Audit report
   Languages: …   Sources checked: …

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
   - **Important:** missing quality gates and docs (no `check` entry point, no coverage threshold, no architecture rules, no ADRs for the stack, missing `SECURITY.md`, no Renovate, no Conventional Commit enforcement).
   - **Nice to have:** optional items (V3, D5, S5, A3, R3, R6, C3, T2), polish, consistency.
   Every gap names its fix concretely enough to apply, and cites the checklist item (for example D1) or standard it comes from.
5. **Offer next steps and stop.** Ask which fixes to apply (ask with the harness's structured-question tool if it has one, otherwise in chat). Applying fixes goes through `repo-standards` (`senior-standards:repo-standards`) for tooling, `project-blueprint` for missing docs, and `decision-gate` (`senior-standards:decision-gate`) for any new dependency. Changing GitHub settings still needs a separate yes per setting.

## Rules

- Read-only, always. If a check would require writing (running a formatter in fix mode, installing a tool), describe it instead.
- Findings are evidence-based: name the file or setting inspected. Do not guess; unknowns go under "needs manual check".
- Do not duplicate the fix procedure: point to the skill that applies it.
