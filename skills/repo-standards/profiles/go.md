# Go profile

Seed defaults, checked against official docs on 2026-10-21. Re-verify each row before presenting it.

## Toolchain pin
Candidate: the `go` directive (minimum version, mandatory since Go 1.21) plus a `toolchain` directive in `go.mod`. Alternative: `mise`/`asdf` `.tool-versions` or `actions/setup-go` with `go-version-file: go.mod`. Why: the `toolchain` line applies only in the main module and lets the `go` command fetch the exact toolchain; `go` limits language features too. Supported lines today are Go 1.27 (latest patch 1.27.3) and 1.26 (1.26.10), both released 2026-10-19.
```
go 1.27
toolchain go1.27.3
```

## Package manager and lockfile
Candidate: Go modules with `go.mod` and `go.sum` committed; CI checks `go mod tidy -diff` (prints the change as a diff and exits non-zero if not tidy). Alternative: `go mod vendor` with `-mod=vendor`. Why: the `go` command already defaults to `-mod=readonly` (since Go 1.16), so builds never edit `go.mod` silently.

## Supply-chain settings
Candidate: the checksum database defaults (`GOSUMDB=sum.golang.org`, `GOFLAGS=-mod=readonly`), `GOPRIVATE`/`GONOSUMDB` only for private module paths, plus `go mod verify` in CI. Alternative: a module proxy you control (`GOPROXY`) with vendoring. Why: `GOSUMDB=off` disables lookups, so never set it globally; `go mod verify` re-hashes the module cache against recorded hashes. No release-age setting exists in Go tooling: delay comes from Renovate `minimumReleaseAge`.

## Build
Candidate: `go build ./...` and `go vet ./...` in CI (`-race` on tests). Alternative: `GOFLAGS=-trimpath` for reproducible release builds. Why: Go has no warnings-as-errors switch; `go vet` failures and linters (below) carry that role.

## Format
Candidate: `golangci-lint fmt` with `gofumpt` and `goimports` enabled in the `formatters` section, checked in CI with `golangci-lint fmt --diff`. Alternative: `gofmt -l .` (stdlib, no extra tool). Why: in golangci-lint v2 formatters (`gci`, `gofmt`, `gofumpt`, `goimports`) live in their own section; `--diff` flag: verify at run time.

## Lint and static analysis
Candidate: `golangci-lint run` (v2: config file with `version: "2"`, `linters.default` of `standard`, `all`, `none` or `fast`; `golangci-lint migrate` converts v1 files). Alternative: `staticcheck` alone. Why: one runner for `govet`, `staticcheck`, `errcheck`, `gosec` and more; start from `standard` and add linters deliberately.

## Type strictness
Candidate: the compiler plus `go vet` and the `staticcheck`/`errcheck` linters, with generics-based APIs over `any`. Alternative: `exhaustive` and `forcetypeassert` linters for stricter checks. Why: Go's type system has no strictness knob; enforcement is through linters enabled in `.golangci.yml`.

## Tests and coverage
Candidate: `go test -race -coverprofile=cover.out ./...` with `go tool cover -func=cover.out`. Alternative: `gotestsum` for CI output plus `go-test-coverage` for thresholds. Why: coverage is built in; there is no built-in threshold, so a small CI step compares the total (and a diff-coverage step for changed code, T1). Integration binaries: `go build -cover` and `GOCOVERDIR` (Go 1.20+).

## Unused code and dependencies
Candidate: `go mod tidy -diff` for dependencies and the `unused` linter in golangci-lint for code. Alternative: `deadcode` (golang.org/x/tools) for unreachable functions from `main`. Why: `go mod tidy` removes unused requirements, so a non-empty diff fails CI.

## Dependency audit
Renovate dependency types (manager `gomod`): `require`, `indirect`, `tool`; there is no dev type, so use `matchDepTypes` `["tool"]` for tool dependencies in D1 (indirect updates are off by default unless matching `tool` directives exist).
Candidate: `govulncheck ./...` (install with `go install golang.org/x/vuln/cmd/govulncheck@latest`; reports only vulnerabilities your code reaches). Alternative: `osv-scanner` on `go.mod`. Why: official Go vulnerability database, low noise; exit codes and the GitHub Action are on pkg.go.dev, not the page fetched (verify at run time).

## Architecture rules
Candidate: `depguard` in golangci-lint (`linters.settings.depguard.rules` with `allow`/`deny` package lists, `$gostd`) plus `internal/` directories, which the compiler enforces. Alternative: `go-arch-lint` with a YAML layer spec. Why: `internal/` and depguard need no extra tool; use depguard `deny` entries per layer package prefix from the architecture doc (A1).

## Release and publishing
Candidate: `goreleaser` (v2: builds, archives, checksums, changelog, GitHub release) triggered by a Git tag, with `release-please` creating the tag. Alternative: `go install` from tags only (libraries publish by tagging; the module proxy serves them). Why: libraries need only a SemVer tag (`v1.2.3`; `/v2` path suffix for major 2+); binaries need GoReleaser.

## Check entry point
Candidate: a `Makefile` or `justfile` target `check` running `go mod tidy -diff`, `golangci-lint fmt --diff`, `golangci-lint run`, `go test -race ./...`, `govulncheck ./...`. Alternative: the `tool` directive in `go.mod` plus `go tool` for pinned dev tools, wrapped by a script. Why: the `tool` directive pins tool versions in `go.mod` so `go tool golangci-lint` is reproducible; a `just` or `make` target chains them.

## Sources
Checked 2026-10-21.
- https://docs.renovatebot.com/modules/manager/gomod/ (dep types) 2026-10-21
- https://go.dev/doc/modules/gomod-ref (`go`, `toolchain`, `tool` directives) 2026-10-21
- https://go.dev/ref/mod (`-mod=readonly`, `go mod tidy -diff`, `go mod verify`, `GOSUMDB`, `GONOSUMDB`) 2026-10-21
- https://go.dev/doc/devel/release (supported releases and patch versions) 2026-10-21
- https://go.dev/doc/build-cover 2026-10-21
- https://go.dev/doc/security/vuln/ 2026-10-21
- https://golangci-lint.run/docs/product/migration-guide/ (v2 config, `formatters`, `migrate`) 2026-10-21; the home and configuration pages did not state the current major version or `fmt --diff`: verify at run time
- https://golangci-lint.run/docs/linters/configuration/ (`depguard`) 2026-10-21
- https://goreleaser.com/ (v2) 2026-10-21
