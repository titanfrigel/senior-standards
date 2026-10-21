# senior-standards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `senior-standards`, a Claude Code + OpenCode v2 plugin that adds a documented-blueprint step, an ask-before-deciding gate, official-only integrations and a dependency guard on top of Superpowers.

**Architecture:** A harness-agnostic `core/` (pure ES modules: install parsing, ADR index, manifest diff, call normalisation, evaluation, standards text) used by two thin adapters: Claude Code hooks (`adapters/claude/`) and an OpenCode v2 plugin (`adapters/opencode/`). Skills in `skills/` are shared verbatim by both harnesses. The repo root is both a Claude marketplace and an OpenCode plugin package.

**Tech Stack:** Node ≥ 22 built-ins only at runtime (`node:fs`, `node:path`, `node:test`, `node:assert`); OpenCode runs the same modules under Bun. Markdown skills (Agent Skills format). GitHub Actions.

**Spec:** `docs/specs/2026-10-21-senior-standards-design.md` (v3.1). Section references below (§n) point into it.

## Global Constraints

- Zero runtime dependencies. Every runtime file imports only `node:*` built-ins or other repo files.
- Any dev dependency for the plugin repo itself goes through the decision gate in chat and gets an ADR before install (§5.1). Task 0 is the only place one is proposed.
- All code is ES modules (`.mjs`, or `.js` under `"type": "module"`), cross-platform: never build paths with string concatenation, always `node:path`; accept both `\` and `/` in incoming paths.
- Claude hooks use exec form: `"command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/…"]` (§6.4).
- The guard never returns or grants `allow`; outcomes are `pass` (no output) or `ask` (§6.3).
- Adapters never let an exception escape into the host, except the deliberate OpenCode guard fallback throw (§6.5, §11).
- Skill frontmatter: only `name` (lowercase, single hyphens, ≤ 64 chars, equals folder name) and `description` (≤ 1024 chars) (§4.4).
- Skill bodies name actions, not harness tools (§4.4).
- ADR frontmatter keys exactly: `status` (`proposed|accepted|superseded|rejected`), `date`, `packages` (§6.2).
- Plugin name `senior-standards`; marketplace name `senior-standards`; OpenCode plugin id `senior-standards`.
- OpenCode target: v2 ≥ 2.0.29 only (A5).
- Conventional Commits for every commit; each commit message ends with the `Co-Authored-By` trailer the session requires.
- Docs locations: specs `docs/specs/`, plans `docs/plans/`, ADRs `docs/adr/NNNN-kebab-title.md`.

## Review Focus

1. **Windows-shaped input.** `file_path` like `C:\proj\web\package.json` or `web/package.json`, CRLF in ADR files and `package.json`, a UTF-8 BOM on stdin. Expected: detected and parsed exactly like POSIX/LF input. Tests in Tasks 2, 3, 6.
2. **Real-world install commands.** `cd web && pnpm add zod`, `FOO=1 npm i -D vitest`, `pnpm --filter web add zod`, `npm install --save-exact zod@3.23.8`, `pnpm add -D @types/node@^22`, `pip install "requests[socks]>=2"`. Expected: the right package names, nothing else. Tests in Task 1.
3. **Non-registry specs.** `pnpm add ./packages/ui`, `npm i github:user/repo`, `workspace:*` in a `package.json` diff. Expected: local paths and `workspace:` are internal and pass; git/URL/tarball specs are external and `ask`, named by the spec itself. Tests in Tasks 1 and 3.
4. **Missing or broken ADR log.** No `docs/adr/`, an ADR without frontmatter, `packages:` as a block list, an unreadable file. Expected: no crash; only well-formed `accepted` ADRs approve anything; broken files are reported in the reason. Tests in Task 2.
5. **First write of `package.json` and invalid JSON mid-edit.** Expected: on a new file every dependency counts as added; unparseable JSON → `ask` with "could not parse package.json". Tests in Tasks 3 and 5.

---

### Task 0: Repository baseline

**Files:**
- Create: `package.json`, `.gitattributes`, `.editorconfig`, `.gitignore`, `.node-version`, `CHANGELOG.md`, `SECURITY.md`, `docs/adr/0001-record-architecture-decisions.md`, `docs/adr/0002-plugin-repo-tooling.md`, `.github/workflows/ci.yml`, `.github/pull_request_template.md`, `renovate.json`

**Interfaces:**
- Produces: `npm test` → `node --test "tests/**/*.test.mjs"`; `npm run check` → test + the tooling decided in ADR 0002. Later tasks only rely on these two script names.

- [ ] **Step 1: Write `package.json`**

`name: "senior-standards"`, `version: "0.0.0"`, `private: true`, `type: "module"`, `main: "index.js"`, `exports: { ".": "./index.js" }`, `engines.node: ">=22"`, no `dependencies`. `license` set from the user's answer in Step 2.

- [ ] **Step 2: Ask the user (decision gate, in chat) two things before writing anything else**
  1. License for a private repo: `UNLICENSED` (no LICENSE file) vs MIT.
  2. Repo tooling as one bundled decision: package manager for the plugin repo (pnpm per §16.3) and Biome as the single dev dependency (§16.2), vs no dev dependencies at all (`node --check` + `node --test` only). Present the trade-off in a table and recommend pnpm + Biome.

Record the answers in `docs/adr/0002-plugin-repo-tooling.md` with `status: accepted` and `packages:` listing exactly the approved dev dependencies. Install only via the official command (`pnpm add -D @biomejs/biome` after verifying the name on biomejs.dev).

- [ ] **Step 3: Write the remaining baseline files**
- `.gitattributes`: `* text=auto eol=lf` (R4).
- `.node-version`: current Node LTS major (check nodejs.org).
- `docs/adr/0001-…`: MADR, `status: accepted`, `packages: []`.
- `ci.yml`: matrix `ubuntu-latest`, `windows-latest`; `permissions: contents: read`; actions pinned by full SHA; runs `npm run check` (or `pnpm check`). Add `claude plugin validate . --strict` in Task 7 once manifests exist.
- `renovate.json`: `minimumReleaseAge: "3 days"`, pin Action digests, group dev dependencies (D1).
- `pull_request_template.md`: links to spec/plan/ADR, "docs updated" checkbox (R2).
- `SECURITY.md`: private reporting contact `kling.gaetan@gmail.com`.

- [ ] **Step 4: Verify**

Run: `npm run check` → Expected: the tooling part passes; `node --test` reports no test files, which is acceptable until Task 1 adds the first ones (CI goes green from Task 1 on).

- [ ] **Step 5: Commit** — `chore: repository baseline and tooling ADRs`

---

### Task 1: `core/parse-install.mjs`

**Files:**
- Create: `core/parse-install.mjs`
- Test: `tests/core/parse-install.test.mjs`

**Interfaces:**
- Produces:
  - `splitCommand(command: string): string[]` — splits on `&&`, `||`, `;`, `|`, newlines, outside quotes; trims; drops empties.
  - `parseInstall(command: string): Array<{ manager: string, packages: string[], external: string[] }>` — one entry per segment that adds dependencies. `packages` are registry names with version specifiers removed; `external` are git/URL/tarball specs kept verbatim. Local paths (`./`, `../`, absolute, `file:`, `link:`, `workspace:`) are dropped.

- [ ] **Step 1: Write the failing tests**

Table-driven `test("parseInstall: <command>")` cases, asserting `deepStrictEqual` on the result:

| Command | Expected |
|---|---|
| `npm install zod` | `[{manager:"npm", packages:["zod"], external:[]}]` |
| `npm i -D vitest @types/node@^22` | npm, `["vitest","@types/node"]` |
| `npm install --save-exact zod@3.23.8` | npm, `["zod"]` |
| `pnpm add -D @biomejs/biome` | pnpm, `["@biomejs/biome"]` |
| `pnpm --filter web add zod` | pnpm, `["zod"]` |
| `yarn add react react-dom` | yarn, `["react","react-dom"]` |
| `bun add hono` | bun, `["hono"]` |
| `cd web && pnpm add zod` | pnpm, `["zod"]` |
| `FOO=1 npm i -D vitest` | npm, `["vitest"]` |
| `pip install "requests[socks]>=2" flask==3.0` | pip, `["requests","flask"]` |
| `pip install -r requirements.txt` | `[]` |
| `pip install -e .` | `[]` |
| `uv add httpx` / `poetry add httpx` | uv / poetry, `["httpx"]` |
| `cargo add serde --features derive` | cargo, `["serde"]` |
| `go get github.com/gin-gonic/gin@v1.10.0` | go, `["github.com/gin-gonic/gin"]` |
| `composer require laravel/sanctum` | composer, `["laravel/sanctum"]` |
| `dotnet add package Serilog --version 4.0.0` | dotnet, `["Serilog"]` |
| `npm i github:user/repo` | npm, `[]`, external `["github:user/repo"]` |
| `pnpm add ./packages/ui` | `[]` |
| `npm install` / `pnpm install` / `npm ci` / `pnpm i --frozen-lockfile` | `[]` |
| `npx create-next-app@latest` / `pnpm dlx x` / `bunx x` | `[]` |
| `npm uninstall zod` / `pnpm remove zod` | `[]` |
| `echo "npm install zod"` | `[]` |
| `npm install zod; yarn add lodash` | two entries, npm `["zod"]`, yarn `["lodash"]` |

Plus `splitCommand('a && "b && c" ; d')` → `['a', '"b && c"', 'd']`.

- [ ] **Step 2: Run, verify failure**

Run: `node --test tests/core/parse-install.test.mjs` → Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

Tokenise each segment with a quote-aware splitter. Skip leading `VAR=value` tokens. Identify the manager by the first token and the add subcommand per §6.1. Drop flags; for flags known to take a value (`--filter`, `-F`, `--version`, `--features`, `-C`, `--prefix`, `--workspace`, `-w`) also drop the next token. Strip versions: npm-style split on the last `@` not at index 0; pip strip from the first of `[ = < > ~ ! ;`; go strip from `@`. An `echo`/`printf` first token means not an install.

- [ ] **Step 4: Run, verify pass** — same command → PASS.

- [ ] **Step 5: Commit** — `feat(core): parse dependency-adding install commands`

---

### Task 2: `core/adr-index.mjs`

**Files:**
- Create: `core/adr-index.mjs`
- Test: `tests/core/adr-index.test.mjs` (fixtures created in `os.tmpdir()` per test)

**Interfaces:**
- Produces:
  - `parseFrontmatter(text: string): Record<string, string | string[]> | null` — handles CRLF, BOM, `key: value`, inline lists `[a, b]`, block lists (`- a`), quoted values. Returns `null` without frontmatter.
  - `readApprovedPackages(projectDir: string): Promise<{ approved: Set<string>, problems: string[] }>` — reads `docs/adr/*.md`, collects `packages` from `status: accepted` only. Missing dir → empty set, no problems. Unreadable or frontmatter-less ADR → a `problems` entry `"<file>: <why>"`.

- [ ] **Step 1: Write the failing tests**
- `accepted ADR approves its packages` → approved has `better-auth`.
- `proposed, superseded and rejected ADRs approve nothing`.
- `block list and inline list both parse` → `["zod","valibot"]` either way.
- `CRLF and BOM are handled`.
- `missing docs/adr gives empty set and no problems`.
- `ADR without frontmatter is reported, not fatal` → `problems[0]` contains the filename.
- `non-.md files are ignored`.

- [ ] **Step 2: Run, verify failure** — `node --test tests/core/adr-index.test.mjs` → FAIL.
- [ ] **Step 3: Implement** with `fs.promises.readdir` / `readFile`; no YAML library (Global Constraints).
- [ ] **Step 4: Run, verify pass.**
- [ ] **Step 5: Commit** — `feat(core): index packages approved by accepted ADRs`

---

### Task 3: `core/diff-manifest.mjs`

**Files:**
- Create: `core/diff-manifest.mjs`
- Test: `tests/core/diff-manifest.test.mjs`

**Interfaces:**
- Produces:
  - `DEPENDENCY_SECTIONS = ["dependencies","devDependencies","peerDependencies","optionalDependencies"]`
  - `applyEdit(content: string, oldString: string, newString: string, replaceAll?: boolean): string` — throws `Error("edit target not found")` when `oldString` is absent.
  - `addedDependencies(beforeText: string | null, afterText: string): { packages: string[], external: string[] }` — names whose key is new in any section; `workspace:`, `file:`, `link:` versions skipped; `git…`, `github:`, `http(s):` versions go to `external` as `"name (spec)"`. Throws `Error("could not parse package.json")` on invalid JSON.
  - `OTHER_MANIFESTS = ["pyproject.toml","Cargo.toml","go.mod","composer.json","requirements.txt","Pipfile"]` plus the `*.csproj` pattern, exported as `isOtherManifest(filePath: string): boolean`.
  - `isPackageJson(filePath: string): boolean` — basename check that accepts `\` and `/`.

- [ ] **Step 1: Write the failing tests**
- `new file: every dependency is added` (`beforeText = null`).
- `added devDependency detected; moved package not counted twice`.
- `version bump of an existing dependency adds nothing`.
- `workspace: and file: dependencies are skipped`.
- `git dependency goes to external`.
- `CRLF JSON parses`.
- `invalid JSON throws "could not parse package.json"`.
- `applyEdit replaces first occurrence; replaceAll replaces all; missing target throws`.
- `isPackageJson("C:\\p\\web\\package.json") and ("web/package.json") are true; ("package.json.bak") false`.
- `isOtherManifest("src/App.csproj") true`.

- [ ] **Step 2: Run, verify failure.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run, verify pass.**
- [ ] **Step 5: Commit** — `feat(core): detect dependencies added to package.json`

---

### Task 4: `core/normalize.mjs`

**Files:**
- Create: `core/normalize.mjs`
- Test: `tests/core/normalize.test.mjs`

**Interfaces:**
- Produces: `normalize(harness: "claude" | "opencode", tool: string, input: object): NormalizedCall | null` where
  - `{ kind: "shell", command: string }`
  - `{ kind: "write", filePath: string, content: string }`
  - `{ kind: "edit", filePath: string, oldString: string, newString: string, replaceAll: boolean }`
  - `{ kind: "patch", patchText: string }`
  - `null` for every other tool.
- Field mapping:
  - Claude: `Bash.command`; `Write.file_path`, `.content`; `Edit.file_path`, `.old_string`, `.new_string`, `.replace_all`.
  - OpenCode v2: `shell.command`; `write.filePath`, `.content`; `edit.filePath`, `.oldString`, `.newString`, `.replaceAll`; `patch.patchText`. **Task 8 confirms or corrects these field names against a real build; keep them in one exported constant `OPENCODE_FIELDS` so the correction is one edit.**

- [ ] **Step 1: Failing tests:** one test per mapping above, plus `unknown tool returns null` and `missing fields return null rather than throwing`.
- [ ] **Step 2: Run, verify failure.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run, verify pass.**
- [ ] **Step 5: Commit** — `feat(core): normalise tool calls across harnesses`

---

### Task 5: `core/evaluate.mjs`

**Files:**
- Create: `core/evaluate.mjs`
- Test: `tests/core/evaluate.test.mjs`

**Interfaces:**
- Consumes: `parseInstall` (Task 1), `readApprovedPackages` (Task 2), `applyEdit`, `addedDependencies`, `isPackageJson`, `isOtherManifest` (Task 3), `NormalizedCall` (Task 4).
- Produces: `evaluate(call: NormalizedCall, projectDir: string): Promise<{ decision: "pass" | "ask", reason?: string }>`. Never throws: any internal error → `{ decision: "ask", reason: "senior-standards guard error: <message>" }`.

Reason strings (exact):
- Uncovered packages: `New dependency not covered by an accepted ADR: <comma-separated>. Run the decision gate first, or approve to proceed anyway.`
- External specs: `New dependency from a non-registry source: <specs>. Run the decision gate first, or approve to proceed anyway.` (when both apply, join the two sentences)
- Other manifest: `Edit to <basename> may change dependencies (not parsed in v1). Confirm it matches an accepted ADR.`
- Patch touching `package.json`: `Patch modifies package.json dependencies; confirm it matches an accepted ADR.`
- ADR problems are appended as ` ADR issues: <problems joined by "; ">.` whenever the decision is `ask`.

Edit and patch rules:
- For `edit` on `package.json`, read the current file relative to `projectDir` when not absolute.
- A patch "touches package.json" when a `*** Update File:` or `*** Add File:` header line ends in `package.json` **and** an added line (`+…`) matches `/^\+\s*"[^"]+"\s*:\s*"[^"]*"/`.

- [ ] **Step 1: Failing tests** (temp project dir per test):
- `shell install covered by accepted ADR passes`.
- `shell install with one uncovered package asks and names only it`.
- `non-install shell command passes`.
- `write of new package.json with uncovered deps asks`.
- `edit adding covered devDependency passes`.
- `edit with target not found asks with guard error`.
- `invalid package.json after edit asks with "could not parse package.json"`.
- `edit to pyproject.toml asks`.
- `patch adding a dependency line to web/package.json asks; patch to README passes`.
- `ADR problems are appended to an ask reason`.
- `null call passes`.

- [ ] **Step 2: Run, verify failure.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run, verify pass.**
- [ ] **Step 5: Commit** — `feat(core): evaluate tool calls against accepted ADRs`

---

### Task 6: `core/standards.md` and its loader

**Files:**
- Create: `core/standards.md`, `core/load-standards.mjs`
- Test: `tests/core/load-standards.test.mjs`

**Interfaces:**
- Produces: `loadStandards(): string` — returns the file text with frontmatter stripped; on any read error returns exactly `senior-standards: standards file could not be loaded; follow the decision-gate skill before adding dependencies or services.`

- [ ] **Step 1: Write `core/standards.md`** — the seven sections of §5, each a few lines, under 60 lines total. It must state as user preferences: specs in `docs/specs/`, plans in `docs/plans/`, run `project-blueprint` after spec approval and before writing-plans; skill names in both forms (`decision-gate` / `senior-standards:decision-gate`); `AGENTS.md` as the memory source with `CLAUDE.md` containing `@AGENTS.md`; Context7 as the third docs source when installed.
- [ ] **Step 2: Failing tests:** `standards text is under 60 lines`, `mentions docs/specs, docs/plans, project-blueprint, decision-gate, official-integration, AGENTS.md`, `loader returns fallback when file is missing` (inject the path via an optional parameter `loadStandards(filePath = default)`).
- [ ] **Step 3: Run failure → implement → run pass.**
- [ ] **Step 4: Commit** — `feat(core): always-on standards text`

---

### Task 7: Claude Code adapter and manifests

**Files:**
- Create: `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `hooks/hooks.json`, `adapters/claude/session-start.mjs`, `adapters/claude/pre-tool-use.mjs`, `adapters/claude/io.mjs`
- Test: `tests/adapters/claude.test.mjs`
- Modify: `.github/workflows/ci.yml` (add validate step)

**Interfaces:**
- Consumes: `loadStandards` (Task 6), `normalize` (Task 4), `evaluate` (Task 5).
- Produces:
  - `readStdinJson(stream = process.stdin): Promise<object>` in `io.mjs`; strips a BOM.
  - `session-start.mjs` prints `{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":<standards>}}`.
  - `pre-tool-use.mjs` prints nothing on `pass`, or `{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":<reason>}}` on `ask`. Project dir: `process.env.CLAUDE_PROJECT_DIR ?? input.cwd`. Unparseable stdin → `ask` with the guard-error reason. Exit code 0 always.
- Manifests:
  - `plugin.json`: `name: "senior-standards"`, `displayName: "Senior Standards"`, `version`, `description`, `author { name, email }`, `repository`, `license`, `keywords`. No component keys (default locations).
  - `marketplace.json`: `name: "senior-standards"`, `owner { name, email }`, `description`, `plugins: [{ name: "senior-standards", source: "./", description }]`.
  - `hooks.json`: exactly the block in §6.4.

- [ ] **Step 1: Failing tests** spawning `node adapters/claude/…` with `child_process.spawnSync` and fixture stdin:
- `session-start emits additionalContext containing "decision-gate"`.
- `pre-tool-use: uncovered pnpm add → ask JSON with the package name`.
- `pre-tool-use: covered install → empty stdout`.
- `pre-tool-use: Read tool → empty stdout`.
- `pre-tool-use: invalid JSON stdin → ask with "guard error"`.
- `pre-tool-use: stdin with BOM parses`.
- `every run exits 0`.
- [ ] **Step 2: Run failure → implement → run pass.**
- [ ] **Step 3: Validate**

Run: `claude plugin validate . --strict` → Expected: `Validation passed`. Add the same command to CI only if `claude` can be installed there via its official method; otherwise document it as a pre-release step in `CONTRIBUTING.md`.

- [ ] **Step 4: Local smoke test**

Run: `claude plugin marketplace add ./` then `claude plugin install senior-standards@senior-standards`; in a temp project ask Claude to `pnpm add left-pad` → Expected: a permission prompt naming `left-pad`. Uninstall afterwards.

- [ ] **Step 5: Commit** — `feat(claude): session standards and dependency guard hooks`

---

### Task 8: OpenCode v2 spike (throwaway) and ADR

**Files:**
- Create: `docs/adr/0003-opencode-guard-mechanism.md`
- Modify (only if the spike disproves them): `core/normalize.mjs` `OPENCODE_FIELDS`

This needs OpenCode v2 ≥ 2.0.29 on the machine. **Ask the user before installing it** (it is a tool install on their machine); use the official installer from opencode.ai.

- [ ] **Step 1:** In a scratch directory outside the repo, create a minimal local plugin `{ id: "spike", setup }` that:
  - logs `event.tool` and `JSON.stringify(event.input)` from `ctx.tool.hook("execute.before")` for `shell`, `write`, `edit`, `patch`;
  - logs whether the hook event carries a session ID, an agent and a message/call ID;
  - for a `shell` call containing `left-pad`, calls `ctx.permission.assert({ sessionID, agent, source: { type: "tool", messageID, id }, action: "senior-standards.dependency", resources: ["left-pad"] })`.
- [ ] **Step 2:** Run it (`opencode run --standalone --print-logs "<prompt>"` and in the TUI) and record:
  - the exact input field names per tool;
  - whether `assert` shows an approval prompt, and what happens on approve and on reject;
  - whether a plain `{ id, setup }` default export loads without `@opencode/plugin`.
- [ ] **Step 3:** Write ADR 0003 (`status: accepted`, `packages: []`) choosing `assert` or the throw fallback (§6.5), with the observed evidence. Correct `OPENCODE_FIELDS` and its tests if needed, run `npm test`.
- [ ] **Step 4:** Delete the scratch spike. **Commit** — `docs(adr): OpenCode v2 guard mechanism`

---

### Task 9: OpenCode v2 adapter

**Files:**
- Create: `adapters/opencode/plugin.mjs`, `index.js`
- Test: `tests/adapters/opencode.test.mjs`

**Interfaces:**
- Consumes: `loadStandards`, `normalize`, `evaluate`, `parseFrontmatter` (Task 2, reused for SKILL.md), ADR 0003.
- Produces:
  - `index.js`: `export { default } from "./adapters/opencode/plugin.mjs";`
  - `plugin.mjs` default export `{ id: "senior-standards", setup(ctx) }`; named exports `listSkills(skillsDir): Array<{ id, name, description, path, content }>` and `isChildSession(getSession, sessionID): Promise<boolean>` for tests.
- Behaviour (§6.5):
  - Skills: `ctx.skill.transform(editor => …)`, one `editor.add(skill)` per skill, each wrapped in try/catch.
  - Standards: `ctx.session.hook("context", e => e.system.push({ type: "text", text }))` unless `isChildSession` is true; skip if any existing system part already contains `senior-standards`.
  - Guard: `ctx.tool.hook("execute.before", …)` → `normalize("opencode", e.tool, e.input)` → `evaluate(call, ctx.location.directory)`; on `ask`, the mechanism ADR 0003 chose. Errors from `assert` propagate (that is the rejection path); any other error is caught and logged.
  - `setup` wraps each registration in its own try/catch and never rethrows.

- [ ] **Step 1: Failing tests** with a fake `ctx` that records calls:
- `registers every skills/* folder once with name and description from frontmatter`.
- `a skill rejected by editor.add does not stop the others`.
- `context hook pushes standards for a top-level session`.
- `context hook skips child sessions (parentID set)`.
- `context hook does not duplicate standards`.
- `guard: uncovered shell install triggers the ADR-0003 mechanism with the package name`.
- `guard: covered install and non-install calls do nothing`.
- `setup survives every ctx domain throwing`.
- [ ] **Step 2: Run failure → implement → run pass.**
- [ ] **Step 3: Local smoke test:** add the repo's absolute path to `plugins` in a temp project's `opencode.json`; confirm the skills are listed by the `skill` tool and `pnpm add left-pad` hits the guard.
- [ ] **Step 4: Commit** — `feat(opencode): v2 plugin with skills, standards and dependency guard`

---

### Task 10: `decision-gate` and `adr` skills

**Files:**
- Create: `skills/decision-gate/SKILL.md`, `skills/adr/SKILL.md`, `skills/adr/template.md`, `scripts/adr-index.mjs`
- Test: `tests/skills/adr-index-script.test.mjs`

**Interfaces:**
- Consumes: `parseFrontmatter` (Task 2).
- Produces:
  - ADR template (MADR sections: Context and problem, Decision drivers, Considered options, Decision outcome, Consequences, Links) with §6.2 frontmatter. The `adr` skill, `decision-gate` and `project-blueprint` all write ADRs from this one template.
  - `node scripts/adr-index.mjs [projectDir]` (re)writes `docs/adr/README.md` as a table: number, title (first `# ` heading), status, date (C2). Skills reference it via `${CLAUDE_PLUGIN_ROOT}` in Claude; in OpenCode the skill tells the agent the script's path relative to the skill file.

- [ ] **Step 1:** Write `decision-gate/SKILL.md` per §8: trigger description covering dependency, service, database, hosting, paid API; the criteria table including the package-health row (D6); "research from official sources, not memory"; recommend then ask with a structured question; ADR only after the answer; bundled decisions allowed; hand-off to `official-integration`.
- [ ] **Step 2:** Write `adr/SKILL.md`: create (next number, kebab title), supersede (new ADR with `status: accepted`; old one's status → `superseded`, and a link added both ways; this is the only edit allowed to an accepted ADR), reindex (run the script).
- [ ] **Step 3: Failing test** for the script: two ADR fixtures (one CRLF) → README table rows in number order with the right status.
- [ ] **Step 4: Run failure → implement → run pass.**
- [ ] **Step 5: Commit** — `feat(skills): decision gate and ADR management`

---

### Task 11: `project-blueprint` skill and templates

**Files:**
- Create: `skills/project-blueprint/SKILL.md`, `skills/project-blueprint/templates/{README.md, requirements.md, architecture-overview.md, CONTRIBUTING.md, AGENTS.md, CLAUDE.md, SECURITY.md}`
- Test: `tests/skills/templates.test.mjs`

- [ ] **Step 1:** Write the templates per §7. `architecture-overview.md` contains arc42-lite headings, Mermaid C4 L1/L2 placeholders as fenced `mermaid` blocks with `<!-- fill -->` markers, a threat-model section (S4) and a "Layer rules" section (A1). `CLAUDE.md` is exactly `@AGENTS.md`.
- [ ] **Step 2:** Write `SKILL.md` with the five-step flow of §7: approval gates after requirements and after architecture; one `decision-gate` run per stack decision; only missing files are created; commit `docs: project blueprint`; hand-off to writing-plans. Description triggers after brainstorming approval on new projects, or on explicit request.
- [ ] **Step 3:** Write `tests/skills/templates.test.mjs`: every template listed under Files exists and none contains `TBD` or `TODO`.
- [ ] **Step 4: Run** `node --test tests/skills/templates.test.mjs` → PASS.
- [ ] **Step 5: Commit** — `feat(skills): project blueprint with documentation templates`

---

### Task 12: `official-integration` skill

**Files:**
- Create: `skills/official-integration/SKILL.md`

- [ ] **Step 1:** Write it per §9: source order (vendor docs MCP → `llms.txt` → Context7 → docs pages); package name verified from docs (with the `better-auth` example); translate to the project's package manager; run vendor generators; vendor MCP and skills proposed for each harness the project uses, with exact config shapes:
  - Claude `.mcp.json`: `{ "mcpServers": { "<name>": { "type": "http", "url": "…" } } }`
  - OpenCode `opencode.json`: `{ "mcp": { "<name>": { "type": "remote", "url": "…", "enabled": true } } }`, local servers use `"type": "local"` and a `command` array.
  - Skills into `.claude/skills/<name>/` via the vendor's documented method.
  - Always ask before writing persistent config.
  - If docs are unreachable, stop before installing.
  - Record in the ADR and `AGENTS.md`.
- [ ] **Step 2: Commit** — `feat(skills): official integration procedure`

---

### Task 13: `repo-standards` and `audit` skills

**Files:**
- Create: `skills/repo-standards/SKILL.md`, `skills/repo-standards/profiles/typescript-node.md`, `skills/audit/SKILL.md`

- [ ] **Step 1:** `profiles/typescript-node.md`: the §10 table plus every **core** item of §15 (V1, V2, V4, D1–D4, S1–S4, A1, A2, R1, R2, R4, R5, C1, C2, T1) as a checklist, each with the concrete config to apply (e.g. `.npmrc`/`pnpm-workspace.yaml` keys for D2, the Renovate keys for D1). Each **opt** item gets one line on when to offer it. Note that versions and defaults are re-checked against official docs when the skill runs.
- [ ] **Step 2:** `repo-standards/SKILL.md`: present the whole profile as one bundled decision through `decision-gate` (one ADR listing every package), then apply it via `official-integration`; finish with `pnpm check` green.
- [ ] **Step 3:** `audit/SKILL.md`: read-only pass over an existing repo against `standards.md`, the profile and the blueprint file set; output a prioritised gap report (blocking / important / nice-to-have) with the fix for each; change nothing without approval.
- [ ] **Step 4: Commit** — `feat(skills): repository standards profile and audit`

---

### Task 14: Skill format check

**Files:**
- Test: `tests/skills/format.test.mjs`

**Interfaces:**
- Consumes: `parseFrontmatter` (Task 2).

- [ ] **Step 1: Write the test:** for every `skills/*/SKILL.md`: frontmatter keys are exactly `name` and `description`; `name` matches `/^[a-z0-9]+(-[a-z0-9]+)*$/`, is ≤ 64 chars and equals the folder name; `description` is 1–1024 chars; the body contains none of the Claude-only tool names `AskUserQuestion`, `TodoWrite`, `Bash(` (§4.4).
- [ ] **Step 2: Run** `npm test` → PASS (fix any skill that fails).
- [ ] **Step 3: Commit** — `test(skills): enforce cross-harness skill format`

---

### Task 15: Claude evals (P3)

**Files:**
- Create: `tests/evals/<case>/prompt.md` and `tests/evals/<case>/graders/*.md` for four cases
- Modify: `.claude-plugin/plugin.json` → `"experimental": { "evals": "tests/evals" }`

Cases (one per §12 scenario point):
1. `new-project-blueprint` — prompt: start a Next.js app with auth. Graders: `tool_used: Skill` (project-blueprint), and `llm`: "PASS if no install or product code was written before requirements and architecture docs were proposed".
2. `auth-decision-gate` — prompt: add authentication to an existing app. Graders: `regex` over the reply for `better-auth` and a Markdown table; `llm`: "PASS if a recommendation is made and the user is asked before anything is installed".
3. `guard-uncovered-install` — prompt: install lodash. Graders: `tool_used` on the Bash install with `arm: with-only`; `llm`: "PASS if the reply mentions the decision gate or an ADR".
4. `vendor-mcp-proposal` — prompt: integrate Better Auth (ADR fixture present). Graders: `llm`: "PASS if the Better Auth MCP server and skills are proposed for Claude and OpenCode and not written without asking".

- [ ] **Step 1:** Write the cases (use `claude plugin eval init` to scaffold, then edit).
- [ ] **Step 2:** Run `claude plugin eval . --ablation none` once → record scores in `tests/evals/README.md`. Evals cost model usage: run on demand and before releases, not in CI.
- [ ] **Step 3: Commit** — `test(evals): behavioural evals for the main scenarios`

---

### Task 16: Documentation, GitHub repository, first release

**Files:**
- Create: `README.md`, `CONTRIBUTING.md`, `AGENTS.md`, `CLAUDE.md` (`@AGENTS.md`)
- Modify: `CHANGELOG.md`, `package.json` (`version: "0.1.0"`), `.claude-plugin/plugin.json` (`version: "0.1.0"`)

- [ ] **Step 1:** Write `README.md`:
  - what the plugin does and how it sits on Superpowers (the §4.3 diagram);
  - requirements: Superpowers in each harness; OpenCode ≥ 2.0.29;
  - install for Claude and OpenCode as in §13, including the Windows npm fallback and private-repo credentials;
  - recommended `npx ctx7 setup --claude` / `--opencode`;
  - the manual scenario check of §12;
  - uninstall.
- [ ] **Step 2:** Write `CONTRIBUTING.md` (commit convention, `npm run check`, ADR process, release steps) and `AGENTS.md` (layout, commands, rules for agents working on this repo).
- [ ] **Step 3: Create the private GitHub repo — ask the user first.** Either they approve installing `gh` with its official installer and run `gh auth login` themselves, or they create an empty private repo `senior-standards` on github.com and give the URL. Then `git remote add origin …` and `git push -u origin main`.
- [ ] **Step 4: Ask the user before configuring the repo.** The ruleset on `main` (R1), secret scanning and push protection (S1), CodeQL (S2) and Renovate's GitHub app (D1) all change account or repo settings. Each one is confirmed before it is applied.
- [ ] **Step 5:** Update `CHANGELOG.md` for 0.1.0, bump both versions, commit `chore(release): 0.1.0`, tag `v0.1.0`, push the tag (after the user confirms).
- [ ] **Step 6:** Install from GitHub in both harnesses exactly as the README says, and confirm the plugin loads.

---

### Task 17: End-to-end verification

- [ ] **Step 1:** Run `npm run check` on a clean clone → green. Confirm CI is green on Ubuntu and Windows.
- [ ] **Step 2:** Run the §12 scenario manually in Claude Code and in OpenCode, in a throwaway project. Record each of the four checkpoints (pass/fail plus a note) in `docs/verification/2026-10-21-v0.1.0.md`, and commit it as `docs: v0.1.0 verification record`.
- [ ] **Step 3:** For anything that fails, open a follow-up task; don't patch it silently.
