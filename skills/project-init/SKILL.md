---
name: project-init
description: Use when starting a new project, before planning the first feature; when the repository's AGENTS.md has no project setup record (the session-start reminder says so); or when the user wants to change one project setting such as the docs level, test extent, public, maintained or versioned, in any language or repository.
---

# Project init

Agrees on the project's goal and how much documentation, testing and protection it needs, records that in the root `AGENTS.md`, and hands the resulting items to the skills that apply them. Rigour scales with the project: a one-shot website gets no Renovate, CodeQL or `dev` branch.

Nothing is written to disk before the user approves the proposed record. `project-init` never changes repository settings or branches itself.

## Steps

1. **Read the state.** Existing `AGENTS.md`, README, CI workflows, rulesets and visibility (through the GitHub CLI when available; otherwise ask), hooks, test setup, `docs/`, tags. In an existing repository, propose values per [Existing repositories](#existing-repositories).
2. **Goal.** If an approved spec or the README already states the goal, confirm it in one line. Otherwise run `superpowers:brainstorming` for the project goal only (who it is for, what success is, what it is not); features come later.
3. **Ask the setup questions in one message**, in the question style of the always-on standards. Each option says exactly what it turns on:
   1. **Docs** — Basic (README, `AGENTS.md`, `CONTRIBUTING.md`, decision records) or Full (Basic plus requirements and architecture docs from `project-blueprint`). There is no middle level: decision records are required at every level because the dependency guard approves packages only through them.
   2. **Tests** — Light (CI build plus tests on the critical paths), Standard (tests written with each feature), Strict (test-first, coverage threshold enforced in CI).
   3. **Will the repo be public? (CodeQL code analysis, secret scanning with push protection, OpenSSF Scorecard, `SECURITY.md`)** — GitHub provides these free only on public repositories.
   4. **Will it be maintained over time? (Renovate dependency updates, dependency audit in CI)**
   5. **Versioned releases? (a `dev` branch with release PRs `dev` → `main`, release tooling, tags, generated release notes)**
4. **Show what it will do**: the proposed record, then the item list from [What each answer turns on](#what-each-answer-turns-on), grouped as always-on and per-answer. Stop until the user approves.
5. **Write the record** ([Setup record](#setup-record)) into the root `AGENTS.md`; if the file is missing, create it from the `project-blueprint` template. Commit `chore: record project setup`.
6. **Hand off**: `project-blueprint` (`senior-standards:project-blueprint`) for the docs level, then `repo-standards` (`senior-standards:repo-standards`) in item mode with the always-on and fact-gated item IDs. Each keeps its own approval stops and runs `decision-gate` for every tool (for example the hook manager and the release tool).

End by stating that the setup record now exists in `AGENTS.md` and the reminder no longer applies.

## What each answer turns on

IDs refer to `repo-standards`'s checklist. The integration branch is `dev` when Versioned releases is `yes`, otherwise `main`.

| Setting | Effect |
|---|---|
| Always | Feature branches; PRs into the integration branch; ruleset R1 on `main` (and on `dev` when Versioned is yes); CI builds and runs the tests that exist through one `check` entry point R5, as required checks (see [Required checks](#required-checks-without-tests)); gitleaks as a pre-commit hook and in CI (the gitleaks half of S1); Conventional Commits on PR titles (V2); PR template R2; `CONTRIBUTING.md` workflow section C4; least-privilege workflows S3; pins and frozen installs D3; dependency check in CI D6; `.editorconfig` and line endings R4; error-handling and validation conventions A2; docs checks C1 and ADR index C2 |
| Docs: basic | `project-blueprint` writes README, `AGENTS.md`, `CONTRIBUTING.md`, ADR 0001 and the stack ADRs; skips requirements and architecture |
| Docs: full | Full `project-blueprint` flow; A1 (layer rules in CI) applies |
| Tests: light | No test-first; tests for critical paths only; CI runs build and tests |
| Tests: standard | Tests written with each feature, in the same change; no test-first requirement; coverage reported, not enforced |
| Tests: strict | `superpowers:test-driven-development` applies; coverage threshold on changed code in CI (T1) |
| Public: yes | S2 CodeQL (default setup), the GitHub-native half of S1 (secret scanning and push protection), S5 Scorecard, S4 `SECURITY.md` |
| Maintained: yes | D1 Renovate with lockfile maintenance, D7 dependency audit in CI (the ecosystem's audit tool, chosen through `decision-gate`) |
| Versioned: yes | R7 `dev` integration branch covered by R1; feature PRs into `dev`; release PRs `dev` → `main`; V1 versioning scheme, V3 release tool, V4 changelog and tags, V5 release PR template |
| Versioned: no | Feature PRs straight into `main`; no `dev` |

The optional items A3, R3, R6, C3, T2 and D5 are not init questions; `repo-standards` offers them once when they apply. A private repository on a plan with GitHub's code security features can turn the Public items on as overrides.

## Setup record

A section in the root `AGENTS.md` (the Git top-level directory; the directory itself when there is no Git repository yet), plain Markdown with one marker line:

```markdown
## Project setup

<!-- senior-standards:setup v1 -->
- Goal: <one or two sentences>
- Docs: basic
- Tests: standard
- Public repository: no
- Maintained over time: yes
- Versioned releases: no
- Overrides: none
- Recorded: 2026-11-14
```

- Values are lowercase from fixed sets: Docs `basic|full`; Tests `light|standard|strict`; the three facts `yes|no`.
- The integration branch is derived, never recorded.
- `Overrides` lists checklist items turned on or off against the defaults, by ID with a reason (for example `S2 on: GitHub Advanced Security available`), or `none`.
- `Recorded` is the date of the last change, `YYYY-MM-DD`.
- `v1` versions the format; keep the marker line exactly as shown.

## Existing repositories

Step 1 proposes values from what exists; the user confirms or changes them.

| Setting | Proposed as |
|---|---|
| Docs | `full` when both requirements and architecture documents exist, else `basic` |
| Tests | `strict` when CI enforces a coverage threshold; `standard` when tests exist beside most source modules; else `light` |
| Public | From the repository's visibility on the forge |
| Maintained | `yes` when Renovate or Dependabot config exists |
| Versioned | `yes` when tags matching `v*` or a release tool config exist |

Nothing already in the repository is removed because the record does not call for it: list such items and ask per item.

## Changing a setting

When the user changes one setting ("switch tests to strict", "this repo is now public"):

1. Re-ask only that item, in the same question style.
2. Show what will be added and what would be removed; stop for approval.
3. Update that line and `Recorded` in the record; commit `chore: update project setup`.
4. Hand the item list to `repo-standards` in item mode, which applies it with its usual per-setting approvals.

Removals are proposed, never automatic. For Versioned `yes` → `no`, propose in order, each step asked: merge `dev` into `main`, retarget open PRs to `main`, then delete `dev` and its ruleset.

## Required checks without tests

The `check` entry point and CI succeed when the project has no tests yet (build and lint still run). Required status checks join the ruleset only after the CI workflow has reported once on a PR, so a never-reporting check cannot block every PR. `repo-standards` orders the work this way; include the ordering in the hand-off.
