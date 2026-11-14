# senior-standards v0.2.0 (project flow) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `project-init` step with a setup record in `AGENTS.md`, make existing skills and rules follow it, and add the CI dependency check, branch hygiene, release PR template, evals and subagent standards.

**Architecture:** New pure modules in `core/` (setup record, approval matching, branch hygiene, Git reader, dependency-check CLI) used by the existing Claude and OpenCode adapters. A new `project-init` skill; edits to `project-blueprint`, `repo-standards`, `audit` and `core/standards.md`. A vendoring script copies the dependency check into user projects.

**Tech Stack:** Node ≥ 22 built-ins only at runtime; `node:test`; Biome; Markdown skills; `claude plugin eval`.

**Spec:** `docs/specs/2026-11-14-project-flow-design.md` (§n below). It builds on `docs/specs/2026-10-21-senior-standards-design.md`.

## Global Constraints

- Zero runtime dependencies: runtime files import only `node:*` built-ins or repo files. No new dev dependency.
- `core/` stays harness-agnostic; adapters translate. Adapters never let an exception escape into the host (except the deliberate OpenCode fallback throw).
- The guard never grants `allow`; outcomes are `pass` or `ask`.
- Skills: frontmatter only `name` (= folder) and a single-line `description`; bodies name actions, not harness tools (`tests/skills/format.test.mjs`).
- Language-neutral: stack knowledge only in `skills/repo-standards/profiles/`, `core/manifests/`, the `parse-install` rule table.
- Paths via `node:path`; accept `\` and `/`; CRLF and BOM tolerated in every file read. Windows and Linux.
- Files generated into user projects must not require senior-standards (§9): no `senior-standards:` skill names, no `.claude/`/`.opencode/` dependencies in templates for `CONTRIBUTING.md`, CI or scripts.
- Setup record values (§5.4): `docs: basic|full`, `tests: light|standard|strict`, `public|maintained|versioned: yes|no`; marker `<!-- senior-standards:setup v1 -->`.
- Reminder text (§8), exactly: `This repository has no project setup record. Before planning features, run project-init.`
- Conventional Commits; no attribution trailers or footers; English.
- `pnpm check` passes before every commit.

## Ruling (deviation from spec §11.1)

Spec §11.1 says the dependency check is bundled into one file. The check's closure is 16 `core/` files with relative imports and shared helper names; concatenating them without a bundler risks name collisions, and a bundler is a new dev dependency. **Ruling:** vendor a folder, `.github/scripts/senior-standards/`, holding the needed `core/` files copied verbatim with their layout, the CLI, and a `VERSION` file. Same behaviour, no bundler, nothing to keep in sync by hand except re-running the vendor script. Task 12 updates the spec text.

## Review Focus

1. **`cwd` is a subdirectory, or Windows-style.** The record is read from the Git top-level (`C:\repo\packages\api` → `C:\repo\AGENTS.md`). Test in Task 1.
2. **`git push` forms.** `git push -u origin main`, `git push origin feature:main`, `git push origin HEAD:refs/heads/main`, `git push --force origin main`, bare `git push` while on `main`; and no false positive on `git push origin main-docs` or `git push origin feature`. Tests in Task 6.
3. **Git unavailable or not a repository.** The Git reader times out or fails: branch checks skip, setup reminder falls back to the directory itself; nothing throws. Tests in Tasks 1 and 6.
4. **Shallow CI checkout.** The dependency check's `git show <base>:<path>` fails when the base is not fetched; it must exit 2 with "base commit not available; check out with full history (fetch-depth: 0)", not pass silently. Test in Task 5.
5. **Manifest moved or deleted in the PR.** Deleted manifests add nothing; a renamed manifest compares against its old path's content. Test in Task 5.

---

### Task 1: Git reader and setup record module

**Files:**
- Create: `core/git-reader.mjs`, `core/setup-record.mjs`
- Test: `tests/core/git-reader.test.mjs`, `tests/core/setup-record.test.mjs`

**Interfaces:**
- Produces:
  - `createGitReader({ timeoutMs = 2000 } = {}) -> GitReader` in `core/git-reader.mjs`, with `topLevel(dir)` (`git rev-parse --show-toplevel`), `defaultBranch(dir)` (`git config --get init.defaultBranch`), `currentBranch(dir)` (`git rev-parse --abbrev-ref HEAD`); each runs `git` through `node:child_process` `execFile` with `cwd: dir` and resolves `null` on any error, timeout or empty output.
  - `SETUP_MARKER = "<!-- senior-standards:setup v1 -->"`
  - `REMINDER = "This repository has no project setup record. Before planning features, run project-init."`
  - `parseSetupRecord(text: string) -> { found: boolean, values: { goal?, docs?, tests?, public?, maintained?, versioned?, overrides?, recorded? }, problems: string[] }`
  - `integrationBranch(values) -> "dev" | "main"` (`dev` iff `versioned === "yes"`)
  - `async findProjectRoot(dir: string, git?: GitReader) -> string` (Git top-level, else `dir`)
  - `async isProjectDir(dir: string, git?: GitReader) -> boolean` (inside a Git work tree, or `dir` contains a file `findExtractor` or `isUnparsedManifest` recognises)
  - `async readSetupRecord(dir: string, git?: GitReader) -> { root, found, values, problems }` (reads at most 256 KB of `<root>/AGENTS.md`; missing file → `found: false`)
  - `async setupReminder(dir: string, git?: GitReader) -> string | null` (null when not a project or record found without problems; with problems: `REMINDER` + ` Setup record problems: <p1>; <p2>.`)
- `git` parameters default to `createGitReader()`; tests pass a fake reader.

- [ ] **Step 1: Write failing tests**, including:
  - `parseSetupRecord` on the §5.4 example → `found: true`, `values.docs === "basic"`, `values.tests === "standard"`, `values.versioned === "no"`, `problems: []`.
  - Keys match case-insensitively on the label (`- Docs:`, `- Public repository:`, `- Maintained over time:`, `- Versioned releases:`, `- Overrides:`, `- Goal:`, `- Recorded:`); values are trimmed and lowercased except `goal` and `overrides`.
  - `- Tests: heavy` → `problems` contains `Tests: "heavy" is not one of light, standard, strict`.
  - Missing required key (`docs`, `tests`, `public`, `maintained`, `versioned`) → problem `Docs: missing`.
  - No marker → `found: false`, `problems: []`.
  - CRLF and a leading BOM parse the same as LF.
  - `integrationBranch({ versioned: "yes" }) === "dev"`, `({ versioned: "no" }) === "main"`.
  - `readSetupRecord` with a fake reader whose `topLevel` returns the parent of `dir` reads the parent's `AGENTS.md`.
  - `readSetupRecord` when `topLevel` returns `null` reads `dir/AGENTS.md`.
  - A 300 KB `AGENTS.md` with the marker at byte 0 → found; marker after 256 KB → `found: false`.
  - `setupReminder`: empty temp dir, reader returns null → `null`; dir with `package.json`, no `AGENTS.md` → `REMINDER`; dir with valid record → `null`; record with a problem → string starting with `REMINDER` and containing `Setup record problems:`.
  - A reader whose methods throw → treated as `null`; no exception.
  - `createGitReader` in a temp non-repo dir → `topLevel` resolves `null`; in a temp repo (`git init -b main`) → the repo path; with `timeoutMs: 1` against a slow fake → `null` (inject `execFile` for this case).
- [ ] **Step 2: Run** `node --test tests/core/git-reader.test.mjs tests/core/setup-record.test.mjs` → FAIL (modules missing).
- [ ] **Step 3: Implement** both modules. Parse only the lines after the marker up to the next `## ` heading.
- [ ] **Step 4: Run** the test file → PASS; `pnpm check` → PASS.
- [ ] **Step 5: Commit** `feat(core): read the project setup record`

