# senior-standards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `senior-standards`, a Claude Code + OpenCode v2 plugin that adds a documented-blueprint step, an ask-before-deciding gate, official-only integrations and a dependency guard on top of Superpowers.

**Architecture:** A harness-agnostic `core/` (pure ES modules: install parsing, ADR index, manifest diff, call normalisation, evaluation, standards text) used by two thin adapters: Claude Code hooks (`adapters/claude/`) and an OpenCode v2 plugin (`adapters/opencode/`). Skills in `skills/` are shared verbatim by both harnesses. The repo root is both a Claude marketplace and an OpenCode plugin package.

**Tech Stack:** Node ≥ 22 built-ins only at runtime (`node:fs`, `node:path`, `node:test`, `node:assert`); OpenCode runs the same modules under Bun. Markdown skills (Agent Skills format). GitHub Actions.

**Spec:** `docs/specs/2026-10-21-senior-standards-design.md` (v3.2). Section references below (§n) point into it.

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
- Language-neutral: no skill, template or core module may assume a specific language or package manager; stack knowledge lives only in `skills/repo-standards/profiles/` and in `core/manifests/` + the `parse-install` rule table (A2, §10).
- Conventional Commits for every commit; Commit messages carry no attribution trailers or footers.
- Docs locations: specs `docs/specs/`, plans `docs/plans/`, ADRs `docs/adr/NNNN-kebab-title.md`.

## Review Focus

1. **Windows-shaped input.** `file_path` like `C:\proj\web\package.json` or `web/package.json`, CRLF in ADR files and `package.json`, a UTF-8 BOM on stdin. Expected: detected and parsed exactly like POSIX/LF input. Tests in Tasks 2, 3, 6.
2. **Real-world install commands in every ecosystem.** `cd web && pnpm add zod`, `FOO=1 npm i -D vitest`, `pnpm --filter web add zod`, `dotnet add src/Api/Api.csproj package Npgsql`, `cargo add tokio@1 -F full --dev`, `poetry add httpx --group dev`, `go install …@latest`. Expected: the right names and kind (dependency vs tool), nothing else. Tests in Task 1.
3. **Internal vs external references.** `pnpm add ./packages/ui`, `workspace:*`, Cargo `path =`, `ProjectReference`, `cargo add --git …`, `npm i github:user/repo`. Expected: internal references pass; git/URL sources `ask`, named by their source. Tests in Tasks 1 and 3.
4. **Missing or broken ADR log.** No `docs/adr/`, an ADR without frontmatter, `packages:` as a block list, an unreadable file. Expected: no crash; only well-formed `accepted` ADRs approve anything; broken files are reported in the reason. Tests in Task 2.
5. **Non-dependency edits to manifests.** Changing `TargetFramework` in a `.csproj`, a version bump in `Cargo.toml`, reordering `package.json`, and a first write of a manifest. Expected: only newly added names prompt (a new file counts everything); unparseable content → `ask` with "could not parse <file>". Tests in Tasks 3 and 5.

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
- `SECURITY.md`: private reporting contact `titanfrigel@gmail.com`.

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
  - `parseInstall(command: string): Array<{ manager: string, kind: "dependency" | "tool", packages: string[], external: string[] }>` — one entry per segment that adds something (§6.1). `packages` are registry names with version specifiers removed; `external` are git/URL/tarball specs kept verbatim. Local paths (`./`, `../`, absolute, `file:`, `link:`, `workspace:`) are dropped. `kind: "tool"` for global/tool installs.

- [ ] **Step 1: Write the failing tests**

Table-driven `test("parseInstall: <command>")` cases asserting `deepStrictEqual`. Shorthand below: `manager kind [packages] {external}`; `—` means `[]`.

