# Contributing

## Setup and checks

Requires Node >= 22 and pnpm.

```bash
pnpm install
pnpm check    # biome check . && node --test "tests/**/*.test.mjs"
pnpm test     # tests only
```

`pnpm check` must pass before every commit. CI runs it on Linux and Windows.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `test:`, `chore:`, with scopes such as `feat(core):`. Small, single-purpose commits; update docs in the same change as the code.

## Decisions (ADRs)

Every new dependency, including dev dependencies, needs an accepted ADR first. Use the `adr` skill, or copy an existing file in `docs/adr/` (`NNNN-kebab-title.md`, frontmatter `status`, `date`, `packages`). ADRs are append-only: supersede, do not edit history. Regenerate the index after any change:

```bash
node scripts/adr-index.mjs
```

## Before a release

1. `pnpm check`
2. `claude plugin validate . --strict` (not run in CI: there is no unauthenticated CLI install there).
3. Behavioural evals, which cost model usage:
   ```bash
   claude plugin eval . --ablation none --scaffold --allow-tools Bash
   ```
   Run under WSL2 or Linux: granting `Bash` (needed by `guard-uncovered-install`) requires an OS sandbox backend. See `tests/evals/README.md`.
4. The manual scenarios A to C from the README in both harnesses, including a human keypress on the OpenCode approval prompt (Allow once and Reject).

## Releasing

1. Move the Unreleased entries in `CHANGELOG.md` under a new `## [X.Y.Z] - date` heading.
2. Set the same `version` in `package.json` and `.claude-plugin/plugin.json`.
3. Commit `chore(release): X.Y.Z`, then tag `vX.Y.Z`.
4. Update the `#vX.Y.Z` ref in the README's OpenCode install examples.
