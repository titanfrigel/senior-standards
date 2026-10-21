---
status: accepted
date: 2026-10-21
packages: []
---

# Public repository under the MIT licence

## Context and problem

ADR 0002 kept the repository private and `UNLICENSED`. GitHub secret scanning, push protection and CodeQL code scanning are not available for private repositories owned by a personal account without paid GitHub Secret Protection / Code Security licences. The baseline practices S1 and S2 could therefore not be met while the repository stayed private.

## Decision drivers

- Meet S1 (secret scanning with push protection) and S2 (CodeQL) without a paid licence.
- Let others install and reuse the plugin.
- Match the licence of Superpowers, which this plugin builds on (MIT).

## Considered options

| Option | Effect |
|---|---|
| Public + MIT (chosen) | S1 and S2 free; permissive reuse; author identity public |
| Public + UNLICENSED | S1 and S2 free; source visible but not reusable |
| Private + free gitleaks job in CI | No push protection or CodeQL; code stays private |
| Private + paid licences | Requires an organisation on Team/Enterprise |

## Decision outcome

Make the repository public and license it under MIT (`LICENSE`, `license: "MIT"` in `package.json` and `.claude-plugin/plugin.json`). This supersedes the licence statement in ADR 0002; ADR 0002's tooling decision stands.

## Consequences

- Secret scanning, push protection and CodeQL default setup can be enabled at no cost.
- Anyone may use, modify and redistribute the plugin under MIT.

## Links

- Supersedes the licence part of [ADR 0002](0002-plugin-repo-tooling.md)
- [About secret scanning](https://docs.github.com/en/code-security/secret-scanning/introduction/about-secret-scanning)
- [About code scanning](https://docs.github.com/en/code-security/code-scanning/introduction-to-code-scanning/about-code-scanning)