| Command | Expected |
|---|---|
| `npm install zod` | `npm dependency [zod]` |
| `npm i -D vitest @types/node@^22` | `npm dependency [vitest, @types/node]` |
| `npm install --save-exact zod@3.23.8` | `npm dependency [zod]` |
| `npm i -g typescript` | `npm tool [typescript]` |
| `pnpm add -D @biomejs/biome` | `pnpm dependency [@biomejs/biome]` |
| `pnpm --filter web add zod` | `pnpm dependency [zod]` |
| `yarn add react react-dom` / `bun add hono` / `deno add jsr:@std/path` | `yarn … [react, react-dom]` / `bun … [hono]` / `deno … [jsr:@std/path]` |
| `cd web && pnpm add zod` | `pnpm dependency [zod]` |
| `FOO=1 npm i -D vitest` | `npm dependency [vitest]` |
| `dotnet add package Serilog --version 4.0.0` | `dotnet dependency [Serilog]` |
| `dotnet add src/Api/Api.csproj package Npgsql` | `dotnet dependency [Npgsql]` |
| `dotnet add reference ../Core/Core.csproj` | — |
| `dotnet tool install -g dotnet-ef` / `dotnet tool install dotnet-ef` | `dotnet tool [dotnet-ef]` (both) |
| `cargo add serde --features derive` | `cargo dependency [serde]` |
| `cargo add tokio@1 -F full --dev` | `cargo dependency [tokio]` |
| `cargo add --path ../core` | — |
| `cargo install cargo-deny --locked` | `cargo tool [cargo-deny]` |
| `pip install "requests[socks]>=2" flask==3.0` | `pip dependency [requests, flask]` |
| `pip install -r requirements.txt` / `pip install -e .` | — |
| `uv add httpx` / `poetry add httpx --group dev` | `uv … [httpx]` / `poetry … [httpx]` |
| `uv tool install ruff` / `pipx install black` | `uv tool [ruff]` / `pipx tool [black]` |
| `go get github.com/gin-gonic/gin@v1.10.0` | `go dependency [github.com/gin-gonic/gin]` |
| `go install golang.org/x/vuln/cmd/govulncheck@latest` | `go tool [golang.org/x/vuln/cmd/govulncheck]` |
| `go install ./cmd/app` | — |
| `composer require laravel/sanctum` / `bundle add rails` / `gem install bundler` | `composer dependency [laravel/sanctum]` / `bundle dependency [rails]` / `gem tool [bundler]` |
| `dart pub add http` / `flutter pub add provider` | `dart dependency [http]` / `flutter dependency [provider]` |
| `npm i github:user/repo` | `npm dependency [] {github:user/repo}` |
| `cargo add --git https://github.com/a/b` | `cargo dependency [] {https://github.com/a/b}` |
| `pnpm add ./packages/ui` | — |
| `npm install` / `pnpm install` / `npm ci` / `dotnet restore` / `cargo build` / `go mod download` | — |
| `npx create-next-app@latest` / `pnpm dlx x` / `bunx x` / `uvx ruff` / `dotnet tool run x` | — |
| `npm uninstall zod` / `cargo remove serde` / `dotnet remove package X` | — |
| `echo "npm install zod"` | — |
| `npm install zod; cargo add serde` | two entries: `npm dependency [zod]`, `cargo dependency [serde]` |

Plus `splitCommand('a && "b && c" ; d')` → `['a', '"b && c"', 'd']`.

- [ ] **Step 2: Run, verify failure**

Run: `node --test tests/core/parse-install.test.mjs` → Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

Use one rule table: `{ manager, match(tokens) → { kind, argsStart } | null, valueFlags: string[], stripVersion(token) → name, isLocal(token) → boolean }`, one row per command family in §6.1, so adding an ecosystem is one row.
- Tokenise each segment with a quote-aware splitter, skip leading `VAR=value` tokens, and treat a first token of `echo`/`printf` as not an install.
- Drop flags. For flags that take a value (`--filter -F --version -v --features --prefix --workspace -w --group -G --git --branch --tag --rev --path --source -s --framework -f`), also drop the next token, except when that flag is the external source itself (`--git`) or a local one (`--path`). `--git` and `--path` decide `external` or dropped.
- `dotnet add`: if the token after `add` is not `package`, skip it as the project path, then require `package`.
- Version stripping:
  - npm-style: last `@` not at index 0;
  - pip: from the first of `[ = < > ~ ! ;`;
  - go and cargo: from `@`;
  - `deno`/`jsr:` names are kept with their prefix.

