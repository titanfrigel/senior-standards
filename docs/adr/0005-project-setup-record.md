---
status: accepted
date: 2026-11-14
packages: []
---

# Project setup record in AGENTS.md

## Context and problem

v0.2.0 adds `project-init`, which agrees per project on the docs level, the test extent and three facts (public repository, maintained over time, versioned releases). `project-blueprint`, `repo-standards`, `audit`, the always-on standards, the session-start reminder and the guard's branch-hygiene check all read those answers. They need one durable place that the plugin, other coding agents and collaborators without the plugin can all read.

## Decision drivers

- Readable by people and by any coding agent, not only by this plugin.
- One source of project memory (`AGENTS.md`, per the always-on standards), not a second config file to keep in sync.
- Machine-findable and versioned, so the plugin can read it without a parser dependency and later releases can migrate it.
- Zero runtime dependencies in the plugin.

## Considered options

| Option | Effect |
|---|---|
| `## Project setup` section in the root `AGENTS.md`, with a marker line (chosen) | Already read by most coding agents and by contributors; plain Markdown; one marker to find; parsed with a few lines of `node:*` code |
| Separate `.senior-standards.yml` | Structured, but a second file next to `AGENTS.md`; YAML parsing needs a dependency or a hand-written subset; other agents and collaborators do not read it; tool-branded name ties the project to the plugin |
| Settings in `.claude/` or `.opencode/` config | Harness-specific; invisible to the other harness and to collaborators |

## Decision outcome

Record the setup as a `## Project setup` section in `AGENTS.md` at the repository root (the Git top-level directory; the directory itself when there is no Git repository yet):

```markdown
## Project setup

<!-- senior-standards:setup v1 -->
- Goal: <one or two sentences>
- Docs: basic
- Tests: standard
- Public repository: no
- Maintained over time: yes
- Versioned releases: no
- Overrides: none
- Recorded: 2026-11-14
```

- Values come from fixed lowercase sets: Docs `basic|full`, Tests `light|standard|strict`, the facts `yes|no`.
- The integration branch is derived, not recorded: `dev` when Versioned releases is `yes`, otherwise `main`.
- `Overrides` lists checklist items turned on or off against the defaults, by ID with a reason, or `none`.
- `v1` in the marker versions the format. Only `project-init` changes the record, one setting at a time, updating `Recorded`.
- `core/setup-record.mjs` reads it (first 256 KB, BOM and CRLF tolerant) and reports invalid values as problems.

## Consequences

- Collaborators and other agents see the project's rigour level in the file they already read.
- A repository without the marker gets a session-start reminder to run `project-init` (Claude Code once per session, OpenCode on each turn).
- The format is a contract: changing it needs a new marker version and a migration in `project-init`.
- Binding rules are still enforced by the repository (CI, rulesets), not by the record; the record only decides which ones `repo-standards` sets up.

## Links

- [v0.2.0 project flow design](../specs/2026-11-14-project-flow-design.md), §5.4 and §13
- [ADR 0001](0001-record-architecture-decisions.md)