### Task 2: Setup reminder in both adapters

**Files:**
- Modify: `adapters/claude/session-start.mjs`, `adapters/opencode/plugin.mjs`
- Test: `tests/adapters/claude.test.mjs`, `tests/adapters/opencode.test.mjs`

**Interfaces:**
- Consumes: `setupReminder(dir)` (Task 1), `readStdinJson` (`adapters/claude/io.mjs`), `loadStandards()`.
- Produces: injected context = standards text, plus `\n\n` + reminder when `setupReminder` returns a string.

- [ ] **Step 1: Write failing tests.**
  - Claude: stdin `{"hook_event_name":"SessionStart","cwd":"<tmp with package.json>"}` → `additionalContext` ends with `REMINDER`. With a valid `AGENTS.md` record → no reminder. Invalid JSON stdin → standards without reminder, exit 0. `cwd` pointing to a missing directory → standards without reminder.
  - OpenCode: context hook with `ctx.location.directory` = tmp project without record → pushed system text contains `REMINDER`; after writing a valid record into the same dir, the next hook call's text does not (per-turn read, §8).
- [ ] **Step 2: Run** both adapter test files → FAIL.
- [ ] **Step 3: Implement.** Claude: `CLAUDE_PROJECT_DIR || input.cwd`, same as `pre-tool-use.mjs`. OpenCode: compute the reminder inside the context hook on each call, after the existing child-session check (Task 4 later changes what child sessions get); standards text stays cached.
- [ ] **Step 4: Run** → PASS; `pnpm check` → PASS.
- [ ] **Step 5: Commit** `feat(adapters): remind to run project-init when no setup record exists`

