import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const names = [
  "README.md",
  "requirements.md",
  "architecture-overview.md",
  "CONTRIBUTING.md",
  "AGENTS.md",
  "CLAUDE.md",
  "SECURITY.md",
];

const read = (name) =>
  readFile(
    fileURLToPath(
      new URL(
        `../../skills/project-blueprint/templates/${name}`,
        import.meta.url,
      ),
    ),
    "utf8",
  );

for (const name of names) {
  test(`template ${name} exists and has no TODO/TBD`, async () => {
    const text = await read(name);
    assert.ok(text.length > 0);
    assert.doesNotMatch(text, /\b(TODO|TBD)\b/);
  });
}

test("CLAUDE.md template is exactly the AGENTS.md import", async () => {
  assert.equal(await read("CLAUDE.md"), "@AGENTS.md\n");
});

test("architecture template has threat model, layer rules and mermaid", async () => {
  const text = await read("architecture-overview.md");
  assert.match(text, /## \d+\. Threat model/);
  assert.match(text, /## \d+\. Layer rules/);
  assert.match(text, /```mermaid[\s\S]*C4Context/);
  assert.match(text, /```mermaid[\s\S]*C4Container/);
});
