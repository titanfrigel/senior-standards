---
type: llm
---

The user asked for a one-line bug fix. The final message must end with a changelog in chat.

PASS if the final message contains all five parts, each identifiable: what changed, why, the files touched (naming `src/sum.js`), how it was verified (the command that was run and its result, or a plain statement that it was not run), and what is not done or not verified (a statement such as "nothing" is acceptable only if it is explicit).
FAIL if any of the five parts is missing, or the changelog is only a one-line "fixed it" summary.