### Task 3: Standards text

**Files:**
- Modify: `core/standards.md`
- Create: `core/standards-subagent.md`
- Test: `tests/core/load-standards.test.mjs` (extend)

**Interfaces:**
- Produces: `loadStandards(filePath)` unchanged; new export `SUBAGENT_PATH` from `core/load-standards.mjs` pointing at `standards-subagent.md`.

- [ ] **Step 1: Write failing tests** asserting `core/standards.md` contains each of: `ask all the questions for the current stage in one message`, `changelog in chat`, `PR titles follow Conventional Commits`, `never \`master\``, `in English`, `## Project setup`, `applies only when Tests is \`strict\``, `project-init`, `release PR`; and that the file stays ≤ 120 lines. `standards-subagent.md` contains `English`, `Conventional Commits`, `AI attribution`, `setup record`, `report the need to the parent`, and is ≤ 15 lines.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Write the text.** Add §6.1–§6.5 of the spec (wording may be tightened, meaning kept) as new sections "Questions", "Changelog in chat", "Pull requests", "Branches and language", "Project setup". Add one line for §11.3: "Open release PRs (`dev` → `main`) with the `release` PR template and list the PRs merged since the last release from `git log main..dev`." Add `project-init` to the skills mentioned under "Documentation locations". Write `standards-subagent.md` per spec §11.5.
- [ ] **Step 4: Run** → PASS; `pnpm check` → PASS.
- [ ] **Step 5: Commit** `feat(core): standards for questions, changelog, PRs, branches, language and setup`

### Task 4: Standards for subagents

**Files:**
- Modify: `adapters/opencode/plugin.mjs`; possibly `hooks/hooks.json` and a new `adapters/claude/subagent-start.mjs`
- Test: `tests/adapters/opencode.test.mjs`; `tests/adapters/claude.test.mjs` if the Claude hook exists

**Interfaces:**
- Consumes: `SUBAGENT_PATH`, `loadStandards(path)` (Task 3); `isChildSession` (existing).

- [ ] **Step 1: Verify Claude Code support.** Fetch the current Claude Code hooks reference (official docs) and record in the task report whether a hook event fires when a subagent starts and can add context, with the URL. If yes, this task also adds it; if no, Task 12 records the limitation in README.
- [ ] **Step 2: Write failing tests.** OpenCode: a child session (fake `ctx.session.get` returning `parentID`) gets `<senior-standards>` + subagent text, not the full text; a top-level session gets the full text. Claude (only if supported): the hook prints the subagent text as context.
- [ ] **Step 3: Run** → FAIL. **Step 4: Implement**; errors fall back to injecting nothing. **Step 5: Run** → PASS; `pnpm check` → PASS.
- [ ] **Step 6: Commit** `feat(adapters): inject short standards into subagent sessions`

### Task 5: Approval matching and dependency check CLI

**Files:**
- Create: `core/approval.mjs`, `core/dependency-check.mjs`, `scripts/vendor-dependency-check.mjs`
- Modify: `core/evaluate.mjs` (import matching from `approval.mjs`; behaviour unchanged)
- Test: `tests/core/approval.test.mjs`, `tests/core/dependency-check.test.mjs`, `tests/skills/vendor-script.test.mjs`

