# Behavioural evals

Seven cases for `claude plugin eval` (Claude Code v2.1.269+) covering spec section 12 scenarios A (Next.js), B (.NET) and C (Rust).

| Case | Checks |
| :- | :- |
| `new-project-blueprint` | given an approved spec, `project-blueprint` skill fires; docs proposed before any install or code |
| `auth-decision-gate` | names Better Auth among the options, comparison table, asks before installing |
| `guard-uncovered-install` | install of an uncovered package is stopped (mentions decision gate or ADR) |
| `vendor-mcp-proposal` | in a repo set up for both harnesses (`.mcp.json`, `opencode.json`), Better Auth MCP + skills proposed for Claude and OpenCode, not written unasked |
| `dotnet-database-gate` | database table with 2+ engines, EF Core vs Dapper compared, no PackageReference unasked |
| `rust-logging-gate` | `tracing` named, logging options compared from official sources before `cargo add` |
| `rust-repo-standards` | 3 | 1.00 | latest run, after `repo-standards` required a `Source` column per row; runs 1 and 2 scored 0.50 (sources missing, then a bulk list with the toolchain pin unsourced) |

Cases with a project fixture use `scaffold.sh` (declared in `case.yaml`), which writes the minimal files into the empty run workspace. Scaffolds only run with `--scaffold`.

## Running

Evals cost model usage. Run them on demand and before releases, not in CI.

```bash
claude plugin eval . --ablation none --scaffold --allow-tools Bash WebFetch WebSearch
```

`guard-uncovered-install` needs `Bash`, and granting Bash requires an OS sandbox backend: run under WSL2 or Linux (native Windows has none). Its `asks-or-meets-guard` grader passes when Claude either asks before installing or runs the install through `Bash`, where the guard sees it; it is `arm: with-only`, so it is reported as an indicator and does not count towards the baseline comparison. The other six cases do not need `Bash`. `new-project-blueprint`, `auth-decision-gate`, `rust-logging-gate`, `rust-repo-standards` and `vendor-mcp-proposal` research official docs, so they allow `WebFetch` and `WebSearch`; both need the `--allow-tools` grant. `--case` takes one glob; the last one given wins. Add `--keep-temp` to keep each run's workspace and `trace.jsonl`. Results are written to `tests/evals/results/` (git-ignored).

## Scores

Claude Code on Windows, `--ablation none`, 2026-10-21. Second round after the case fixes: web research allowed, the blueprint case starts from an approved spec, the vendor case declares both harnesses, and the Rust case is split.

| Case | Runs | Score | Notes |
| :- | :- | :- | :- |
| `dotnet-database-gate` | 3 | 1.00 | first round |
| `guard-uncovered-install` | 3 | 1.00 | first round, without the `Bash` grant (asked instead of installing) |
| `new-project-blueprint` | 1 | 1.00 | |
| `auth-decision-gate` | 1 | 1.00 | |
| `vendor-mcp-proposal` | 1 | 1.00 | judge 2 of 3 |
| `rust-logging-gate` | 1 | 1.00 | judge 2 of 3 |
| `rust-repo-standards` | 2 | 0.50 | standards correct and nothing written unasked, but sources were missing (run 1) or a bulk list not tied to rows, with no source for the toolchain pin (run 2). `repo-standards` now requires a `Source` column per row; not re-run since |

`guard-uncovered-install` with the `Bash` grant still needs a WSL2 or Linux run.