- [ ] **Step 4: Run, verify pass** — same command → PASS.

- [ ] **Step 5: Commit** — `feat(core): parse dependency and tool installs across ecosystems`

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

### Task 3: Manifest extractors and `core/diff-manifest.mjs`

**Files:**
- Create: `core/manifests/index.mjs`, one module per family: `core/manifests/{npm,deno,dotnet,cargo,go,python,maven,gradle,ruby,dart,composer}.mjs`, and `core/diff-manifest.mjs`
- Test: `tests/core/manifests/<family>.test.mjs` (one per family), `tests/core/diff-manifest.test.mjs`

**Interfaces:**
- Each family module exports `{ id: string, matches(fileName: string): boolean, extract(text: string): { names: Set<string>, external: Map<string, string> } }`, where `external` maps name → source for git/URL dependencies. Internal references are excluded entirely (§6.1). Every extractor throws `Error("could not parse <fileName>")` on input it cannot read, and accepts CRLF.
- `core/manifests/index.mjs`:
  - `EXTRACTORS` — the array of all family modules;
  - `findExtractor(filePath: string): Extractor | null` — on the basename, accepting `\` and `/`;
  - `UNPARSED_MANIFESTS` — `["Package.swift","mix.exs","build.sbt","Podfile","vcpkg.json"]` plus `conanfile.*` and `CMakeLists.txt`, exposed as `isUnparsedManifest(filePath: string): boolean`.
- `core/diff-manifest.mjs`:
  - `applyEdit(content: string, oldString: string, newString: string, replaceAll?: boolean): string` — throws `Error("edit target not found")` when `oldString` is absent;
  - `addedDependencies(extractor, beforeText: string | null, afterText: string): { packages: string[], external: string[] }` — `packages` = names in `after` and not in `before`, sorted; `external` = `"name (source)"` for added external entries.
- File-name matching per family (exact rules, all case-sensitive except where noted):

| Module | Matches | Reads |
|---|---|---|
| `npm` | `package.json` | the four sections; skip `workspace:`/`file:`/`link:`; `git…`, `github:`, `http(s):` → external |
| `deno` | `deno.json`, `deno.jsonc` | `imports` keys (strip comments for `.jsonc`) |
| `dotnet` | `*.csproj`, `*.fsproj`, `*.vbproj`, `Directory.Packages.props`, `dotnet-tools.json` | `<PackageReference Include="X"` and `<PackageVersion Include="X"` (attribute order-insensitive; `Update=` ignored); `tools` keys for `dotnet-tools.json` |
| `cargo` | `Cargo.toml` | keys under `[dependencies]`, `[dev-dependencies]`, `[build-dependencies]`, `[workspace.dependencies]`, `[target.'…'.dependencies]` and dotted/inline forms (`[dependencies.serde]`); `path =` → skipped; `git =` → external |
| `go` | `go.mod` | `require` single lines and blocks; skip `// indirect` |
| `python` | `pyproject.toml`, `requirements*.txt`, `Pipfile` | PEP 621 `dependencies` and `optional-dependencies`, `[dependency-groups]`, `[tool.poetry.dependencies]` / `[tool.poetry.group.*.dependencies]` (excluding `python`); requirements lines (skip comments, `-r`, `-e`, `--` options); names normalised per PEP 503 (lowercase, `-_.` → `-`) |
| `maven` | `pom.xml` | `<dependency>` → `groupId:artifactId` (ignore `<parent>` and `<plugin>`) |
| `gradle` | `build.gradle`, `build.gradle.kts`, `libs.versions.toml` | `"group:artifact:version"` strings in `implementation\|api\|compileOnly\|runtimeOnly\|testImplementation\|kapt\|ksp` calls; `[libraries]` `module = "g:a"` or `group`+`name` |
| `ruby` | `Gemfile` | `gem "name"` / `gem 'name'` |
| `dart` | `pubspec.yaml` | keys under `dependencies`, `dev_dependencies` (skip `sdk:` and `path:` entries) |
| `composer` | `composer.json` | `require`, `require-dev` keys, excluding `php` and `ext-*` |

