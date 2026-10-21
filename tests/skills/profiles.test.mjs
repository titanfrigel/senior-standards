import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const profiles = ["typescript-node", "dotnet", "rust", "python", "go"];

const sections = [
  "Toolchain pin",
  "Package manager and lockfile",
  "Supply-chain settings",
  "Build",
  "Format",
  "Lint and static analysis",
  "Type strictness",
  "Tests and coverage",
  "Unused code and dependencies",
  "Dependency audit",
  "Architecture rules",
  "Release and publishing",
  "Check entry point",
  "Sources",
];

const read = (name) =>
  readFile(
    fileURLToPath(
      new URL(
        `../../skills/repo-standards/profiles/${name}.md`,
        import.meta.url,
      ),
    ),
    "utf8",
  );

function splitSections(text) {
  const parts = text.split(/^## /m).slice(1);
  return parts.map((part) => {
    const newline = part.indexOf("\n");
    return {
      title: part.slice(0, newline).trim(),
      body: part.slice(newline + 1),
    };
  });
}

for (const name of profiles) {
  test(`profile ${name} has the 14 sections in order`, async () => {
    const found = splitSections(await read(name));
    assert.deepEqual(
      found.map((section) => section.title),
      sections,
    );
  });

  test(`profile ${name} names at least two tools per concern`, async () => {
    const found = splitSections(await read(name));
    for (const section of found.slice(0, -1)) {
      const tools = section.body.match(/`[^`\n]+`/g) ?? [];
      assert.ok(
        tools.length >= 2,
        `${name}: "${section.title}" names ${tools.length} tools`,
      );
    }
  });

  test(`profile ${name} cites sources with an https URL and an ISO date`, async () => {
    const found = splitSections(await read(name));
    const sources = found.at(-1);
    assert.match(sources.body, /https:\/\//);
    assert.match(sources.body, /\b\d{4}-\d{2}-\d{2}\b/);
  });
}

test("checklist lists the 13 concerns", async () => {
  const text = await readFile(
    fileURLToPath(
      new URL("../../skills/repo-standards/checklist.md", import.meta.url),
    ),
    "utf8",
  );
  for (const title of sections.slice(0, -1)) {
    assert.ok(text.includes(title), `checklist misses "${title}"`);
  }
});