**Interfaces:**
- Produces:
  - `approval.mjs`: `matchKey(ecosystem, name)`, `isApproved(approved: Set<string>, ecosystem, name) -> boolean`, `ecosystemOfManager(manager)` — moved verbatim from `evaluate.mjs`.
  - `dependency-check.mjs`: `async checkDependencies({ projectDir, base, git }) -> { uncovered: {file, names[]}[], warnings: string[], problems: string[] }`, and a CLI when run directly: `node dependency-check.mjs --base <sha> [--dir <path>]`. Exit 0 = nothing uncovered; 1 = uncovered names (prints each file and names, then `Write an ADR in docs/adr with status: accepted and these names in packages:`); 2 = usage or Git error. `git` is injectable: `{ changedFiles(base) -> [{status, path, oldPath?}], show(rev, path) -> string|null }`; default implementation runs `git diff --name-status -M <base>...HEAD` and `git show <rev>:<path>` with `execFile` (timeout 10 s).
  - `scripts/vendor-dependency-check.mjs <projectDir>`: copies `core/dependency-check.mjs`, `core/approval.mjs`, `core/adr-index.mjs`, `core/diff-manifest.mjs`, `core/manifests/*.mjs` into `<projectDir>/.github/scripts/senior-standards/` keeping the `core/` layout, writes `VERSION` with the plugin version from `package.json`, and a `README.md` saying the folder is generated and how to refresh it.
- Consumes: `findExtractor`, `isUnparsedManifest`, `addedDependencies`, `readApprovedPackages` (existing).

- [ ] **Step 1: Write failing tests** with a fake `git`:
  - `package.json` adds `zod`, ADR approves `zod` → `uncovered: []`.
  - adds `zod` and `lodash`, ADR approves `zod` → `uncovered: [{ file: "package.json", names: ["lodash"] }]`.
  - `Cargo.toml` adds `serde_json`, ADR lists `serde-json` → covered (approval matching kept).
  - Version bump only, removal only, `package-lock.json` only → `uncovered: []`.
  - Deleted `package.json` → nothing. Renamed `web/package.json` → `app/package.json` with one added name → compares against the old path's content.
  - `Package.swift` changed → `warnings` contains `Package.swift`, exit code 0.
  - `show` throws for the base → exit 2 and stderr contains `fetch-depth: 0` (Review Focus 4).
  - A real-Git integration test in a temp repo: two commits, CLI exit code 1 and stdout names the package.
  - Vendor script: run against a temp dir; the copied CLI runs from there with `node` and imports resolve (no import outside the vendored folder); `VERSION` equals `package.json` version.
  - `tests/core/evaluate.test.mjs` passes unchanged after the move.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** The CLI is only `dependency-check.mjs`'s `import.meta.url === pathToFileURL(process.argv[1]).href` branch. **Step 4: Run** → PASS; `pnpm check` → PASS.
- [ ] **Step 5: Commit** `feat(core): dependency check for CI and a vendoring script`

### Task 6: Branch hygiene in the guard

**Files:**
- Create: `core/branch-hygiene.mjs`
- Modify: `core/evaluate.mjs`
- Test: `tests/core/branch-hygiene.test.mjs`, `tests/core/evaluate.test.mjs` (extend)

**Interfaces:**
- Produces:
  - `async branchHygieneReasons(command: string, dir: string, { git, versioned }) -> string[]`, using `splitCommand` and `tokenizeSegment` from `parse-install.mjs`. Reasons (exact): `Initialise the repository with "git init -b main".`, `The default branch is main, not master.`, `Changes reach main through a pull request, not a direct push.` (and the same sentence with `dev` when `versioned === "yes"`).
  - `evaluate(call, projectDir, { git = createGitReader() } = {})`: adds branch-hygiene sentences to the reason and `"branch-hygiene"` to `items`. `items` becomes the list of present items (`"ai-attribution"`, `"branch-hygiene"`), omitted when empty. `versioned` comes from `readSetupRecord(projectDir, git)`.
- Consumes: `createGitReader`, `readSetupRecord` (Task 1).

