import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { parseSetupRecord, SETUP_MARKER } from "../../core/setup-record.mjs";

const file = fileURLToPath(
  new URL("../../skills/project-init/SKILL.md", import.meta.url),
);
const read = () => readFile(file, "utf8");

// Spec 5.2 step 3: the three fact questions name what they turn on.
const QUESTIONS = [
  "Will the repo be public? (CodeQL code analysis, secret scanning with push protection, OpenSSF Scorecard, `SECURITY.md`)",
  "Will it be maintained over time? (Renovate dependency updates, dependency audit in CI)",
  "Versioned releases? (a `dev` branch with release PRs `dev` → `main`, release tooling, tags, generated release notes)",
  "Basic (README, `AGENTS.md`, `CONTRIBUTING.md`, decision records)",
  "Full (Basic plus requirements and architecture docs from `project-blueprint`)",
  "Light (CI build plus tests on the critical paths)",
  "Standard (tests written with each feature)",
  "Strict (test-first, coverage threshold enforced in CI)",
];

test("project-init skill exists", async () => {
  const text = await read();
  assert.ok(text.length > 0);
});

for (const question of QUESTIONS) {
  test(`project-init asks: ${question.slice(0, 40)}`, async () => {
    assert.ok((await read()).includes(question), `missing: ${question}`);
  });
}

test("project-init names the marker, item mode and the reminder", async () => {
  const text = await read();
  assert.ok(text.includes(SETUP_MARKER));
  assert.ok(text.includes("item mode"));
  assert.ok(text.includes("the reminder no longer applies"));
});

test("project-init's record template parses without problems", async () => {
  const text = await read();
  const block = /```markdown\r?\n([\s\S]*?)```/.exec(text);
  assert.ok(block, "record template block is missing");
  const record = parseSetupRecord(block[1]);
  assert.equal(record.found, true);
  assert.deepEqual(record.problems, []);
});
