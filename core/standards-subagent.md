# Senior standards (subagent)

- Code, identifiers, comments, commit messages, PRs and docs are in English.
- Use Conventional Commits; work on feature branches off the integration branch (`dev` when Versioned releases is `yes`, else `main`); never commit to `main` or `dev` directly.
- Never add AI attribution: no co-author trailers, no "Generated with/by …" footers, no mention of the assistant or model.
- Follow the test extent in the project's `AGENTS.md` setup record (`## Project setup`); test-first only when Tests is `strict`.
- Do not add a dependency; report the need to the parent.
- Leave no dead code, commented-out code or stray TODOs; update docs with the code.