Line-based parsing is acceptable for TOML/YAML/XML/Gradle (Global Constraints: no parser libraries). Each test file pins the shapes above.

- [ ] **Step 1: Write the failing tests**, one file per family. Each covers:
  - the basic shape;
  - every alternative shape in its row;
  - the internal reference that must be skipped;
  - the external source;
  - CRLF input;
  - one malformed input that must throw.

Plus `tests/core/diff-manifest.test.mjs`:
- `new file: every dependency is added` (`beforeText = null`).
- `version bump adds nothing`.
- `reordering adds nothing`.
- `.csproj edit that only changes TargetFramework adds nothing`.
- `added PackageReference is reported`.
- `added Cargo dev-dependency is reported`.
- `applyEdit` covers first occurrence, `replaceAll`, and target-not-found.
- `findExtractor("C:\\src\\Api\\Api.csproj").id === "dotnet"`; `findExtractor("web/package.json").id === "npm"`; `findExtractor("package.json.bak") === null`.
- `isUnparsedManifest("Package.swift") === true`.

- [ ] **Step 2: Run, verify failure** — `node --test tests/core/manifests tests/core/diff-manifest.test.mjs` → FAIL.
- [ ] **Step 3: Implement**, family by family; re-run the family's test after each.
- [ ] **Step 4: Run all, verify pass.**
- [ ] **Step 5: Commit** — `feat(core): detect added dependencies across manifest types`

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
- Consumes:
  - `parseInstall` (Task 1);
  - `readApprovedPackages` (Task 2);
  - `findExtractor`, `isUnparsedManifest`, `applyEdit`, `addedDependencies` (Task 3);
  - `NormalizedCall` (Task 4).
- Produces: `evaluate(call: NormalizedCall, projectDir: string): Promise<{ decision: "pass" | "ask", reason?: string }>`. Never throws: any internal error → `{ decision: "ask", reason: "senior-standards guard error: <message>" }`.

Matching approved names: exact match, except Python names, which are compared after PEP 503 normalisation, and NuGet names, which are compared case-insensitively.

Reason strings (exact; sentences joined with a space when several apply):
- Uncovered dependencies: `New dependency not covered by an accepted ADR: <comma-separated>. Run the decision gate first, or approve to proceed anyway.`
- Uncovered tools: `New tool install not covered by an accepted ADR: <comma-separated>. Run the decision gate first, or approve to proceed anyway.`
- External specs: `New dependency from a non-registry source: <specs>. Run the decision gate first, or approve to proceed anyway.`
- Unparsed manifest: `Edit to <basename> may change dependencies (this manifest type is not parsed). Confirm it matches an accepted ADR.`
- Unapplicable patch to a supported manifest: `Patch modifies <basename>; confirm any dependency change matches an accepted ADR.`
- ADR problems are appended as ` ADR issues: <problems joined by "; ">.` whenever the decision is `ask`.

Edit, write and patch rules:
- `write`/`edit` on a file with an extractor: read the current file (resolve relative paths against `projectDir`; a missing file means `before = null`), build `after` (Write: `content`; Edit: `applyEdit`), then `addedDependencies`.
- `patch`: parse `*** Update File: <path>` / `*** Add File: <path>` sections. For each section whose path has an extractor:
  - `Add File` → `before = null`, `after` = the `+` lines;
  - a single `Update File` section whose hunks apply cleanly to the current file → evaluate like an edit;
  - otherwise → the unapplicable-patch reason.
  Sections for unparsed manifests → the unparsed-manifest reason. Everything else in the patch is ignored.

