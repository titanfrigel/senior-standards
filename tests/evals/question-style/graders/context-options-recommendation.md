---
type: llm
---

The user gave a vague request, so Claude should ask questions before implementing.

PASS if the questions are asked together in one message, numbered, and each question has all three: its context (why it matters or what it changes), two or more options with a short description and trade-offs each, and Claude's recommendation. An open question is acceptable only where options cannot be named yet.
FAIL if the questions are bare ("What should I cache?", "Which TTL?") with no options, or lack context or a recommendation, or are asked one at a time with the rest withheld.
