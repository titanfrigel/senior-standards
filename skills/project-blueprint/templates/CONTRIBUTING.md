# Contributing

## Workflow

- Work on a feature branch named `<type>/<short-topic>`, where `<type>` is a Conventional Commit type (`feat`, `fix`, `docs`, `chore`, ...), for example `feat/csv-export`.
- Open pull requests into the integration branch: <!-- fill: `main`, or `dev` when the project has versioned releases. -->
- <!-- fill: when the project has versioned releases, keep this line: "Releases are pull requests from `dev` into `main`." Otherwise delete it. -->
- One purpose per pull request, with a description of what changed and why. The pull request title follows Conventional Commits; CI checks it.
- Docs are updated in the same pull request as the code: README, requirements, architecture overview and decision records where they exist and are affected.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): summary`, for example `feat(api): add pagination` or `fix: handle empty input`. Keep commits small and single-purpose.

## Language

All code, comments, commit messages, documentation and pull requests are written in English.

## Checks

Run the `check` entry point before pushing; CI runs the same command.

<!-- fill: the exact check command for this project. -->

## Tests

<!-- fill: the project's test extent from the setup record: light (tests on the critical paths), standard (tests written with each feature, in the same pull request) or strict (test-first, coverage threshold enforced in CI). Say what a contributor must do. -->

## Hooks

A secret scanner (gitleaks) runs as a pre-commit hook and again in CI. Install the hooks once after cloning:

<!-- fill: the exact hook install command for this project's hook tool. -->

## Dependencies

A new direct dependency needs an accepted ADR (architecture decision record) in `docs/adr/` that lists it, in the same pull request. CI runs a dependency check and fails the pull request without one. Accepted ADRs are append-only: supersede them with a new ADR, never rewrite them. Use `docs/adr/README.md` for the index and the existing records as the format.

## Review checklist

- `check` passes and new behavior has tests as described above.
- Layer rules in `docs/architecture/overview.md` still hold, when that document exists.