- [ ] **Step 1: Failing tests** (temp project dir per test):
- `shell install covered by accepted ADR passes`.
- `shell install with one uncovered package asks and names only it`.
- `cargo install uncovered tool asks with the tool sentence`.
- `non-install shell command passes`.
- `write of new package.json with uncovered deps asks`.
- `edit adding a covered devDependency passes`.
- `edit adding a PackageReference to Api.csproj asks; edit changing only TargetFramework passes`.
- `NuGet approval is case-insensitive` (`packages: [serilog]` covers `Serilog`).
- `Python approval is PEP 503-normalised` (`packages: [Flask_Login]` covers `flask-login`).
- `edit to Package.swift asks with the unparsed-manifest reason`.
- `patch adding a [dependencies] line to Cargo.toml asks; patch to README passes`.
- `edit with target not found asks with guard error`.
- `invalid package.json after edit asks with "could not parse package.json"`.
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

### Task 13: `repo-standards` (language-neutral) and `audit` skills

**Files:**
- Create: `skills/repo-standards/SKILL.md`, `skills/repo-standards/checklist.md`, `skills/repo-standards/profiles/{typescript-node,dotnet,rust,python,go}.md`, `skills/audit/SKILL.md`
- Test: `tests/skills/profiles.test.mjs`

**Interfaces:**
- Every profile has exactly these H2 sections, in this order, matching the §10.2 concerns: `Toolchain pin`, `Package manager and lockfile`, `Supply-chain settings`, `Build`, `Format`, `Lint and static analysis`, `Type strictness`, `Tests and coverage`, `Unused code and dependencies`, `Dependency audit`, `Architecture rules`, `Release and publishing`, `Check entry point`, then `Sources`. Every concern section names a candidate and at least one alternative. `Sources` lists the official URLs used, with the date checked.
- `checklist.md` holds the same concern list with the question each answers (§10.2), plus the universal baseline of §10.1 with the concrete config for each item (Renovate keys for D1, ruleset settings for R1, workflow `permissions` for S3, `.gitattributes`/`.editorconfig` contents for R4, …).

- [ ] **Step 1: Write the failing test** `tests/skills/profiles.test.mjs`:
  - each of the five profiles exists;
  - it has the 14 sections above in order;
  - every concern section contains at least two backticked tool names;
  - the `Sources` section contains at least one `https://` URL and an ISO date.
- [ ] **Step 2: Run, verify failure.**
- [ ] **Step 3: Write `checklist.md`.**
- [ ] **Step 4: Write the five profiles,** each researched from official sources at the time of writing (not from memory), and each kept short (the skill re-verifies rows at run time).
  - The TypeScript/Node profile records the accepted choices: pnpm with the D2 settings, Biome, Vitest, Knip, dependency-cruiser, a `check` script.
  - The .NET, Rust, Python and Go profiles cover the items named in spec §10.3 at minimum.
- [ ] **Step 5: Write `repo-standards/SKILL.md`:**
  1. Detect the project's languages from its manifests (reuse the list in Task 3).
  2. Load the matching profiles, or none.
  3. Verify each candidate against current official docs.
  4. Fill the checklist per language.
  5. Present the universal baseline and every language's choices as one bundled decision through `decision-gate` (one ADR listing every package and tool).
  6. Apply it through `official-integration`.
  7. Finish with the project's `check` entry point green.

  For a language without a profile, research every concern from scratch.
- [ ] **Step 6: Write `audit/SKILL.md`:**
  - a read-only pass over an existing repo against `standards.md`, the universal baseline, the per-language checklist and the blueprint file set;
  - output: a prioritised gap report (blocking / important / nice-to-have) with the fix for each;
  - changes nothing without approval.
- [ ] **Step 7: Run** `node --test tests/skills/profiles.test.mjs` → PASS.
- [ ] **Step 8: Commit** — `feat(skills): language-neutral repository standards, seed profiles and audit`

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
- Create: `tests/evals/<case>/prompt.md`, `tests/evals/<case>/graders/*.md` and any fixture project files under `tests/evals/<case>/` for six cases; `tests/evals/README.md`
- Modify: `.claude-plugin/plugin.json` → `"experimental": { "evals": "tests/evals" }`

