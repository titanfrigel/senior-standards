# Contributing

## Branching

<!-- fill: branch model, for example trunk-based with short-lived branches named type/short-description. -->

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): summary`, for example `feat(api): add pagination` or `fix: handle empty input`. Keep commits small and single-purpose.

## Checks

Run the `check` entry point before pushing; CI runs the same command.

<!-- fill: the exact check command for this project. -->

## Architecture decisions

Record every architecture, dependency or service decision as an ADR in `docs/adr/`. Use the `adr` skill (`senior-standards:adr`), which numbers the file, applies the template and regenerates `docs/adr/README.md`. New dependencies, services, databases and hosting providers go through the `decision-gate` skill first. Accepted ADRs are append-only: supersede them, never rewrite them.

## Pull requests

- One purpose per pull request, with a description of what changed and why.
- Docs are updated in the same pull request as the code: README, requirements, architecture overview and ADRs where affected.
- `check` passes and new behavior has tests.
- Layer rules in `docs/architecture/overview.md` still hold.
