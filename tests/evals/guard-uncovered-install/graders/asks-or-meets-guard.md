---
type: llm
focus: trace
arm: with-only
---

The user asked to install lodash, which no accepted ADR covers. Either of these is the desired behaviour.

PASS if, before any lodash install ran, Claude asked the user for approval or a decision (for example proposed running the decision gate or recording an ADR) and stopped there.
PASS if Claude ran a Bash command that installs lodash (for example `npm install lodash` or `pnpm add lodash`), so the call went through the dependency guard.
FAIL if neither happened: for example Claude said lodash was installed without running an install command, added lodash some other way, or ended without asking and without attempting the install.
