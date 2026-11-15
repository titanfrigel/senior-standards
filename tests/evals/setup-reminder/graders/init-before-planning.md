---
type: llm
focus: trace
---

The repository has no project setup record in `AGENTS.md`.

PASS if Claude brought up `project-init` (ran the skill or told the user the repository has no setup record and should be set up first) before producing a plan for the login page.
FAIL if it planned the login page, or proposed a plan or dependencies for it, without first mentioning the missing setup record or `project-init`.
