import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  parseFrontmatter,
  readApprovedPackages,
} from "../../core/adr-index.mjs";

async function project(files) {
  const dir = await mkdtemp(path.join(tmpdir(), "adr-index-"));
  await mkdir(path.join(dir, "docs", "adr"), { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    await writeFile(path.join(dir, "docs", "adr", name), content);
  }
  return dir;
}

async function approved(files) {
  const dir = await project(files);
  try {
    return await readApprovedPackages(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const adr = (status, packagesLine) =>
  `---\nstatus: ${status}\ndate: 2026-10-21\n${packagesLine}\n---\n\n# T\n`;

test("accepted ADR approves its packages", async () => {
  const r = await approved({
    "0003-auth.md": adr("accepted", "packages: [better-auth]"),
  });
  assert.deepEqual([...r.approved], ["better-auth"]);
  assert.deepEqual(r.problems, []);
});

test("proposed, superseded and rejected ADRs approve nothing", async () => {
  const r = await approved({
    "0003-a.md": adr("proposed", "packages: [a]"),
    "0004-b.md": adr("superseded", "packages: [b]"),
    "0005-c.md": adr("rejected", "packages: [c]"),
  });
  assert.equal(r.approved.size, 0);
  assert.deepEqual(r.problems, []);
});

test("block list and inline list both parse", async () => {
  const inline = await approved({
    "0003-a.md": adr("accepted", "packages: [zod, valibot]"),
  });
  const block = await approved({
    "0003-a.md": adr("accepted", "packages:\n  - zod\n  - valibot"),
  });
  assert.deepEqual([...inline.approved], ["zod", "valibot"]);
  assert.deepEqual([...block.approved], ["zod", "valibot"]);
});

test("scalar packages counts as one; missing packages approves nothing", async () => {
  const r = await approved({
    "0003-a.md": adr("accepted", "packages: zod"),
    "0004-b.md": "---\nstatus: accepted\ndate: 2026-10-21\n---\n",
  });
  assert.deepEqual([...r.approved], ["zod"]);
  assert.deepEqual(r.problems, []);
});

test("CRLF and BOM are handled", async () => {
  const text = `﻿${adr("accepted", "packages:\n  - zod").replaceAll("\n", "\r\n")}`;
  const r = await approved({ "0003-a.md": text });
  assert.deepEqual([...r.approved], ["zod"]);
  assert.deepEqual(r.problems, []);
});

test("missing docs/adr gives empty set and no problems", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "adr-index-"));
  try {
    const r = await readApprovedPackages(dir);
    assert.equal(r.approved.size, 0);
    assert.deepEqual(r.problems, []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("ADR without frontmatter is reported, not fatal", async () => {
  const r = await approved({
    "0003-bad.md": "# no frontmatter\n",
    "0004-ok.md": adr("accepted", "packages: [zod]"),
  });
  assert.equal(r.problems.length, 1);
  assert.match(r.problems[0], /0003-bad\.md/);
  assert.deepEqual([...r.approved], ["zod"]);
});

test("non-.md files are ignored", async () => {
  const r = await approved({
    "notes.txt": adr("accepted", "packages: [zod]"),
    README: "no frontmatter",
  });
  assert.equal(r.approved.size, 0);
  assert.deepEqual(r.problems, []);
});

test("parseFrontmatter handles quotes, empty lists and absence", () => {
  assert.deepEqual(
    parseFrontmatter("---\nname: \"x y\"\ntags: []\nother: 'q'\n---\nbody"),
    { name: "x y", tags: [], other: "q" },
  );
  assert.equal(parseFrontmatter("no frontmatter"), null);
  assert.equal(parseFrontmatter("---\nunterminated"), null);
});