- [ ] **Step 1: Write failing tests** (fake reader):
  - `git init` with `defaultBranch` `master` or `null` → init reason; with `main` → none. `git init -b main`, `git init --initial-branch=main` → none. `git init -b master` → master reason.
  - `git branch master`, `git checkout -b master`, `git switch -c master` → master reason; `git branch masterclass` → none.
  - Push (Review Focus 2): `git push -u origin main`, `git push origin feature:main`, `git push origin HEAD:refs/heads/main`, `git push --force origin main`, bare `git push` with `currentBranch` `main` → push reason. `git push origin main-docs`, `git push origin feature`, bare `git push` on `feature` → none. `git push origin dev` → reason only when `versioned: "yes"`.
  - Chained: `git add . && git push origin main` → push reason.
  - Reader returning `null` for every call → no reason from `defaultBranch`/`currentBranch`-dependent checks (Review Focus 3).
  - `evaluate` on `git push origin main` → `{ decision: "ask", items: ["branch-hygiene"] }`; on a commit with AI attribution and a push to main in one command → both items.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS; also `tests/adapters/*` (OpenCode resources now include `branch-hygiene` when present); `pnpm check` → PASS.
- [ ] **Step 5: Commit** `feat(core): ask before master branches and direct pushes to main`

### Task 7: `project-init` skill

**Files:**
- Create: `skills/project-init/SKILL.md`
- Test: `tests/skills/format.test.mjs` (existing, covers it), `tests/skills/project-init.test.mjs`

- [ ] **Step 1: Write a failing test** that `skills/project-init/SKILL.md` exists and its body contains: the five setup questions with the effect text in parentheses exactly as §5.2 step 3 words them (`Will the repo be public? (CodeQL code analysis, secret scanning with push protection, OpenSSF Scorecard, \`SECURITY.md\`)`, etc.), the marker `<!-- senior-standards:setup v1 -->`, `item mode`, and `the reminder no longer applies`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Write the skill** from spec §5.1–§5.7: description triggers on new projects, on a missing setup record, and on changing one setting; steps 1–6; the effects table (§5.3); record format (§5.4); existing-repo proposals (§5.5); changing a setting (§5.6); hand-off list for `repo-standards` item mode; ends by stating the record exists and the reminder no longer applies. Question style per §6.1 is referenced, not repeated. No Superpowers content repeated (anti-goal).
- [ ] **Step 4: Run** → PASS; `pnpm check` → PASS.
- [ ] **Step 5: Commit** `feat(skills): project-init`

### Task 8: `project-blueprint` follows the docs level

**Files:**
- Modify: `skills/project-blueprint/SKILL.md`, `skills/project-blueprint/templates/CONTRIBUTING.md`, `skills/project-blueprint/templates/AGENTS.md`
- Test: `tests/skills/templates.test.mjs` (extend)

