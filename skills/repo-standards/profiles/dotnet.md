# .NET profile

Seed defaults, checked against official docs on 2026-10-21. Re-verify each row before presenting it.

## Toolchain pin
Candidate: `global.json` with an exact `sdk.version` and `rollForward`. Alternative: `mise`/`asdf` `.tool-versions` alongside it. Why: `version` must be a full number (no ranges). With the lock files and `--locked-mode` this profile recommends, use `disable` (exact SDK, so SDK and dependency graph stay in lockstep; the docs call this out). Use `latestFeature` (newer patches and feature bands of the same major.minor) only when not using lock files.
```json
{ "sdk": { "version": "10.0.100", "rollForward": "disable" } }
```
Target the current LTS (.NET 10, supported until 2028-11-14; .NET 8 and 9 leave support on 2026-11-10). Do not set `LangVersion` to `latest` (the docs warn it makes builds machine-dependent).

## Package manager and lockfile
Candidate: NuGet with Central Package Management (`Directory.Packages.props`, `ManagePackageVersionsCentrally`) and lock files (`RestorePackagesWithLockFile`, `packages.lock.json`). Alternative: per-project `PackageReference` versions without a lock file. Why: one place for versions; commit the lock file for apps (not for libraries). CI: `dotnet restore --locked-mode` (`RestoreLockedMode`). Enable `CentralPackageTransitivePinningEnabled` to pin vulnerable transitive packages (careful for libraries: pinned packages become explicit dependencies when packed).

## Supply-chain settings
Candidate: NuGet Audit (`NuGetAudit`, `NuGetAuditMode`, `NuGetAuditLevel`) plus package source mapping and Renovate `minimumReleaseAge`. Alternative: a single internal feed that upstreams from nuget.org. Why: NuGet has no release-age setting in the pages checked, so delay comes from Renovate; source mapping stops package substitution (NuGet raises NU1507 with several unmapped sources under CPM). `NuGetAuditMode` defaults to `all` for `net10.0` and higher, `direct` otherwise.

## Build
Candidate: `Directory.Build.props` at the repo root with `TreatWarningsAsErrors`, run as `dotnet build --no-restore -warnaserror`. Alternative: `WarningsAsErrors` for a named subset while migrating. Why: `Directory.Build.props` applies to every project under the folder.
```xml
<Project>
  <PropertyGroup>
    <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
    <Nullable>enable</Nullable>
    <EnforceCodeStyleInBuild>true</EnforceCodeStyleInBuild>
    <AnalysisLevel>latest-Recommended</AnalysisLevel>
  </PropertyGroup>
</Project>
```
The docs note `TreatWarningsAsErrors` affects only the C# compiler, while the `-warnaserror` switch affects all MSBuild tasks (including NuGet warnings).

## Format
Candidate: `dotnet format --verify-no-changes` driven by `.editorconfig`. Alternative: `csharpier` (opinionated formatter, separate tool). Why: built into the SDK, reads the same `.editorconfig`; exits non-zero when files would change.

## Lint and static analysis
Candidate: the SDK analyzers (`Microsoft.CodeAnalysis.NetAnalyzers`, on by default for .NET 5+) with `AnalysisMode`/`AnalysisLevel` raised and `EnforceCodeStyleInBuild`. Alternative: `Roslynator` or `Meziantou.Analyzer` as extra analyzers. Why: no extra package; `AnalysisMode` values are `None`, `Default`, `Minimum`, `Recommended`, `All`. Code-style (IDE) rules only run on command-line builds when `EnforceCodeStyleInBuild` is true and each rule has a warning/error severity in `.editorconfig`. Installing the NetAnalyzers package decouples rule updates from the SDK but then forbids setting `EnableNETAnalyzers`.

## Type strictness
Candidate: `<Nullable>enable</Nullable>` with nullable warnings as errors via `TreatWarningsAsErrors` (or `WarningsAsErrors` with `nullable`). Alternative: `warnings` context while migrating a legacy codebase. Why: default is `disable`; templates since .NET 6 set `enable`. Generated files are excluded from the nullable context.

