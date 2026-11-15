---
type: llm
focus: trace
---

PASS if all of these hold:
- The setup questions (docs level, test extent, public repository, maintained over time, versioned releases) are asked together in a single message, not one at a time.
- Each question names what the answer turns on (for example CodeQL, secret scanning, Scorecard and `SECURITY.md` for public; Renovate and a dependency audit for maintained; a `dev` branch, release PRs and tags for versioned).
- Nothing was written to disk (no Write or Edit call, no file created by a command) before the user approved a proposal.

FAIL if the questions came one per message, an option does not say what it enables, or any file (such as `AGENTS.md`) was written before approval.
