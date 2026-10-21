# Python profile

Seed defaults, checked against official docs on 2026-10-21. Re-verify each row before presenting it.

## Toolchain pin
Candidate: `.python-version` (created with `uv python pin`) plus `requires-python` in `pyproject.toml`. Alternative: `mise` or `pyenv` `.python-version`. Why: `requires-python` declares the supported range, `.python-version` the one interpreter used for dev and CI; uv honors both.

## Package manager and lockfile
Candidate: `uv` with `uv.lock` committed; CI runs `uv sync --locked` (errors if the lockfile is out of date) and `uv lock --check`. Alternative: `poetry` with `poetry.lock`, or `pip-tools`. Why: `--frozen` skips the up-to-date check, so use `--locked` in CI. New releases never make the lockfile outdated; `uv lock --upgrade` does that deliberately. The uv sync page does not say to commit `uv.lock`: commit it for applications and for library CI.

## Supply-chain settings
Candidate: `exclude-newer` in `pyproject.toml` `[tool.uv]` (RFC 3339 timestamp or a duration such as `"7 days"`; `exclude-newer-package` exempts packages) plus Renovate `minimumReleaseAge`. Alternative: `pip` `--uploaded-prior-to` style options or a private index mirror with an age gate. Why: uv resolves only versions older than the cutoff. Optionally `UV_MALWARE_CHECK=1` (preview OSV lookup on sync; verify status at run time). Publish with PyPI trusted publishing (OIDC, short-lived project-scoped token) instead of API tokens.
```toml
[tool.uv]
exclude-newer = "7 days"
```

## Build
Candidate: `uv build` with a standards-based backend declared in `[build-system]` (`hatchling` or `uv_build`). Alternative: `setuptools` or `flit-core`. Why: PEP 517 backends are interchangeable; apps that are not packaged need no build step beyond `uv sync --locked` and the type-check.

## Format
Candidate: `ruff format --check .` (exit 1 when files would change). Alternative: `black`. Why: Ruff's formatter is one tool with the linter; same `[tool.ruff]` table.

## Lint and static analysis
Candidate: `ruff check .` with explicit `select` in `[tool.ruff.lint]` (for example `E`, `F`, `I`, `B`, `UP`, `S`). Alternative: `flake8` plus plugins, or `pylint`. Why: fast, one config; choose rule families deliberately rather than `ALL`.

## Type strictness
Candidate: `pyright` with `typeCheckingMode = "strict"` in `[tool.pyright]` (modes: `off`, `basic`, `standard` default, `strict`). Alternative: `mypy --strict` (`strict = true` in `[tool.mypy]`; the strict flag list can change between releases). Why: both are mature; pick one, not both. Strict mode overrides can only increase strictness.

## Tests and coverage
Candidate: `pytest` (config in `pyproject.toml`) with `coverage` (`[tool.coverage.run] branch = true`, `[tool.coverage.report] fail_under = <n>`; exit status 2 below it) via `pytest-cov`. Alternative: `unittest` with `coverage`. Why: pytest 9.x needs Python 3.10+; `fail_under` gives the project-wide floor, use a diff-coverage step (`diff-cover`) for changed code (T1).

## Unused code and dependencies
Candidate: `deptry .` (finds unused, missing and transitive dependencies; config in `[tool.deptry]`). Alternative: `vulture` for unused code. Why: deptry compares imports with declared dependencies (codes DEP001 missing, DEP002 unused); Ruff's `F401`/`F841` rules already cover unused imports and variables.

## Dependency audit
Renovate dev dependency types (manager `pep621`): `dependency-groups`, `project.optional-dependencies`, `tool.uv.dev-dependencies`, `tool.pdm.dev-dependencies`; use them in `matchDepTypes` for D1.
Candidate: `uv export --format pylock.toml --output-file pylock.toml` then `pip-audit --locked .` (pip-audit `--locked` supports only `pyproject.toml` and `pylock.*.toml`, not `uv.lock`, so export first; exit 1 on findings; PyPA advisory database via PyPI, or OSV). Fallback: export a pinned requirements file and run `pip-audit --no-deps --disable-pip -r requirements.txt` (`--no-deps` fails if any requirement is not exactly pinned). Alternative: `uv audit` (reads `uv.lock`, queries OSV, non-zero on findings), which Astral's blog announces as preview with an unstable interface. Why: pip-audit is stable and PyPA-maintained, but the `uv export` flags beyond `--format` and `--output-file` (such as `-o` and hash options) are not documented on the page checked, so verify them at run time; switch to uv audit when it leaves preview (verify at run time).

## Architecture rules
Candidate: `import-linter` (`lint-imports`; contract types `layers`, `forbidden`, `independence`; config in `.importlinter` with `root_package`). Alternative: `ruff` `flake8-tidy-imports` banned imports (`TID` rules) for simple bans. Why: import-linter expresses layers directly and fails CI; the page documents `.importlinter`, not `pyproject.toml`.

## Release and publishing
Candidate: `release-please` (Python release type) or `python-semantic-release`, then `uv publish` through PyPI trusted publishing. Alternative: `hatch-vcs` or `setuptools-scm` (version from Git tags) with a manual tag. Why: release-please follows Conventional Commits and does not publish, so the publish job uses OIDC (`id-token: write`, no stored token).

## Check entry point
Candidate: a `justfile` target `check` (`ruff format --check .`, `ruff check .`, `pyright`, `deptry .`, `lint-imports`, `pytest --cov`). Alternative: `Makefile`, or `nox`/`tox` sessions. Why: Python has no standard script runner for multi-command tasks; `just` works across platforms and keeps pre-commit, CI and the agent on one command.

## Sources
Checked 2026-10-21.
- https://docs.astral.sh/uv/concepts/projects/sync/ (`--locked`, `--frozen`, `uv lock --check`) 2026-10-21
- https://docs.astral.sh/uv/reference/settings/#exclude-newer (`exclude-newer`, `exclude-newer-package`) 2026-10-21
- https://docs.astral.sh/uv/concepts/python-versions/ (`.python-version`) 2026-10-21
- https://docs.astral.sh/ruff/linter/ and https://docs.astral.sh/ruff/formatter/ 2026-10-21
- https://raw.githubusercontent.com/microsoft/pyright/main/docs/configuration.md (`typeCheckingMode`) 2026-10-21
- https://mypy.readthedocs.io/en/stable/command_line.html#cmdoption-mypy-strict 2026-10-21
- https://docs.pytest.org/en/stable/ (the page does not document the `pyproject.toml` table name: verify at run time) 2026-10-21
- https://coverage.readthedocs.io/en/latest/config.html 2026-10-21
- https://github.com/osprey-oss/deptry 2026-10-21
- https://pypi.org/project/pip-audit/ (`--locked` supports only `pyproject.toml` and `pylock.*.toml`; `uv.lock` not mentioned) 2026-10-21
- https://docs.astral.sh/uv/concepts/projects/export/ (`uv export --format pylock.toml`, `--output-file`) 2026-10-21
- https://docs.renovatebot.com/modules/manager/pep621/ (dev dep types; `uv.lock` handled) 2026-10-21
- https://astral.sh/blog/uv-audit (found via search; the docs.astral.sh reference page for `uv audit` was not found: verify at run time) 2026-10-21
- https://import-linter.readthedocs.io/en/stable/ 2026-10-21
- https://docs.pypi.org/trusted-publishers/ 2026-10-21
- https://github.com/googleapis/release-please 2026-10-21