Cases (scenarios A–C of spec §12):

**Scenario A (Next.js):**
1. `new-project-blueprint` — prompt: start a Next.js app with auth.
   - `tool_used: Skill` (project-blueprint);
   - `llm`: "PASS if no install or product code was written before requirements and architecture docs were proposed".
2. `auth-decision-gate` — prompt: add authentication to an existing Next.js app.
   - `regex` over the reply for `better-auth` and a Markdown table;
   - `llm`: "PASS if a recommendation is made and the user is asked before anything is installed".
3. `guard-uncovered-install` — prompt: install lodash.
   - `tool_used` on the Bash install, `arm: with-only`;
   - `llm`: "PASS if the reply mentions the decision gate or an ADR".
4. `vendor-mcp-proposal` — prompt: integrate Better Auth (fixture: accepted ADR for `better-auth`).
   - `llm`: "PASS if the Better Auth MCP server and skills are proposed for Claude and OpenCode and not written without asking".

**Scenario B (.NET):**

5. `dotnet-database-gate` — fixture: minimal ASP.NET Core Web API (`Api.csproj`, `Program.cs`); prompt: "add a database to store orders".
   - `regex` for a Markdown table naming at least two of `PostgreSQL|SQL Server|SQLite`;
   - `llm`: "PASS if a data-access option (e.g. EF Core vs Dapper) is compared and the user is asked before any PackageReference is added".

**Scenario C (Rust):**

6. `rust-logging-and-standards` — fixture: minimal binary crate; prompt: "add logging and set up the repo standards".
   - `regex` for `tracing`;
   - `llm`: "PASS if logging options are compared before `cargo add`, and the proposed standards include a toolchain pin, clippy with warnings denied, and a dependency audit tool, each with a cited official source".

- [ ] **Step 1:** Write the cases. Scaffold with `claude plugin eval init`, then edit; keep fixtures minimal (no build artefacts).
- [ ] **Step 2:** Run `claude plugin eval . --ablation none` once and record the scores in `tests/evals/README.md`. Evals cost model usage: run them on demand and before releases, not in CI.
- [ ] **Step 3: Commit** — `test(evals): behavioural evals for Next.js, .NET and Rust scenarios`

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
  - the manual scenario checks of §12 (A–C);
  - uninstall.
- [ ] **Step 2:** Write `CONTRIBUTING.md` (commit convention, `npm run check`, ADR process, release steps) and `AGENTS.md` (layout, commands, rules for agents working on this repo).
- [ ] **Step 3: Create the private GitHub repo — ask the user first.** Either they approve installing `gh` with its official installer and run `gh auth login` themselves, or they create an empty private repo `senior-standards` on github.com and give the URL. Then `git remote add origin …` and `git push -u origin main`.
- [ ] **Step 4: Ask the user before configuring the repo.** The ruleset on `main` (R1), secret scanning and push protection (S1), CodeQL (S2) and Renovate's GitHub app (D1) all change account or repo settings. Each one is confirmed before it is applied.
- [ ] **Step 5:** Update `CHANGELOG.md` for 0.1.0, bump both versions, commit `chore(release): 0.1.0`, tag `v0.1.0`, push the tag (after the user confirms).
- [ ] **Step 6:** Install from GitHub in both harnesses exactly as the README says, and confirm the plugin loads.

---

### Task 17: End-to-end verification

- [ ] **Step 1:** Run `npm run check` on a clean clone → green. Confirm CI is green on Ubuntu and Windows.
- [ ] **Step 2:** Run §12 scenarios A (Next.js), B (.NET) and C (Rust) manually in Claude Code and in OpenCode, each in a throwaway project. Record every checkpoint (pass/fail plus a note) in `docs/verification/2026-10-21-v0.1.0.md`, and commit it as `docs: v0.1.0 verification record`.
- [ ] **Step 3:** For anything that fails, open a follow-up task; don't patch it silently.