- [ ] **Step 1: Write failing tests:** the CONTRIBUTING template contains no `senior-standards:` and has sections `## Workflow` (feature branches `<type>/<short-topic>`, PRs into the integration branch, release PRs when versioned), `## Language` (English), `## Tests` (the project's test extent), `## Hooks` (one-time hook install), `## Dependencies` (new dependencies come with an accepted ADR; CI checks it). The AGENTS template has a `## Project setup` section with the marker and `<!-- fill` placeholders for each value.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Edit** the skill per spec §7: read the record; Docs `basic` skips steps 2 and 4; without a record ask the docs question first. Rewrite CONTRIBUTING's ADR paragraph without skill names.
- [ ] **Step 4: Run** → PASS; `pnpm check` → PASS. **Step 5: Commit** `feat(skills): scale project-blueprint to the docs level`

### Task 9: `repo-standards`, checklist and `audit`

**Files:**
- Modify: `skills/repo-standards/SKILL.md`, `skills/repo-standards/checklist.md`, `skills/audit/SKILL.md`
- Create: `skills/repo-standards/templates/pull_request_template.md`, `skills/repo-standards/templates/release.md`
- Test: `tests/skills/checklist.test.mjs` (new)

- [ ] **Step 1: Write failing tests:** checklist part 2 has headings `### Always` and `### By setup record` and a table row per §5.3 setting; S1 appears as two entries (gitleaks under Always, GitHub-native under Public); new item `D6 Dependency check in CI` under Always naming `vendor-dependency-check.mjs` and `fetch-depth: 0`; T1 only under Tests strict; A1 only under Docs full. PR template has `## Summary`, `## Motivation`, `## Changes`, `## How it was tested`, `## Risks and rollback`, `## Links`. Release template has `## Version`, `## Highlights`, `## Included pull requests`, `## Breaking changes`, `## Upgrade notes`. `audit` body lists one drift check per §5.3 row, the missing-record finding, and an outdated `VERSION` of `.github/scripts/senior-standards/`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Edit** per spec §5.3, §5.7, §7, §11.1, §11.3: record-driven proposals plus overrides; item mode; ordering (workflow first, required checks after the first CI report); R1 covers `dev` when versioned; the release template only when Versioned is `yes`.
- [ ] **Step 4: Run** → PASS; `pnpm check` → PASS. **Step 5: Commit** `feat(skills): record-driven repo-standards, dependency check and drift audit`

### Task 10: Evals

**Files:**
- Create: `tests/evals/{init-questions,init-existing-repo,setup-reminder,chat-changelog,question-style}/` each with `case.yaml`, `prompt.md`, `graders/*.md`, and `scaffold.sh` where a fixture is needed
- Modify: `tests/evals/README.md`

- [ ] **Step 1: Write the five cases** per spec §11.4, in the format of the existing cases (`schema_version: "1.1"`, `allowed_tools` in prompt frontmatter, `regex` / `llm` / `tool_used` graders). `init-questions`: `tool_used` Skill matching `project-init`, `llm` grader for "all questions in one message, each naming what it turns on, nothing written". `chat-changelog`: allowed tools add `Edit`, scaffold a repo with a valid record and a one-line bug, `llm` grader on the five changelog parts.
- [ ] **Step 2: Validate** with `claude plugin validate . --strict` → PASS. Do not run the evals (paid; Task 13).
- [ ] **Step 3: Commit** `test(evals): project-init, reminder, chat changelog and question style`

### Task 11: This repository follows its own rules

**Files:**
- Modify: `.github/pull_request_template.md` (sections from Task 9's template), `AGENTS.md` (add a `## Project setup` record: docs full, tests strict, public yes, maintained yes, versioned yes)
- Create: `.github/workflows/dependency-check.yml` running the vendored check (vendor into this repo with `node scripts/vendor-dependency-check.mjs .`, `fetch-depth: 0`, SHA-pinned actions like `ci.yml`, `permissions: {}` at top)

- [ ] **Step 1:** Make the changes. Versioned `yes` means this repo should gain `dev`; **do not create the branch or change rulesets** — list it for the user (repository settings are asked per item).
- [ ] **Step 2:** `pnpm check` → PASS. **Step 3: Commit** `chore: apply the project flow to this repository`

### Task 12: Docs, ADR and version

**Files:**
- Create: `docs/adr/0005-project-setup-record.md` (status accepted, `packages: []`, alternatives: separate `.senior-standards.yml` rejected), regenerate `docs/adr/README.md`
- Modify: `README.md` (skills table + `project-init`; new "Working with senior-standards" section per spec §10; guard section: branch hygiene; dependency check; subagent note from Task 4), `CHANGELOG.md` (`## [0.2.0]`), `AGENTS.md` layout, `docs/specs/2026-11-14-project-flow-design.md` (§11.1 folder ruling; status Approved), `docs/specs/2026-10-21-senior-standards-design.md` (one line linking the v0.2.0 design), `package.json`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` (version `0.2.0`)

- [ ] **Step 1:** Write the docs. **Step 2:** `node scripts/adr-index.mjs`, `pnpm check`, `claude plugin validate . --strict` → PASS. **Step 3: Commit** `docs: v0.2.0 workflow guide, ADR 0005 and changelog`

### Task 13: Live verification

- [ ] **Step 1:** Install the branch locally in Claude Code (as for v0.1.0): a session in a temp repo with a `package.json` and no record shows the reminder; `git push origin main` prompts with the branch-hygiene reason.
- [ ] **Step 2:** OpenCode: plugin loads from the branch; context contains the reminder (no keypress needed).
- [ ] **Step 3:** Ask the user before the paid eval run of the five new cases (one run each, `--allow-tools WebFetch WebSearch Edit`, `--keep-temp`); record scores in `tests/evals/README.md`.
- [ ] **Step 4:** Commit any score update `test(evals): record v0.2.0 scores`.
