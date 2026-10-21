---
name: decision-gate
description: Use when about to add, choose or propose a dependency, library, framework, external service, database, hosting provider or paid API, in any language or ecosystem, including in existing repositories, and before any install command runs.
---

# Decision gate

Nothing is installed, signed up for or wired in until the user has answered and an ADR exists. Custom code for infrastructure concerns (auth, payments, email, queues, validation, ORM, dates, i18n) is one option among others, never the silent default.

## Scope

The gate applies to: runtime, dev, test and build dependencies; globally installed tools; CI actions and third-party workflow steps; major-version upgrades of an existing dependency; and services (SaaS, databases, hosting, auth providers, paid APIs, AI/LLM APIs, telemetry). A dependency an installer pulls in counts only if it becomes a direct dependency; transitive ones do not.

If the user or an approved spec already names the choice, still run the gate in short form: verify it against official sources (including package health), confirm the exact package list with the user, then write the ADR. Naming a product is not approval of packages it was not listed with.

## Steps

1. **Frame the decision.** State the need, the constraints (read `requirements.md` or the approved spec) and the category: library, framework, service, database, hosting, paid API.
2. **Research current facts from official sources.** Fetch vendor docs, pricing pages, registry pages and advisory databases. Never state pricing, limits, versions or maturity from memory. Use the vendor's docs MCP or `llms.txt` when present.
3. **Present 2-4 options** in the table below. Include "build it ourselves" only when it is realistic for the team and scope. Under the table, list the sources: each URL you relied on, with the date you fetched it. A fact without a listed source is marked unverified.
4. **Recommend one option, then ask.** Ask the user with the harness's structured-question tool if it has one, otherwise in chat. List the recommended option first and say why. Stop until the user answers.
   - If the user rejects every option or asks for more, research further and ask again. When a considered direction is turned down for good, record it as a `rejected` ADR.
   - If nobody can answer (autonomous or non-interactive run), stop: write a `proposed` ADR with the comparison and recommendation, and do not install or wire anything.
5. **Write the ADR after the answer**, using `adr` (`senior-standards:adr`). Set `status: accepted` and fill `packages:`; record rejected options under "Considered options". A `proposed` ADR never authorises an install; only `accepted` ADRs count, and the install guard enforces the same.
6. **Hand off to `official-integration`** (`senior-standards:official-integration`) to install and configure from the vendor's documented method.

## Criteria table

| Criterion | Option A | Option B | ... |
|---|---|---|---|
| Fit for the requirements | | | |
| Maturity and maintenance | | | |
| **Package health**: last publish, maintainers, provenance / trusted publishing, weekly downloads, open advisories | | | |
| License | | | |
| Cost now and at scale | | | |
| Lock-in and exit cost | | | |
| Security and compliance posture | | | |
| DX and type safety | | | |
| Official AI tooling (MCP server, skills, llms.txt) | | | |

## Package health: where to look

Use the registry and advisory data, not search-engine summaries. Check every candidate package, not just the headline one.

| Ecosystem | Last publish, maintainers, provenance | Downloads | Advisories |
|---|---|---|---|
| npm | `npm view <pkg> time.modified maintainers dist.attestations`; registry page shows provenance | npm downloads API (`api.npmjs.org/downloads/point/last-week/<pkg>`) | `npm audit`, GitHub Advisory Database, OSV |
| PyPI | `https://pypi.org/pypi/<pkg>/json` (upload times, maintainers; trusted publishing shown on the project page) | pypistats.org | OSV, GitHub Advisory Database, PyPA advisory DB |
| crates.io | crates.io page or `https://crates.io/api/v1/crates/<crate>` (versions, owners) | crates.io API recent downloads | RustSec advisory DB (`cargo audit`), OSV |
| NuGet | nuget.org package page or `https://api.nuget.org/v3/index.json` (listing, owners, signed/repository-signed) | nuget.org total and per-version downloads | GitHub Advisory Database, `dotnet list package --vulnerable` |
| Go modules | pkg.go.dev (published date, license, imports count) and the module's repository | pkg.go.dev "imported by" | Go vulnerability DB (`govulncheck`), OSV |
| Other | The ecosystem's official registry | Registry statistics | OSV (`osv.dev`) |

Flag: no release in a long time with open issues, a single maintainer on a critical path, no provenance where the ecosystem supports it, recent maintainer or ownership changes, unpatched advisories, or abnormally low adoption.

## Services, databases, hosting and paid APIs

- Compare pricing tiers, quotas, regions, data residency, export path and SLA from the vendor's pages.
- `packages:` lists the SDK or driver packages the project will install (`[@aws-sdk/client-s3]`, `[Npgsql]`, `[stripe]`); use `[]` when nothing is installed (a hosting choice, a managed service called over HTTP).
- Record credentials handling and the exit path under Consequences.

## Rules

- Tightly coupled choices (for example a database and its ORM, or the repo baseline) may be one decision: one ADR listing all packages.
- A package not in the answer is not approved. If the plan grows a new dependency, run the gate again.
- Do not run the install command, even "just to try it", before the ADR is accepted.
