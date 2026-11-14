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

test("CONTRIBUTING template reads without the plugin and has the workflow sections", async () => {
  const text = await read("CONTRIBUTING.md");
  assert.doesNotMatch(text, /senior-standards/);
  for (const h of ["Workflow", "Language", "Tests", "Hooks", "Dependencies"]) {
    assert.match(text, new RegExp(`^## ${h}$`, "m"), h);
  }
  assert.match(text, /<type>\/<short-topic>/);
  assert.match(text, /integration branch/);
  assert.match(text, /dev.*main/);
  assert.match(text, /English/);
  assert.match(text, /accepted ADR/);
  assert.match(text, /CI/);
});

test("AGENTS template has a setup record section with fill placeholders", async () => {
  const text = await read("AGENTS.md");
  assert.match(text, /^## Project setup$/m);
  assert.match(text, /<!-- senior-standards:setup v1 -->/);
  for (const label of [
    "Goal",
    "Docs",
    "Tests",
    "Public repository",
    "Maintained over time",
    "Versioned releases",
    "Overrides",
    "Recorded",
  ]) {
    assert.match(text, new RegExp(`^- ${label}: <!-- fill`, "m"), label);
  }
});

test("project-blueprint skill follows the docs level", async () => {
  const skill = await readFile(
    fileURLToPath(
      new URL("../../skills/project-blueprint/SKILL.md", import.meta.url),
    ),
    "utf8",
  );
  assert.match(skill, /setup record/);
  assert.match(skill, /Docs: basic|Docs `basic`/);
  assert.match(
    skill,
    /skip steps 2 and 4|skips? (the )?(requirements|steps 2)/i,
  );
});

test("project-blueprint skill drops dead README links by setup record", async () => {
  const skill = await readFile(
    fileURLToPath(
      new URL("../../skills/project-blueprint/SKILL.md", import.meta.url),
    ),
    "utf8",
  );
  assert.match(
    skill,
    /requirements and architecture documents in `README\.md`/,
  );
  assert.match(skill, /omit the Security policy link from `README\.md`/);
  assert.doesNotMatch(skill, /## Scope\n\n\n/);
});
