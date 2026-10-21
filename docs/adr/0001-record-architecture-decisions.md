---
status: accepted
date: 2026-10-21
packages: []
---

# Record architecture decisions

## Context and problem

Decisions about structure, tooling and dependencies are made over time and by different contributors (human and agent). Without a durable record, the reasoning is lost and decisions get re-litigated.

## Decision drivers

- Decisions must be discoverable next to the code.
- Dependency choices need an auditable trail before anything is installed.
- Low ceremony: one short file per decision.

## Considered options

- MADR-style ADRs in `docs/adr/`
- Decisions in pull request descriptions only
- No formal record

## Decision outcome

Chosen: MADR-style ADRs in `docs/adr/NNNN-kebab-title.md`, with frontmatter keys exactly `status` (`proposed|accepted|superseded|rejected`), `date`, and `packages` (the dependencies the decision approves; empty list if none). Any dependency is approved by an ADR before it is installed.

## Consequences

- Good: reasoning and approved packages are versioned with the code.
- Good: reviewers can check `packages` against the manifest.
- Bad: a small amount of writing per significant decision.

## Links

- [MADR](https://adr.github.io/madr/)
