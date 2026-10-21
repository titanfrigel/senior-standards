---
status: accepted
date: 2026-10-21
packages: []
---

# OpenCode v2 guard mechanism

## Context and problem

The OpenCode adapter (§6.5) must stop an unapproved dependency install and let the user decide. Two mechanisms are possible from `ctx.tool.hook("execute.before")`:

- (a) call `ctx.permission.assert(...)` so the user gets OpenCode's own approval prompt;
- (b) throw an error carrying the reason, which blocks the tool call, and have the agent get approval in chat.

Only a real build can show whether (a) produces a user-facing prompt, and what the hook event and tool inputs look like. A throwaway spike plugin was run on OpenCode **v2.1.2** (Windows, `--standalone`, local Ollama model `qwen3.5:9b`), in `opencode run` and in the TUI.

## Decision drivers

- The user must see a real approval prompt, and a rejection must stop the call (success criterion 2).
- Fail closed when no one can answer (non-interactive runs).
- No dependency on `@opencode/plugin` (§6.5).

## Observed evidence (OpenCode v2.1.2)

**Loading.** A plain default export `{ id: "spike", setup(ctx) }` with no dependency loads when `opencode.json` `"plugins"` lists the plugin's directory, which held `index.js` (and a `package.json`; whether that file is required was not tested). The log shows `msg="loading plugin" … entrypoint=file:///…/plugin/index.js`. In the TUI, `setup` ran three times per launch, so `setup` must be safe to call repeatedly.

**`execute.before` event.** Keys, for every tool: `tool`, `sessionID`, `agent`, `messageID`, `id`, `input`. The call ID is `id` (e.g. `call_fozjhv6w`), not `callID`. Example: `{"tool":"shell","sessionID":"ses_…","agent":"build","messageID":"msg_…","id":"call_…","input":{"command":"echo spike-one"}}`.

**Tool inputs.** Observed in real calls, and checked against `ctx.tool.list()` schemas (`input.fields`):

| Tool | Observed input | Schema fields |
| --- | --- | --- |
| `shell` | `{"command":"echo spike-one"}` | `command`, `workdir`, `timeout`, `background` |
| `write` | `{"path":"b.txt","content":"one"}` | `path`, `content` |
| `edit` | `{"path":"b.txt","oldString":"one","newString":"two"}` | `path`, `oldString`, `newString`, `replaceAll` |
| `patch` | not offered to this model (see below) | `patchText` |

The file field is `path`, not `filePath`; `OPENCODE_FIELDS` is corrected accordingly. `patch` is registered (`ctx.tool.list()`) but was not in the tool set given to the Qwen model, which listed `edit`, `write`, `shell` and others but no `patch`; its field name comes from the schema only.

**`ctx.permission.assert`.** Called from `execute.before` with `{ sessionID, agent, source: { type: "tool", messageID, id }, action: "senior-standards.dependency", resources: ["left-pad"] }`:

| Setup | Result |
| --- | --- |
| No evaluate hook, `opencode run` | The `evaluate` event arrives with `effect: "allow"` (inferred from this: an action with no configured rule defaults to allow); `assert` resolves `undefined` at once; the shell call runs. **No prompt.** |
| Evaluate hook sets `effect = "ask"`, `opencode run` | CLI prints `permission requested: senior-standards.dependency (left-pad); auto-rejecting`; `assert` rejects with `Tool.Error` (`Permission.CorrectedError`), message "This non-interactive run cannot ask the user for permission, so the request was rejected. Continue without this action."; the shell call fails and does not run. |
| Evaluate hook sets `ask`, `opencode run --auto` | `assert` resolves `undefined`; the shell call runs. The guard's `ask` was auto-approved. |
| Evaluate hook sets `ask`, TUI | `assert` blocks. The TUI shows `△ Permission required`, `⚙ Call tool senior-standards.dependency`, `Tool: senior-standards.dependency`, buttons `Allow once` / `Reject`. The pending request (`ctx.permission.list({ sessionID })`) carries `id: "per_…"`, `action`, `resources: ["left-pad"]`, `source`, and the hook's `message`. |
| TUI, answered `once` via `ctx.permission.reply` while the TUI prompt was displayed | `assert` resolves; the shell call runs and prints `left-pad`. |
| TUI, answered `reject` with a message via `ctx.permission.reply` while the TUI prompt was displayed | `assert` rejects with `Tool.Error` (`Permission.CorrectedError`, `feedback` = the message); the tool result the model sees is that message; the turn continues. |
| TUI, answered `reject` without a message via `ctx.permission.reply` while the TUI prompt was displayed | `assert` rejects with `Permission.DeclinedError`; the TUI shows "The user declined this tool call" and the turn is interrupted; the call does not run. |
| TUI, Ctrl-C sent to the terminal tab while the prompt was displayed (delivered by the agent terminal tool `stop_terminal_tab`, which sends Ctrl-C to the tab; not a keypress on the prompt buttons) | `assert` rejects with `Permission.DeclinedError` (spike log `{"tag":"assert-rejected","name":"Permission.DeclinedError",…}`); the TUI shows "The user declined this tool call" and "interrupted". |

