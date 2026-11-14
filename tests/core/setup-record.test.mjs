import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  integrationBranch,
  parseSetupRecord,
  REMINDER,
  readSetupRecord,
  SETUP_MARKER,
  setupReminder,
} from "../../core/setup-record.mjs";

const RECORD = `## Project setup

${SETUP_MARKER}
- Goal: Ship a thing.
- Docs: basic
- Tests: standard
- Public repository: no
- Maintained over time: yes
- Versioned releases: no
- Overrides: none
- Recorded: 2026-11-14
`;

const nullGit = { topLevel: async () => null };

function tempDir() {
  return mkdtemp(path.join(tmpdir(), "setup-record-"));
}

test("parses the spec example", () => {
  const r = parseSetupRecord(RECORD);
  assert.equal(r.found, true);
  assert.equal(r.values.docs, "basic");
  assert.equal(r.values.tests, "standard");
  assert.equal(r.values.versioned, "no");
  assert.equal(r.values.goal, "Ship a thing.");
  assert.equal(r.values.recorded, "2026-11-14");
  assert.deepEqual(r.problems, []);
});

test("labels are case-insensitive; values lowercased except goal and overrides", () => {
  const r = parseSetupRecord(
    `${SETUP_MARKER}\n- GOAL: Keep Case\n- DOCS: FULL\n- tests: Strict\n- PUBLIC REPOSITORY: Yes\n- maintained over time: NO\n- Versioned Releases: YES\n- OVERRIDES: S2 On: Reason\n`,
  );
  assert.equal(r.values.goal, "Keep Case");
  assert.equal(r.values.docs, "full");
  assert.equal(r.values.tests, "strict");
  assert.equal(r.values.public, "yes");
  assert.equal(r.values.maintained, "no");
  assert.equal(r.values.versioned, "yes");
  assert.equal(r.values.overrides, "S2 On: Reason");
  assert.deepEqual(r.problems, []);
});

test("reports invalid and missing values", () => {
  const r = parseSetupRecord(RECORD.replace("Tests: standard", "Tests: heavy"));
  assert.ok(
    r.problems.includes('Tests: "heavy" is not one of light, standard, strict'),
  );
  const m = parseSetupRecord(RECORD.replace("- Docs: basic\n", ""));
  assert.ok(m.problems.includes("Docs: missing"));
});

test("no marker means not found", () => {
  assert.deepEqual(parseSetupRecord("# Hi\n- Docs: basic\n"), {
    found: false,
    values: {},
    problems: [],
  });
});

test("stops at the next heading", () => {
  const r = parseSetupRecord(`${RECORD}\n## Other\n- Tests: heavy\n`);
  assert.deepEqual(r.problems, []);
  assert.equal(r.values.tests, "standard");
});

test("CRLF and BOM parse like LF", () => {
  const r = parseSetupRecord(`﻿${RECORD.replace(/\n/g, "\r\n")}`);
  assert.deepEqual(r, parseSetupRecord(RECORD));
  assert.equal(r.found, true);
});

test("integrationBranch is dev only for versioned yes", () => {
  assert.equal(integrationBranch({ versioned: "yes" }), "dev");
  assert.equal(integrationBranch({ versioned: "no" }), "main");
  assert.equal(integrationBranch({}), "main");
});

test("readSetupRecord reads AGENTS.md at the Git top level", async () => {
  const parent = await tempDir();
  try {
    const dir = path.join(parent, "sub");
    await mkdir(dir);
    await writeFile(path.join(parent, "AGENTS.md"), RECORD);
    const r = await readSetupRecord(dir, { topLevel: async () => parent });
    assert.equal(r.root, parent);
    assert.equal(r.found, true);
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

test("readSetupRecord falls back to the directory itself", async () => {
  const dir = await tempDir();
  try {
    await writeFile(path.join(dir, "AGENTS.md"), RECORD);
    const r = await readSetupRecord(dir, nullGit);
    assert.equal(r.root, dir);
    assert.equal(r.found, true);
    const none = await readSetupRecord(path.join(dir, "missing"), nullGit);
    assert.equal(none.found, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("reads at most 256 KB", async () => {
  const dir = await tempDir();
  try {
    const filler = "x".repeat(300 * 1024);
    await writeFile(path.join(dir, "AGENTS.md"), `${RECORD}\n${filler}`);
    assert.equal((await readSetupRecord(dir, nullGit)).found, true);
    await writeFile(path.join(dir, "AGENTS.md"), `${filler}\n${RECORD}`);
    assert.equal((await readSetupRecord(dir, nullGit)).found, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("setupReminder", async () => {
  const dir = await tempDir();
  try {
    assert.equal(await setupReminder(dir, nullGit), null);
    await writeFile(path.join(dir, "package.json"), "{}");
    assert.equal(await setupReminder(dir, nullGit), REMINDER);
    await writeFile(path.join(dir, "AGENTS.md"), RECORD);
    assert.equal(await setupReminder(dir, nullGit), null);
    await writeFile(
      path.join(dir, "AGENTS.md"),
      RECORD.replace("Tests: standard", "Tests: heavy"),
    );
    const text = await setupReminder(dir, nullGit);
    assert.ok(text.startsWith(REMINDER));
    assert.ok(text.includes("Setup record problems: Tests:"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("a git work tree is a project even without manifests", async () => {
  const dir = await tempDir();
  try {
    assert.equal(
      await setupReminder(dir, { topLevel: async () => dir }),
      REMINDER,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("a throwing reader is treated as null", async () => {
  const dir = await tempDir();
  try {
    const git = {
      topLevel: async () => {
        throw new Error("boom");
      },
    };
    assert.equal(await setupReminder(dir, git), null);
    const r = await readSetupRecord(dir, git);
    assert.equal(r.root, dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
