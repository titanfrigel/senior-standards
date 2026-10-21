---
name: official-integration
description: Use when a dependency, library, framework or service decision has been accepted and it is time to install, configure or wire it in, in any language or ecosystem, including adding the vendor's official MCP server and Agent Skills for the harnesses the project uses.
---

# Official integration

Install exactly the way the vendor documents it, and bring the vendor's own AI tooling along. This skill starts after `decision-gate` (`senior-standards:decision-gate`) has produced an `accepted` ADR; do not repeat the gate. If no accepted ADR covers the package, stop and run the gate first.

## Steps

1. **Find the official source, in this order.** Stop at the first that answers the question.
   1. The vendor's docs MCP, if one is already configured.
   2. The vendor's `llms.txt` (fetch `<docs site>/llms.txt`).
   3. Context7, only if it is already installed. If it is not, mention that its official installer is `npx ctx7 setup` (with `--claude` or `--opencode`) and let the user decide; never configure it by hand.
   4. The vendor's docs pages, fetched.
   If none can be reached, **stop before installing** and tell the user. Never install from memory or from search-engine summaries.
2. **Verify the exact package name** in the docs and in the ecosystem registry. Names are never guessed: for example the npm package is `better-auth`, not `betterauth`. Check that the name, publisher and version match what the ADR approved.
3. **Translate the documented command to the project's tooling.** Keep the same package name and the project's version policy.

   | Docs say | Project uses | Run |
   |---|---|---|
   | `npm install better-auth` | pnpm / yarn / bun | `pnpm add better-auth`, `yarn add better-auth`, `bun add better-auth` |
   | `dotnet add package <Id>` | .NET | as documented, via the CLI |
   | `cargo add <crate>` | Rust | as documented, via the CLI |
   | `pip install <pkg>` | uv / poetry / pip | `uv add <pkg>`, `poetry add <pkg>` |
   | `go get <module>` | Go | as documented |

   Use the package manager's command so it writes the manifest and lockfile. Never edit a manifest by hand to add a dependency; the install guard also checks this.
4. **Run the vendor's CLI or generators** where the docs prescribe them (schema generators, `init` commands, migrations) instead of hand-writing their output. Use the exact flags the docs give.
5. **Pin per the project's policy.** Commit the lockfile; use exact versions where the repo profile (`repo-standards`, `senior-standards:repo-standards`) says so. Then run the project's `check` entry point and fix what it reports.
6. **Propose the vendor's AI tooling, per harness.** Look in the docs for an official MCP server, Agent Skills and `llms.txt`. Better Auth is the worked example: its docs list a documentation MCP server at `https://mcp.better-auth.com/mcp`, an `llms.txt`, and Agent Skills under `/docs/ai-resources/skills` on better-auth.com. The pattern is language-neutral: for a NuGet package, a crate or a PyPI package, check the vendor's docs for the same three things; do not assume a URL you have not seen in them.

   Detect which harnesses the project uses (a `.claude/` directory or `.mcp.json` means Claude Code; `opencode.json` or `.opencode/` means OpenCode) and propose project-scope config for each:

   - **Claude Code**, `.mcp.json`:
     ```json
     { "mcpServers": { "<name>": { "type": "http", "url": "https://…" } } }
     ```
     A local stdio server uses `"command"` and `"args"` instead of `type` and `url`.
   - **OpenCode**, `opencode.json`:
     ```json
     { "mcp": { "<name>": { "type": "remote", "url": "https://…", "enabled": true } } }
     ```
     Add `"oauth": {}` when the vendor's docs say the server uses OAuth. A local server is `{ "type": "local", "command": ["npx", "-y", "<pkg>"], "enabled": true }`.
   - **Skills:** install into `.claude/skills/<name>/` by the vendor's documented method. OpenCode also discovers `.claude/skills/`, so one copy serves both harnesses.

   Merge into existing files; never overwrite other servers. Secrets: reference environment variables or the harness's secret mechanism; never inline tokens and never commit credentials.
7. **Ask before writing persistent config.** MCP and skill installs change project configuration, so this is always a question, never automatic. Name each server or skill, its source URL and the files that would change. Ask with the harness's structured-question tool if it has one, otherwise in chat, and stop until the user answers. Install only what was approved, by the vendor's documented method.
8. **Record.** In the ADR (via `adr`, `senior-standards:adr`), link the docs page used and list each MCP server and skill added. In `AGENTS.md`, list the project's MCP servers and installed vendor skills, with the docs URL.

## Rules

- Docs are the source of truth. If they conflict with memory, the docs win; if the docs conflict with the ADR, ask.
- A package, MCP server or skill not covered by the accepted answer is not approved: run the gate again.
- If the vendor has no MCP server or skills, say so in the ADR and move on.
