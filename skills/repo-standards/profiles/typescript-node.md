# TypeScript / Node.js profile

Seed defaults, checked against official docs on 2026-10-21. Re-verify each row before presenting it. Decisions already accepted for this stack: pnpm, Biome, Vitest, Knip, dependency-cruiser, a `check` script.

## Toolchain pin
Candidate: `.node-version` (Node LTS line) plus `devEngines.runtime` in `package.json`. Alternative: `.nvmrc` or `mise`/`asdf` `.tool-versions`. Why: pnpm can resolve and lock the runtime from `devEngines.runtime`, one source for CI and local. Pick an Active or Maintenance LTS line (Node 24 and 22 are LTS today; production should not use the Current line).

## Package manager and lockfile
Candidate: `pnpm` with `pnpm-lock.yaml` committed, version pinned by `devEngines.packageManager` (or the `packageManager` field). Alternative: `npm` 11 with `package-lock.json`. Why: pnpm blocks undeclared dependencies and unreviewed install scripts by default. CI: `pnpm install --frozen-lockfile` (pnpm already defaults to frozen in CI when a lockfile exists; pass it anyway to be explicit).

## Supply-chain settings
Candidate: pnpm settings in `pnpm-workspace.yaml` (not `.npmrc`). Alternative: npm provenance checks plus Renovate `minimumReleaseAge` only. Why: pnpm enforces these at install time.
```yaml
minimumReleaseAge: 4320        # minutes; default is 1440 (1 day) since pnpm 11
trustPolicy: no-downgrade      # fail if a package's trust level dropped vs earlier releases
strictDepBuilds: true          # fail install on unreviewed build scripts (default true)
blockExoticSubdeps: true       # transitive deps may not come from git/tarball URLs (default true)
allowBuilds:                   # explicit allow/deny per package; unlisted are unreviewed
  esbuild: true
```
Run `pnpm audit signatures` in CI to verify registry signatures. Publish with npm trusted publishing (OIDC, `id-token: write`), which attaches provenance.

## Build
Candidate: `tsc --noEmit` for type-check plus the bundler the project's framework prescribes (`tsup`/`tsdown`/`vite`). Alternative: `tsc` emit only. Why: keep type-check and bundling separate so `check` never depends on a bundler. Libraries: `verbatimModuleSyntax`, `"type": "module"`, declared `exports`.

## Format
Candidate: `biome format` via `biome ci .` in CI. Alternative: `prettier`. Why: Biome is one binary and one `biome.json` for format, lint and import sorting (current line 2.x; pin the exact version with `-E`).

## Lint and static analysis
Candidate: `biome` with the `recommended` rules, run as `biome ci .` (no auto-fix in CI). Alternative: `eslint` with `typescript-eslint`, only when a needed plugin has no Biome equivalent. Why: fewer tools; keep ESLint for gaps rather than running both for the same rules.

## Type strictness
Candidate: `strict: true` in `tsconfig.json` plus `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`. Alternative: `strict` only. Why: per the TypeScript docs `strict` does not include those two, and they catch real bugs; `noEmit` for the check-only config.

## Tests and coverage
Candidate: `vitest` with `@vitest/coverage-v8`; `coverage.thresholds` (`lines`, `branches`, `functions`, `statements`, `perFile`) and `coverage.changed` to scope to changed files (T1). Alternative: `node:test` with `c8`. Why: Vitest is the Vite-native runner with built-in thresholds; v8 is its default provider (current major 5).

## Unused code and dependencies
Candidate: `knip` (`knip.json`: `entry`, `project`, `ignoreDependencies`, `workspaces`), run as `pnpm knip`. Alternative: `depcheck` with `ts-prune` (both less maintained; prefer Knip). Why: one tool for unused files, exports and dependencies, monorepo-aware (Knip v6 needs Node 20.19+).

## Dependency audit
Renovate dev dependency type (manager `npm`): `devDependencies` (also `peerDependencies`, `optionalDependencies`); use it in `matchDepTypes` for D1.
Candidate: `pnpm audit --audit-level high --prod` (config `audit.level`, `audit.ignore` in `pnpm-workspace.yaml`). Alternative: `osv-scanner` on `pnpm-lock.yaml`. Why: built in; add OSV for a second advisory source in scheduled CI.

## Architecture rules
Candidate: `dependency-cruiser` (`.dependency-cruiser.js`, `forbidden` rules, `npx dependency-cruiser --init`, run `depcruise src`). Alternative: Biome `noRestrictedImports` or ESLint `no-restricted-imports` for simple layer bans. Why: dependency-cruiser expresses "layer A must not import layer B", cycles and orphans; the layer rules come from the architecture doc (A1).

## Release and publishing
Candidate: `release-please` (Conventional Commits, release PR, changelog, tag) publishing with npm trusted publishing. Alternative: `changesets` (explicit change files, strong monorepo support). Why: PR titles are already Conventional Commits (V2), so release-please needs no extra files; Changesets fits multi-package workspaces that want per-change release notes. Neither publishes by itself; add the publish job with OIDC.

## Check entry point
Candidate: `package.json` script `"check": "biome ci . && tsc --noEmit && knip && depcruise src && vitest run --coverage"` run as `pnpm check`. Alternative: `just check` (`justfile`) or a `Makefile` target. Why: scripts need no extra tool in a Node repo; pre-commit, CI and the agent all call `pnpm check`.

## Sources
Checked 2026-10-21.
- https://docs.renovatebot.com/modules/manager/npm/ (dep types) 2026-10-21
- https://pnpm.io/settings/dependency-resolution (`minimumReleaseAge` minutes, default 1440 since v11; `trustPolicy`; `blockExoticSubdeps`) 2026-10-21
- https://pnpm.io/settings/build (`allowBuilds`, `strictDepBuilds`) 2026-10-21
- https://pnpm.io/settings (settings live in `pnpm-workspace.yaml`; docs describe pnpm 12) 2026-10-21
- https://pnpm.io/cli/install (`--frozen-lockfile`, CI default) 2026-10-21
- https://pnpm.io/cli/audit (`--audit-level`, `audit signatures`, `audit.*` settings) 2026-10-21
- https://pnpm.io/package_json (`devEngines`, `packageManager`) 2026-10-21
- https://biomejs.dev/guides/getting-started/ and https://biomejs.dev/recipes/continuous-integration/ (`biome ci`) 2026-10-21
- https://www.typescriptlang.org/tsconfig/#strict 2026-10-21 (the `verbatimModuleSyntax` entry was past the fetched text: verify at run time)
- https://vitest.dev/guide/coverage.html and https://vitest.dev/config/coverage 2026-10-21
- https://knip.dev/overview/getting-started and https://knip.dev/reference/configuration 2026-10-21 (exit code on findings is not stated on the page: verify at run time)
- https://github.com/sverweij/dependency-cruiser 2026-10-21 (current version not stated: verify at run time)
- https://nodejs.org/en/about/previous-releases (v26 Current; v24 and v22 LTS) 2026-10-21
- https://docs.npmjs.com/trusted-publishers 2026-10-21
- https://github.com/googleapis/release-please and https://github.com/changesets/changesets 2026-10-21
