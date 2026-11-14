# Repository standards checklist

Three parts: the 13 per-language concerns (filled live for each language), the baseline (items every project gets, then items the setup record turns on), and the optional items. Config below is language-neutral; where a key lives in a language-specific file, the profile says so. Re-verify every key against the tool's current official docs before writing it (Renovate: docs.renovatebot.com; GitHub: docs.github.com).

## Part 1: per-language concerns

Fill one row per language. Each answer names a candidate, at least one alternative, and why; the ADR records the choice.

| Concern | Question answered |
|---|---|
| Toolchain pin | How is the language/SDK version pinned (`.node-version`, `global.json`, `rust-toolchain.toml`, `.python-version`, `go` directive...)? |
| Package manager and lockfile | Which manager; is the lockfile committed; does CI install in frozen/locked mode? |
| Supply-chain settings | What install-script policy, release-age delay, provenance or signature checks does the manager offer, and are they on? |
| Build | What is the build command; are warnings errors where the toolchain supports it? |
| Format | Which formatter, and which command fails CI on unformatted files? |
| Lint and static analysis | Which linter or analyzers, at what strictness? |
| Type strictness | Which strict compiler or type-checker settings (TS `strict`, C# `Nullable`, mypy/pyright strict...)? |
| Tests and coverage | Which runner and coverage tool; what threshold applies to changed code (T1)? |
| Unused code and dependencies | What is the ecosystem's equivalent of D4? |
| Dependency audit | Which advisory scanner runs, and at what severity does it fail? |
| Architecture rules | Which tool enforces the layer rules of the architecture doc (A1)? |
| Release and publishing | Which versioning/release tool and registry (V3), with which publish credentials (prefer OIDC trusted publishing)? |
| Check entry point | How is R5 provided: package script, `justfile`, `Makefile`, cargo alias, `dotnet` tool...? |

Polyglot repos fill the table once per language; the baseline in part 2 is shared, and one `check` entry point may call each language's checks.

## Part 2: baseline

Items under [Always](#always) apply to every project. Items under [By setup record](#by-setup-record) apply when the setup record (`## Project setup` in the root `AGENTS.md`) has the matching value. `Overrides` in the record turns single items on or off by ID. Present the applicable items once in the bundled decision; the user may drop one, and the drop goes into the ADR and the record's `Overrides`.

The integration branch is `dev` when Versioned releases is `yes`, otherwise `main`. Feature PRs go into the integration branch. CI workflows (R5, D6, D7, and S1's gitleaks job) run on PRs into `main`, and into `dev` too when Versioned is `yes`, so release PRs `dev` → `main` get the same required checks.

### Always

#### V2 Conventional Commits on PR titles
Squash merge into the integration branch (see R1), so the PR title becomes the commit. Validate it in CI:
```yaml
name: pr-title
on:
  pull_request_target:
    types: [opened, reopened, edited, synchronize]
permissions: {}
jobs:
  lint:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: read
    steps:
      - uses: amannn/action-semantic-pull-request@<full-commit-sha> # vX.Y.Z
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```
`pull_request_target` runs the workflow from the default branch and works for forks; this job never checks out PR code. Alternative: commitlint on the commit range for repos that do not squash.

#### D3 Pins and frozen installs
Pin the toolchain and the package manager version in a committed file; commit the lockfile; CI installs in locked/frozen mode so a stale lockfile fails the build. The profile names the file and the flag.

#### D6 Dependency check in CI
Fails a PR that adds a direct dependency no accepted ADR lists, so the decision-record rule binds every contributor, with or without the plugin. Same logic as the plugin's guard.

- **Vendor it.** From the plugin root: `node scripts/vendor-dependency-check.mjs <projectDir>`. It copies `core/dependency-check.mjs` and the core files it imports into `<projectDir>/.github/scripts/senior-standards/` (keeping the `core/` layout), with `VERSION` (the plugin version) and `README.md`. Commit the folder; never edit it by hand.
- **Run it** with the Node.js preinstalled on GitHub-hosted runners; the project needs no Node toolchain:
```yaml
name: dependency-check
on:
  pull_request:
    branches: [main]      # add dev when Versioned is yes
permissions: {}
jobs:
  dependency-check:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@<full-commit-sha> # vX.Y.Z
        with:
          fetch-depth: 0
          persist-credentials: false
      - run: node .github/scripts/senior-standards/core/dependency-check.mjs --base "$BASE_SHA"
        env:
          BASE_SHA: ${{ github.event.pull_request.base.sha }}
```
- **Exit codes:** 0 nothing uncovered; 1 uncovered dependencies, or a manifest that cannot be parsed; 2 usage, Git or other runtime error (for example a shallow checkout without the base commit, or an unreadable ADR).

| Situation | Result | What to do |
|---|---|---|
| New dependency | Fails with the uncovered names | Write an ADR in `docs/adr/` with `status: accepted` and the name in `packages` |
| New non-registry source (git URL, path, ...) | Fails unless the exact source string, including any `#ref`, is in `packages`; the bare name is not enough | List the exact source. A source containing a comma must use the block-list form of `packages` (`packages:` then `- "<source>"` lines), not the inline `[...]` form |
| Manifest that cannot be parsed | Fails | Fix the manifest |
| Manifest the guard always asks about (not parsed) | Passes with a warning | Confirm the change matches an accepted ADR |
| Removal, version bump, lockfile-only change | Passes | Nothing |

- **Refresh:** re-run the vendor script after a plugin update; `audit` flags a `VERSION` older than the installed plugin.

#### S1 Secrets: gitleaks
- Pre-commit hook (an early warning), through the hook manager chosen with `decision-gate`, for example pre-commit:
```yaml
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: <pinned tag>
    hooks:
      - id: gitleaks
```
- CI job running gitleaks over the PR's commits (the binding check). The official `gitleaks/gitleaks-action` needs a free licence key for organisation-owned repositories; running the gitleaks binary does not. Verify at run time.
- `CONTRIBUTING.md` documents the one-time hook install.

#### S3 Least-privilege workflows
```yaml
permissions: {}          # workflow level: nothing by default
jobs:
  check:
    permissions:
      contents: read     # raise per job, only what the job needs
```
- Set the repository default `GITHUB_TOKEN` to read-only (Settings, Actions; ask first).
- Pin every third-party action to a full-length commit SHA with the version in a comment; Renovate (D1) keeps the digests current when it is on.
- No long-lived registry tokens: use OIDC trusted publishing (`id-token: write` only on the publish job).

#### A2 Error handling and validation
One documented error-handling strategy (architecture doc at Docs `full`, otherwise `AGENTS.md` conventions); validate only at I/O boundaries. Review item, no tool.

#### R1 Ruleset on main (and dev)
Repo Settings, Rules, Rulesets (ask first; it changes repo settings). Target `main`, and also `dev` when Versioned releases is `yes`. Rules from the GitHub ruleset docs:
- Require a pull request before merging. Integration branch: squash only, require linear history. When Versioned is `yes`, `main` receives only release PRs from `dev`: allow merge commits there (no linear-history rule) so `dev` and `main` do not diverge.
- Require status checks to pass, added only after the CI workflow has reported them once on a PR; take the check names from that run (the `check` job, PR title V2, gitleaks S1, dependency check D6, and CodeQL S2 when on). Until then the ruleset exists without required checks.
- Block force pushes and restrict deletions (on by default).

Optional: require signed commits.

#### R2 PR and issue templates
`.github/pull_request_template.md` from `templates/pull_request_template.md` in this skill: summary, motivation, changes, how it was tested, risks and rollback, links. Written for a reviewer, not as a commit log. Optional: `.github/ISSUE_TEMPLATE/` bug and feature forms.

#### R4 Line endings and `.editorconfig`
`.gitattributes`:
```gitattributes
* text=auto eol=lf
*.png binary
*.jpg binary
*.ico binary
```
Windows-only scripts that need CRLF (`*.bat`, `*.cmd`) get `eol=crlf` lines.

`.editorconfig`:
```ini
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true
indent_style = space
indent_size = 2

[*.md]
trim_trailing_whitespace = false

[Makefile]
indent_style = tab
```
Language sections (C# analyzer severities, Go tabs, Python 4 spaces) come from the profile. Keep the formatter config consistent with it.

#### R5 One `check` entry point
Runs format check, lint, type-check/build, tests, unused-code check and architecture rules, with the same command in pre-commit, CI and the agent. It succeeds when there are no tests yet (build and lint still run). The mechanism is per project (profile). The CI workflow calls only this entry point (plus the security and dependency workflows) and runs on PRs into `main`, and into `dev` too when Versioned is `yes`.

#### C1 Docs checks
- `markdownlint-cli2` (`.markdownlint-cli2.jsonc`, globs and ignores) over `**/*.md`.
- `lychee` link checker over the docs, with a `lychee.toml` for excludes; also run it on a schedule so external link rot does not block unrelated PRs.

#### C2 ADR index
Generated by `adr` (`senior-standards:adr`); CI fails when `docs/adr/README.md` is stale.

#### C4 `CONTRIBUTING.md` workflow section
Written by `project-blueprint`; `repo-standards` keeps it current as tooling lands: feature branches `<type>/<short-topic>`, PRs into the integration branch (and release PRs `dev` → `main` when Versioned is `yes`), Conventional Commits, English, the test extent from the record, the `check` command, the hook install command, and that new dependencies come with an ADR (D6).

### By setup record

| Setting | Turns on |
|---|---|
| Always | Every item under [Always](#always) |
| Docs: basic | No checklist item; `project-blueprint` writes README, `AGENTS.md`, `CONTRIBUTING.md` and the ADRs |
| Docs: full | A1 |
| Tests: light | No checklist item; CI runs build and the tests that exist (R5) |
| Tests: standard | No checklist item; coverage reported in CI, not enforced |
| Tests: strict | T1 |
| Public: yes | S1 (GitHub-native), S2, S4, S5 |
| Maintained: yes | D1, D7 |
| Versioned: yes | R7 (`dev`, covered by R1), V1, V3, V4, V5 |
| Versioned: no | Nothing; feature PRs go straight into `main`, no `dev` |

A private repository on a plan with GitHub's code security features can turn the Public items on through `Overrides` (for example `S2 on: GitHub Advanced Security available`).

#### Docs: full

##### A1 Layer rules enforced in CI
The layer rules in `docs/architecture/overview.md` become an executable check inside the `check` entry point. Tool per language: see the profile (dependency-cruiser, NetArchTest, import-linter, depguard, cargo-deny `bans`).

#### Tests: strict

##### T1 Coverage on changed code
Coverage threshold applied to changed code, enforced in CI (per-language tool in the profile; for example Vitest `coverage.changed`, `cargo llvm-cov --fail-under-lines`, coverage.py `fail_under`). Report it in the PR.

#### Public: yes

##### S1 Secrets: GitHub secret scanning and push protection
Repo setting (ask first). Free on public repositories; a private repository needs GitHub Secret Protection, so check availability before turning it on through an override.

##### S2 CodeQL
GitHub's default setup (repo setting; ask first). Alternative: `.github/workflows/codeql.yml` with `github/codeql-action/init` and `analyze` (pinned by SHA), triggered on `pull_request`, pushes to the default branch and a weekly `schedule`, with `permissions` `security-events: write` and `contents: read`. Languages are a matrix of CodeQL identifiers (`javascript-typescript`, `python`, `csharp`, `go`, `rust`, `java-kotlin`, `ruby`, `swift`, `c-cpp`, `actions`); verify the list at run time.

##### S4 Security policy and threat model
`SECURITY.md` (from the blueprint template); at Docs `full`, also the threat-model section of `docs/architecture/overview.md`.

##### S5 OpenSSF Scorecard
The Scorecard workflow (`ossf/scorecard-action`, pinned by SHA) on pushes to `main` and a weekly schedule, publishing results to code scanning.

#### Maintained: yes

##### D1 Renovate
`renovate.json` at the repo root, then install the Renovate GitHub app (a repo-settings change: ask first).
```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["config:recommended", "helpers:pinGitHubActionDigests"],
  "minimumReleaseAge": "3 days",
  "internalChecksFilter": "strict",
  "lockFileMaintenance": {
    "enabled": true,
    "schedule": ["before 5am on the first day of the month"]
  },
  "packageRules": [
    {
      "description": "Group non-major dev dependency updates",
      "matchDepTypes": ["<dev dependency types of the manager: see the profile>"],
      "matchUpdateTypes": ["minor", "patch"],
      "groupName": "dev dependencies (non-major)"
    },
    {
      "description": "Automerge patch dev dependencies once required checks pass",
      "matchDepTypes": ["<dev dependency types of the manager: see the profile>"],
      "matchUpdateTypes": ["patch"],
      "automerge": true
    }
  ]
}
```
Notes from the Renovate docs: `lockFileMaintenance` is off by default (default schedule is weekly), so enable it and set the schedule explicitly; `minimumReleaseAge` takes a duration such as `"3 days"` and adds the `renovate/stability-days` status, and `internalChecksFilter` decides whether branches wait for it (verify the accepted values at run time); `helpers:pinGitHubActionDigests` sets `pinDigests: true` for the `action` and `workflow` dependency types; platform automerge needs at least one required status check or GitHub may merge failing PRs. Dependency type names differ per Renovate manager; each profile lists the dev dependency types for its ecosystem (verified against the Renovate manager docs), and a language without a profile needs them looked up in those docs. When Versioned is `yes`, set `baseBranches` to `["dev"]` so updates go into the integration branch.

##### D7 Dependency audit in CI
The ecosystem's advisory scanner (part 1, "Dependency audit"; chosen through `decision-gate`) runs in CI, inside `check` or as its own job, failing at the agreed severity.

#### Versioned: yes

##### R7 `dev` integration branch
Create `dev` from `main` (ask first), cover it with R1, add it to the CI branch filters (R5, D6, D7), and point feature PRs at it. Releases are PRs from `dev` into `main`. If the release tool (V3) commits to `main` (for example release-please's release commit), merge `main` back into `dev` after each release so the branches do not diverge.

##### V1 Versioning scheme
Libraries and packages: SemVer. Deployed apps: CalVer or SemVer. Record the scheme in `CONTRIBUTING.md`.

##### V3 Release tool
Compare release-please, Changesets, release-plz, MinVer, GoReleaser for the ecosystem, through `decision-gate`. It runs on `main` after a release PR merges.

##### V4 Changelog and tags
`CHANGELOG.md` is generated from Conventional Commits by the release tool (V3) or by `git-cliff`; a Git tag per release (`vX.Y.Z`). Never hand-edit a generated section.

##### V5 Release PR template
`.github/PULL_REQUEST_TEMPLATE/release.md` from `templates/release.md` in this skill: version, highlights, the PRs merged into `dev` since the last release (from `git log main..dev`), breaking changes, upgrade notes. Open release PRs with it (`?template=release.md` on the compare URL, or the GitHub CLI's template option). Written only when Versioned is `yes`.

## Part 3: optional items (offer once, per project)

| Item | Offer when |
|---|---|
| D5 License allowlist | Production dependencies ship to others or the org has a license policy (`cargo-deny` licenses and similar). |
| A3 Observability | The project is deployed; choose logging, tracing and error tracking through `decision-gate`. |
| R3 CODEOWNERS | More than one maintainer or sensitive paths. |
| R6 VS Code extensions/settings, dev container | A team shares the repo or onboarding is slow. |
| C3 `docs/runbooks/` | The project is deployed and operated. |
| T2 E2E tool | The project has a UI; choose through `decision-gate`. |
