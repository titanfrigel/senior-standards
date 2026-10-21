# Rust profile

Seed defaults, checked against official docs on 2026-10-21. Re-verify each row before presenting it.

## Toolchain pin
Candidate: `rust-toolchain.toml` with `[toolchain]` `channel`, `components`, `profile`. Alternative: the `rust-version` field in `Cargo.toml` (MSRV only, does not select a toolchain). Why: rustup reads the file for everyone and CI. Pin an exact stable release for apps; the Rust blog's latest-release page points to a 1.99.1 announcement dated 2026-10-15 (not confirmed on the page: verify at run time).
```toml
[toolchain]
channel = "1.99.1"
components = ["rustfmt", "clippy"]
profile = "minimal"
```

## Package manager and lockfile
Candidate: `cargo` with `Cargo.lock` committed (commit it for applications; for libraries decide and record it in the ADR) and `--locked` in CI. Alternative: `cargo --frozen` (adds `--offline`) or `cargo vendor`. Why: `--locked` errors if the lockfile is missing or resolution would change it; `--frozen` also blocks network access.

## Supply-chain settings
Candidate: `cargo-deny` `bans` and `sources` checks (`deny.toml`, only allow crates.io) plus Renovate `minimumReleaseAge`. Alternative: Cargo's own minimum publish age, which is RFC 3923 (nightly settings `registry.global-min-publish-age`): do not rely on it until stable. Why: the stable Cargo config in the docs has no release-age option, so the delay lives in Renovate. Publish with crates.io trusted publishing (OIDC): verify the current setup page at run time (the docs page fetched had no content).

## Build
Candidate: `cargo build --locked` with `RUSTFLAGS="-D warnings"` in CI and a `[lints]` table in `Cargo.toml`. Alternative: `[workspace.lints]` shared by members (`[lints] workspace = true`). Why: the `[lints]` table sets levels (`forbid`, `deny`, `warn`, `allow`) per tool, for the current package only, so workspaces need `workspace = true` per member.
```toml
[lints.rust]
unsafe_code = "forbid"

[lints.clippy]
enum_glob_use = "deny"
```

## Format
Candidate: `cargo fmt --all --check` (`rustfmt.toml` only for deliberate deviations). Alternative: `cargo +nightly fmt` when unstable rustfmt options are needed. Why: rustfmt ships with the toolchain via the `rustfmt` component.

## Lint and static analysis
Candidate: `cargo clippy --all-targets --locked -- -D warnings`. Alternative: `RUSTFLAGS="-Dwarnings"` for every cargo command. Why: the Clippy CI docs give `-D warnings` as the way to fail CI; use the same toolchain for Clippy and the build.

## Type strictness
Candidate: the compiler itself plus `[lints.rust]` `unsafe_code = "forbid"` and `[lints.clippy]` pedantic groups chosen deliberately. Alternative: `#![forbid(unsafe_code)]` in `lib.rs`. Why: Rust has no looser type mode to tighten; strictness means forbidding `unsafe` and denying lint groups, set in `Cargo.toml` so CI and editors agree.

## Tests and coverage
Candidate: `cargo test --locked` with `cargo-llvm-cov` (`cargo llvm-cov --fail-under-lines <n>`, `--lcov --output-path lcov.info`). Alternative: `cargo-tarpaulin` or `cargo nextest` for the runner. Why: llvm-cov uses the compiler's instrumentation (needs rustc 1.87+) and fails with status 1 below the threshold; use the lcov report with a diff-coverage step for the changed-code threshold (T1).

## Unused code and dependencies
Candidate: `cargo-machete` (`cargo machete`; exit 1 when unused dependencies are found; `[package.metadata.cargo-machete]` `ignored` for false positives). Alternative: `cargo-udeps` (nightly, more precise, slower). Why: fast; the project calls itself imprecise, so keep the ignore list reviewed. Dead code in your own crate is already a compiler warning, denied by `-D warnings`.

## Dependency audit
Renovate dev dependency type (manager `cargo`): the Renovate docs list no documented dep types, so match by `matchManagers` `["cargo"]` and `matchPackageNames` for dev-only crates (verify at run time).
Candidate: `cargo-deny` (`cargo deny check` runs advisories, bans, licenses, sources; `cargo deny init` writes `deny.toml`; install with `cargo install --locked cargo-deny`). Alternative: `cargo-audit` (RustSec only; `cargo audit` scans `Cargo.lock`). Why: one tool covers advisories and the license allowlist (D5) and source bans.

## Architecture rules
Candidate: a Cargo workspace with one crate per layer, so `Cargo.toml` dependencies enforce direction, plus `cargo-deny` `bans` (`deny`/`skip` entries) for forbidden crates. Alternative: `cargo-modules` or `cargo-depgraph` to inspect and review the graph. Why: crate boundaries are compiler-enforced; no maintained module-level layer linter was verified, so say so in the ADR (verify at run time).

## Release and publishing
Candidate: `release-plz` (release PR from Conventional Commits, changelog, git tag, publish to any cargo registry). Alternative: `cargo-release` (local, explicit) or `release-please`. Why: release-plz is Rust-native and matches V2/V4; its docs do not cover trusted publishing, so check crates.io docs for the OIDC publish step.

## Check entry point
Candidate: a cargo alias in `.cargo/config.toml` (for example `check-all`) or a `justfile` target `check` running `cargo fmt --all --check`, `cargo clippy ... -D warnings`, `cargo test --locked`, `cargo machete`, `cargo deny check`. Alternative: `cargo xtask check` (a workspace crate; no extra tool). Why: aliases cannot chain several commands, so use `just` or an `xtask` crate for the full set.

## Sources
Checked 2026-10-21.
- https://docs.renovatebot.com/modules/manager/cargo/ (no documented dep types) 2026-10-21
- https://rust-lang.github.io/rustup/overrides.html (`rust-toolchain.toml`) 2026-10-21
- https://doc.rust-lang.org/cargo/reference/manifest.html#the-lints-section 2026-10-21 (`[workspace.lints]` not on that page: verify at run time)
- https://doc.rust-lang.org/cargo/commands/cargo-build.html (`--locked`, `--frozen`) 2026-10-21
- https://doc.rust-lang.org/cargo/reference/config.html (resolver settings: no stable release-age option) 2026-10-21
- https://rust-lang.github.io/rfcs/3923-cargo-min-publish-age.html (RFC, status not confirmed: verify at run time) 2026-10-21
- https://doc.rust-lang.org/clippy/continuous_integration/index.html 2026-10-21
- https://embarkstudios.github.io/cargo-deny/ 2026-10-21
- https://github.com/bnjbvr/cargo-machete 2026-10-21
- https://github.com/taiki-e/cargo-llvm-cov 2026-10-21
- https://rustsec.org/ (cargo-audit install and flags not on the page: verify at run time) 2026-10-21
- https://release-plz.dev/docs 2026-10-21
- https://blog.rust-lang.org/releases/latest/ (stable version not stated on the page: verify at run time) 2026-10-21
- https://crates.io/docs/trusted-publishing (page returned no content: verify at run time) 2026-10-21
