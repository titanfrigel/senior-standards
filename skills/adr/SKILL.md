---
name: adr
description: Use when recording an architecture or dependency decision, creating or superseding an ADR in docs/adr, changing an ADR's status, or regenerating the ADR index, in any language or repository.
---

# ADR management

ADRs live in `docs/adr/NNNN-kebab-title.md`, are written from `template.md` (next to this file), and are append-only. The `packages:` list of every `status: accepted` ADR is what the install guard treats as approved.

## Create

1. List `docs/adr/`; the new number is the highest existing 4-digit prefix plus one (`0001` if the directory is empty or missing; create it).
2. Name the file `NNNN-kebab-title.md`: lowercase, hyphens, short, describes the decision topic.
3. Copy `template.md` and fill every section. Keep the frontmatter keys exactly `status`, `date`, `packages`.
4. Set `status: accepted` only after the user has answered. Use `proposed` while the question is open (or nobody can answer) and `rejected` when the user turns a direction down for good. Only `accepted` ADRs approve packages; `proposed` never authorises an install.
5. `packages:` is an inline list of the exact registry names approved (`[pg, drizzle-orm]`, `[Npgsql]`, `[tokio]`); `[]` when nothing is installed.
6. Run the reindex step.

## Supersede

1. Create the new ADR as above with `status: accepted`; state in Context what changed, and link the old ADR under Links.
2. In the old ADR change only `status:` to `superseded` and add a link to the new ADR under Links. This is the only edit allowed to an accepted ADR; never rewrite its context, options or outcome.
3. The old ADR's `packages:` stop counting as approved once it is superseded. Repeat any still-wanted package in the new ADR.
4. Run the reindex step.

## Reindex

Run `node <plugin root>/scripts/adr-index.mjs <project dir>` — the plugin root is `${CLAUDE_PLUGIN_ROOT}` in Claude Code; in OpenCode it is two directories above this SKILL.md file. It rewrites `docs/adr/README.md` (number, title, status, date), is idempotent, and exits non-zero if `docs/adr/` is missing. Commit the regenerated index with the ADR.
