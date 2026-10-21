# Repository standards checklist

Three parts: the 13 per-language concerns (filled live for each language), the universal baseline (the same for every project), and the optional items. Config below is language-neutral; where a key lives in a language-specific file, the profile says so. Re-verify every key against the tool's current official docs before writing it (Renovate: docs.renovatebot.com; GitHub: docs.github.com).

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

## Part 2: universal baseline (core, every project)

Present each item once in the bundled decision. The user may drop an item; record the drop in the ADR.

### V1 SemVer
Libraries and packages: SemVer. Deployed apps: CalVer or none. Record the scheme in `CONTRIBUTING.md`.

### V2 Conventional Commits on PR titles
Squash merge only (see R1), so the PR title becomes the commit. Validate it in CI:
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

### V4 Changelog and tags
`CHANGELOG.md` is generated from Conventional Commits by the release tool (V3) or by `git-cliff`; a Git tag per release (`vX.Y.Z`). Never hand-edit a generated section.

### D1 Renovate
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
Notes from the Renovate docs: `lockFileMaintenance` is off by default (default schedule is weekly), so enable it and set the schedule explicitly; `minimumReleaseAge` takes a duration such as `"3 days"` and adds the `renovate/stability-days` status, and `internalChecksFilter` decides whether branches wait for it (verify the accepted values at run time); `helpers:pinGitHubActionDigests` sets `pinDigests: true` for the `action` and `workflow` dependency types; platform automerge needs at least one required status check or GitHub may merge failing PRs. Dependency type names differ per Renovate manager; each profile lists the dev dependency types for its ecosystem (verified against the Renovate manager docs), and a language without a profile needs them looked up in those docs.

### D3 Pins and frozen installs
Pin the toolchain and the package manager version in a committed file; commit the lockfile; CI installs in locked/frozen mode so a stale lockfile fails the build. The profile names the file and the flag.

### S1 Secrets
- GitHub secret scanning with push protection (repo setting; ask first; the docs say push protection needs GitHub Secret Protection, so check availability for the repo).
- gitleaks in pre-commit:
```yaml
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: <pinned tag>
    hooks:
      - id: gitleaks
```

### S2 CodeQL
`.github/workflows/codeql.yml` with `github/codeql-action/init` and `analyze` (pinned by SHA), triggered on `pull_request`, pushes to the default branch and a weekly `schedule`, with `permissions` `security-events: write` and `contents: read`. Languages are a matrix of CodeQL identifiers (`javascript-typescript`, `python`, `csharp`, `go`, `rust`, `java-kotlin`, `ruby`, `swift`, `c-cpp`, `actions`); verify the list at run time. Alternative: GitHub's "default setup" toggle in repo settings (ask first).

### S3 Least-privilege workflows
```yaml
permissions: {}          # workflow level: nothing by default
jobs:
  check:
    permissions:
      contents: read     # raise per job, only what the job needs
```
- Set the repository default `GITHUB_TOKEN` to read-only (Settings, Actions; ask first).
- Pin every third-party action to a full-length commit SHA with the version in a comment; Renovate (D1) keeps the digests current.
- No long-lived registry tokens: use OIDC trusted publishing (`id-token: write` only on the publish job).

### S4 Security policy and threat model
`SECURITY.md` (from the blueprint template) and the threat-model section of `docs/architecture/overview.md`.

### A1 Layer rules enforced in CI
The layer rules in the architecture doc become an executable check inside the `check` entry point. Tool per language: see the profile (dependency-cruiser, NetArchTest, import-linter, depguard, cargo-deny `bans`).

### A2 Error handling and validation
One documented error-handling strategy in the architecture doc (cross-cutting concerns); validate only at I/O boundaries. Review item, no tool.

### R1 Ruleset on the default branch
Repo Settings, Rules, Rulesets (ask first; it changes repo settings). Target the default branch; rules from the GitHub ruleset docs:
- Require a pull request before merging; allowed merge methods: squash only.
- Require status checks to pass: the `check` job, CodeQL and the PR-title job.
- Require linear history.
- Block force pushes (on by default).
- Restrict deletions (on by default).

Optional: require signed commits.

### R2 PR and issue templates
`.github/pull_request_template.md` linking the spec, plan and ADRs with a "docs updated" checkbox; `.github/ISSUE_TEMPLATE/` bug and feature forms.

### R4 Line endings
`.gitattributes`:
```gitattributes
* text=auto eol=lf
*.png binary
*.jpg binary
*.ico binary
```
Windows-only scripts that need CRLF (`*.bat`, `*.cmd`) get `eol=crlf` lines.

### `.editorconfig`
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

### R5 One `check` entry point
Runs format check, lint, type-check/build, tests, unused-code check and architecture rules, with the same command in pre-commit, CI and the agent. The mechanism is per project (profile). CI calls only this entry point (plus the security workflows).

### C1 Docs checks
- `markdownlint-cli2` (`.markdownlint-cli2.jsonc`, globs and ignores) over `**/*.md`.
- `lychee` link checker over the docs, with a `lychee.toml` for excludes; also run it on a schedule so external link rot does not block unrelated PRs.

### C2 ADR index
Generated by `adr` (`senior-standards:adr`); CI fails when `docs/adr/README.md` is stale.

### T1 Coverage on changed code
Coverage threshold applied to changed code (per-language tool in the profile; for example Vitest `coverage.changed`, `cargo llvm-cov --fail-under-lines`, coverage.py `fail_under`). Report it in the PR.

## Part 3: optional items (offer once, per project)

| Item | Offer when |
|---|---|
| V3 Release tool | The project publishes packages or tagged releases; compare release-please, Changesets, release-plz, MinVer, GoReleaser for the ecosystem. |
| D5 License allowlist | Production dependencies ship to others or the org has a license policy (`cargo-deny` licenses and similar). |
| S5 OpenSSF Scorecard | The repository is public or a library others depend on. |
| A3 Observability | The project is deployed; choose logging, tracing and error tracking through `decision-gate`. |
| R3 CODEOWNERS | More than one maintainer or sensitive paths. |
| R6 VS Code extensions/settings, dev container | A team shares the repo or onboarding is slow. |
| C3 `docs/runbooks/` | The project is deployed and operated. |
| T2 E2E tool | The project has a UI; choose through `decision-gate`. |
