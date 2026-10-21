import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { loadStandards } from "../../core/load-standards.mjs";

const FALLBACK =
  "senior-standards: standards file could not be loaded; follow the decision-gate skill before adding dependencies or services.";

test("standards text is under 60 lines", () => {
  const text = loadStandards();
  assert.notEqual(text, FALLBACK);
  assert.ok(text.split("\n").length < 60);
});

test("mentions docs/specs, docs/plans, project-blueprint, decision-gate, official-integration, AGENTS.md", () => {
  const text = loadStandards();
  for (const needle of [
    "docs/specs",
    "docs/plans",
    "project-blueprint",
    "senior-standards:project-blueprint",
    "decision-gate",
    "senior-standards:decision-gate",
    "official-integration",
    "senior-standards:official-integration",
    "AGENTS.md",
    "@AGENTS.md",
    "Context7",
  ]) {
    assert.ok(text.includes(needle), `missing ${needle}`);
  }
});

test("loader returns fallback when file is missing", () => {
  assert.equal(
    loadStandards(path.join(tmpdir(), "no-such-standards.md")),
    FALLBACK,
  );
});

test("loader strips leading frontmatter and trims", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "load-standards-"));
  try {
    const file = path.join(dir, "s.md");
    await writeFile(file, "---\nname: x\n---\n\n  Body text.\n\n");
    assert.equal(loadStandards(file), "Body text.");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("standards state explicit triggers and location preferences", () => {
  const text = loadStandards();
  for (const phrase of [
    "Before you propose, choose or install a dependency",
    "the user answers in chat before any install command runs",
    "The user prefers specs in `docs/specs/` and plans in `docs/plans/`, instead of any default location a skill suggests",
    "Whenever an approved spec starts a new project or introduces a new service, data store, framework or other stack choice",
    "Do not go straight from an approved spec to a plan.",
  ]) {
    assert.ok(text.includes(phrase), `missing ${phrase}`);
  }
});

test("standards forbid AI attribution in commits, PRs, comments and docs", () => {
  const text = loadStandards();
  for (const phrase of [
    "Never add AI attribution",
    "co-author trailers",
    '"Generated with/by …" footers',
    "commit messages, PR and issue titles and descriptions, review comments, code comments, docs or changelogs",
    "unless the content is genuinely about that tool",
  ]) {
    assert.ok(text.includes(phrase), `missing ${phrase}`);
  }
});
