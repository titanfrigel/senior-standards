import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { parseFrontmatter } from "../../core/adr-index.mjs";

const skillsDir = fileURLToPath(new URL("../../skills", import.meta.url));

// Skill folders are enumerated at run time so a new skill is checked
// automatically; a folder without SKILL.md fails the test.
const folders = (await readdir(skillsDir, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const CLAUDE_ONLY_TOOLS = ["AskUserQuestion", "TodoWrite", "Bash("];

function rawFrontmatter(text) {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  assert.equal(lines[0].trimEnd(), "---", "frontmatter must open with ---");
  const end = lines.findIndex((line, i) => i > 0 && line.trimEnd() === "---");
  assert.notEqual(end, -1, "frontmatter must close with ---");
  return lines.slice(1, end);
}

test("skills directory contains at least one skill", () => {
  assert.ok(folders.length > 0);
});

test("every skill folder has a SKILL.md", async () => {
  for (const folder of folders) {
    const text = await readFile(
      path.join(skillsDir, folder, "SKILL.md"),
      "utf8",
    ).catch(() => null);
    assert.notEqual(text, null, `${folder}/SKILL.md is missing`);
  }
});

for (const folder of folders) {
  test(`skills/${folder}/SKILL.md follows the cross-harness format`, async () => {
    const file = path.join(skillsDir, folder, "SKILL.md");
    const text = await readFile(file, "utf8");
    const meta = parseFrontmatter(text);
    assert.ok(meta, "frontmatter block is missing or unparsable");

    // Only name and description are allowed.
    assert.deepEqual(Object.keys(meta).sort(), ["description", "name"]);

    // Every frontmatter line is a single-line `key: value` pair, so no
    // block scalars or folded continuation lines.
    for (const line of rawFrontmatter(text)) {
      assert.match(
        line,
        /^[A-Za-z0-9_-]+:\s*\S/,
        `not a single-line pair: ${line}`,
      );
    }

    const { name, description } = meta;
    assert.match(name, NAME_PATTERN);
    assert.ok(name.length <= 64, "name exceeds 64 characters");
    assert.equal(name, folder, "name must equal the folder name");

    assert.equal(typeof description, "string");
    assert.ok(description.length >= 1 && description.length <= 1024);
    assert.ok(
      !description.startsWith("["),
      "description must not start with [ (parsed as a list)",
    );
    assert.ok(
      description.startsWith("Use when"),
      "description must start with 'Use when'",
    );

    const body = text
      .split(/\r?\n/)
      .slice(rawFrontmatter(text).length + 2)
      .join("\n");
    for (const tool of CLAUDE_ONLY_TOOLS) {
      assert.ok(!body.includes(tool), `body names Claude-only tool ${tool}`);
    }
  });
}