## Tests and coverage
Candidate: `xunit` with `coverlet.collector` (`dotnet test --collect:"XPlat Code Coverage"`, Cobertura XML) and `ReportGenerator` for reports. Alternative: `MSTest` or `NUnit` with the built-in `dotnet-coverage` collector (`--collect:"Code Coverage"`). Why: Coverlet is the documented open-source path with human-readable output; apply the changed-code threshold (T1) in the CI step reading the Cobertura file (a diff-coverage tool or the coverage service). The page notes `global.json` can select `Microsoft.Testing.Platform` as runner on .NET 10 SDK; verify at run time which runner the chosen framework supports.

## Unused code and dependencies
Candidate: `IDE0005` (unnecessary usings) enforced as a build error through `EnforceCodeStyleInBuild`, plus the `NU1510` warning on .NET 10 for removable package references. Alternative: `Roslynator` unused-member analyzers. Why: IDE0005 on build also needs `GenerateDocumentationFile` set to true (documented limitation); NU1510 comes from package pruning, on by default for .NET 10 targets. No dedicated unused-package CLI is documented by Microsoft: verify at run time.

## Dependency audit
Renovate dev dependency type: the `nuget` manager documents only `docker`, `nuget`, `msbuild-sdk` and `dotnet-sdk` dep types, with no dev type; mark dev-only packages (`PrivateAssets="all"`, `GlobalPackageReference`) via `matchPackageNames` rules for D1 (verify at run time).
Candidate: NuGet Audit during `dotnet restore` with `WarningsAsErrors` for `NU1903;NU1904` (high, critical). Alternative: `dotnet list package --vulnerable --include-transitive` in a scheduled job. Why: the docs recommend a dedicated audit pipeline (a property such as `AuditPipeline`) so new advisories do not break unrelated builds, while local builds keep the warnings.

## Architecture rules
Candidate: `NetArchTest.Rules` as unit tests (`Types.InAssembly(...).That().ResideInNamespace(...).ShouldNot().HaveDependencyOn(...)`). Alternative: `ArchUnitNET`, or separate assemblies per layer so project references enforce direction. Why: runs inside the normal test run, any test framework; project-reference boundaries are the cheapest rule and need no tool.

## Release and publishing
Candidate: `MinVer` (version from Git tags, `PackageReference` with `PrivateAssets="All"`, `MinVerTagPrefix` for `v` tags) with `dotnet pack` and NuGet publishing. Alternative: `Nerdbank.GitVersioning` or `release-please`. Why: tags are the version source, matching V4. Publish with an API key scoped to the package or, if available for the registry, trusted publishing: verify at run time.

## Check entry point
Candidate: a `justfile` (or `Makefile`) target `check` running `dotnet format --verify-no-changes`, `dotnet build -warnaserror`, `dotnet test`. Alternative: a PowerShell or shell script `./check` committed to the repo. Why: .NET has no portable script runner like package scripts; a `just` target works on all platforms and is what pre-commit, CI and the agent call.

## Sources
Checked 2026-10-21.
- https://docs.renovatebot.com/modules/manager/nuget/ (dep types) 2026-10-21
- https://dotnet.microsoft.com/en-us/download/dotnet (.NET 10 LTS active; 8 and 9 end of support 2026-11-10; 11 release candidate) 2026-10-21
- https://learn.microsoft.com/en-us/dotnet/core/tools/global-json 2026-10-21
- https://learn.microsoft.com/en-us/nuget/consume-packages/central-package-management 2026-10-21
- https://learn.microsoft.com/en-us/nuget/consume-packages/package-references-in-project-files (lock files, `--locked-mode`, package pruning) 2026-10-21
- https://learn.microsoft.com/en-us/nuget/concepts/auditing-packages 2026-10-21
- https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/compiler-options/errors-warnings 2026-10-21
- https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/compiler-options/language (`Nullable`, `LangVersion`) 2026-10-21
- https://learn.microsoft.com/en-us/dotnet/core/tools/dotnet-format 2026-10-21
- https://learn.microsoft.com/en-us/dotnet/fundamentals/code-analysis/overview 2026-10-21
- https://learn.microsoft.com/en-us/dotnet/fundamentals/code-analysis/style-rules/ide0005 2026-10-21
- https://learn.microsoft.com/en-us/visualstudio/msbuild/customize-by-directory (`Directory.Build.props`) 2026-10-21
- https://learn.microsoft.com/en-us/dotnet/core/testing/unit-testing-code-coverage 2026-10-21
- https://github.com/BenMorris/NetArchTest and https://github.com/adamralph/minver 2026-10-21