The approve and reject answers were sent through `ctx.permission.reply({ sessionID, requestID, decision: "once" | "always" | "reject", message? })` from the spike plugin while the TUI prompt was on screen, because the spike could not press keys in the TUI. This is equivalent to, but not verified identical to, the TUI's own reply path; the prompt itself was observed on screen. The `message` and `resources` were not visible in the TUI's compact prompt; whether the expanded view (`ctrl+f`) shows them was not checked.

The `evaluate` event keys are `sessionID`, `agent`, `action`, `resources`, `metadata`, `source`, `effect`. It also fires for built-in permissions after `execute.before` (e.g. `action: "shell"`, `resources: ["echo left-pad"]`), so the hook must only touch `senior-standards.dependency`.

**Throw fallback.** Throwing `new Error("senior-standards: left-pad is not covered by an accepted ADR; …")` from `execute.before` blocks the call: the tool part has `status: "error"`, `error` = the thrown message verbatim, `providerCall.executed: false`. The model sees the message and continues the turn.

## Considered options

| Option | User-facing prompt | Non-interactive | `--auto` |
| --- | --- | --- | --- |
| (a) `assert` + evaluate hook forcing `ask` | Yes, OpenCode's native prompt | Auto-rejected, call fails | Auto-approved |
| (a′) `assert` alone | No: resolves as allow | Call runs | Not run (expected: call runs) |
| (b) Throw from `execute.before` | No: the agent must ask in chat | Call fails | Not run (expected: call fails) |

## Decision outcome

Chosen: **(a) `ctx.permission.assert` together with a `ctx.permission.hook("evaluate")` that sets `effect = "ask"` and a `message` naming the uncovered packages, only for `action === "senior-standards.dependency"`**. It gives the user OpenCode's native prompt, blocks until answered, and a rejection, or an unanswerable non-interactive run, stops the call. `assert` alone is not enough: with no evaluate hook it resolved as `allow` and no prompt appeared.

The adapter registers the evaluate hook in `setup`, calls `assert` with the hook event's `sessionID`, `agent`, `messageID` and `id`, and lets a rejection propagate (it is OpenCode's own `Tool.Error` / `DeclinedError`, which stops the call). As a design decision (not an observation from the spike), the throw fallback (b) stays for the case where `assert` itself is unavailable or throws something other than a permission rejection.

## Consequences

- Good: the native approval prompt with Allow once / Reject (not compared side by side with a built-in permission prompt).
- Good: non-interactive runs fail closed.
- Bad: `--auto` approved the guard's prompt without showing it (observed). That is the user's explicit choice to auto-approve. Not exercised in the spike: `opencode.exe --help` (v2.1.2) describes the flag as "Auto-approve permissions that are not explicitly denied", and the OpenCode v2 plugin docs say an explicit configured deny is final.
- Bad: the compact TUI prompt shows only the action name, not the packages or the message, so the agent's own chat message should also name the packages.
- Neutral: `OPENCODE_FIELDS` now maps `filePath` from `path` for `write` and `edit`. These names were observed on v2.1.2 only; earlier v2 builds (≥ 2.0.29, A5) were not checked.
- Neutral: `patch` input (`patchText`) is known from the schema only; no model used here was offered the tool.

## Not yet verified

- A human keypress on Allow once / Reject in the TUI prompt. Attempted for v0.1.0 with a small local model, which could not hold enough context to drive the flow; still open.
- Whether the expanded TUI prompt view (`ctrl+f`) shows the resources and message.
- Field names on v2 builds before 2.1.2, and a real `patch` call.
- How OpenCode runs the `execute.before` hooks that repeated `setup` stacks up. The adapter shares a guard decision only while it is in flight, keyed on session, message, call id, tool and a hash of the input, and drops it once settled so a reused call id never gets a stale pass. Hooks run concurrently therefore get one prompt per call; hooks run strictly one after another would each evaluate, and could each prompt, for the same call.
- Whether OpenCode re-imports the plugin module for each `setup`. If it does, the module-level in-flight dedup does not apply across those setups.

## Links

- Spec §6.5, A5
- [OpenCode v2 plugins](https://opencode.ai/v2/docs/build/plugins)
