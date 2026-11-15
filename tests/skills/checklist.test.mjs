import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const read = (relative) =>
  readFile(
    fileURLToPath(new URL(`../../skills/${relative}`, import.meta.url)),
    "utf8",
  ).then((text) => text.replace(/\r\n/g, "\n"));

// Spec 5.3: one row per setting.
const SETTINGS = [
  "Always",
  "Docs: basic",
  "Docs: full",
  "Tests: light",
  "Tests: standard",
  "Tests: strict",
  "Public: yes",
  "Maintained: yes",
  "Versioned: yes",
  "Versioned: no",
];

/** Text from `start` up to the next heading of the same or a higher level. */
function section(text, heading) {
  const level = /^#+/.exec(heading)[0].length;
  const lines = text.split("\n");
  const begin = lines.findIndex((line) => line.trimEnd() === heading);
  assert.notEqual(begin, -1, `missing heading: ${heading}`);
  let end = lines.length;
  for (let i = begin + 1; i < lines.length; i += 1) {
    const match = /^(#+) /.exec(lines[i]);
    if (match && match[1].length <= level && !inFence(lines, i)) {
      end = i;
      break;
    }
  }
  return lines.slice(begin, end).join("\n");
}

function inFence(lines, index) {
  let open = false;
  for (let i = 0; i < index; i += 1) {
    if (lines[i].startsWith("```")) open = !open;
  }
  return open;
}

/** Headings of checklist items with this ID, e.g. `#### T1 ...`. */
function itemHeadings(text, id) {
  const lines = text.split("\n");
  return lines.filter(
    (line, i) => new RegExp(`^#+ ${id}( |$)`).test(line) && !inFence(lines, i),
  );
}

const checklist = () => read("repo-standards/checklist.md");
const part2 = async () => section(await checklist(), "## Part 2: baseline");

test("checklist part 2 splits into Always and By setup record", async () => {
  const text = await part2();
  section(text, "### Always");
  section(text, "### By setup record");
});

for (const setting of SETTINGS) {
  test(`checklist has a table row for ${setting}`, async () => {
    const byRecord = section(await part2(), "### By setup record");
    assert.ok(
      byRecord.split("\n").some((line) => line.startsWith(`| ${setting} |`)),
      `missing row: ${setting}`,
    );
  });
}

test("S1 is split: gitleaks under Always, GitHub-native under Public", async () => {
  const text = await part2();
  assert.equal(itemHeadings(await checklist(), "S1").length, 2);
  const always = itemHeadings(section(text, "### Always"), "S1");
  assert.equal(always.length, 1);
  assert.match(always[0], /gitleaks/);
  const publicItems = itemHeadings(section(text, "#### Public: yes"), "S1");
  assert.equal(publicItems.length, 1);
  assert.match(publicItems[0], /secret scanning/);
});

test("D6 dependency check is under Always with the vendored folder", async () => {
  const always = section(await part2(), "### Always");
  const d6 = section(always, "#### D6 Dependency check in CI");
  for (const needle of [
    "vendor-dependency-check.mjs",
    "fetch-depth: 0",
    "node .github/scripts/senior-standards/core/dependency-check.mjs --base",
    "status: accepted",
    "packages",
    "#ref",
    "block-list",
    "cannot be parsed",
    "warning",
    "lockfile-only",
    "VERSION",
  ]) {
    assert.ok(d6.includes(needle), `D6 does not mention: ${needle}`);
  }
});

test("T1 appears only under Tests: strict, A1 only under Docs: full", async () => {
  const full = await checklist();
  const text = await part2();
  assert.equal(itemHeadings(full, "T1").length, 1);
  assert.equal(
    itemHeadings(section(text, "#### Tests: strict"), "T1").length,
    1,
  );
  assert.equal(itemHeadings(full, "A1").length, 1);
  assert.equal(itemHeadings(section(text, "#### Docs: full"), "A1").length, 1);
});

test("Versioned items and the release template sit under Versioned: yes", async () => {
  const versioned = section(await part2(), "#### Versioned: yes");
  for (const id of ["V1", "V3", "V4"]) {
    assert.equal(itemHeadings(versioned, id).length, 1, `missing ${id}`);
  }
  assert.ok(versioned.includes(".github/PULL_REQUEST_TEMPLATE/release.md"));
});

test("R1 covers dev when Versioned is yes", async () => {
  const r1 = section(await part2(), "#### R1 Ruleset on main (and dev)");
  assert.match(r1, /`dev`/);
  assert.match(r1, /first/);
});

const PR_SECTIONS = [
  "## Summary",
  "## Motivation",
  "## Changes",
  "## How it was tested",
  "## Risks and rollback",
  "## Links",
];
const RELEASE_SECTIONS = [
  "## Version",
  "## Highlights",
  "## Included pull requests",
  "## Breaking changes",
  "## Upgrade notes",
];

function assertHeadingsInOrder(text, headings) {
  const lines = text.split("\n").map((line) => line.trimEnd());
  let last = -1;
  for (const heading of headings) {
    const at = lines.indexOf(heading);
    assert.ok(at > last, `missing or out of order: ${heading}`);
    last = at;
  }
}

test("PR template has the review sections in order", async () => {
  const text = await read("repo-standards/templates/pull_request_template.md");
  assertHeadingsInOrder(text, PR_SECTIONS);
  assert.doesNotMatch(text, /senior-standards|\b(TODO|TBD)\b/);
});

test("release template has the release sections in order", async () => {
  const text = await read("repo-standards/templates/release.md");
  assertHeadingsInOrder(text, RELEASE_SECTIONS);
  assert.doesNotMatch(text, /senior-standards|\b(TODO|TBD)\b/);
});

test("repo-standards reads the record and defines item mode and ordering", async () => {
  const text = await read("repo-standards/SKILL.md");
  for (const needle of [
    "## Project setup",
    "Overrides",
    "## Item mode",
    "vendor-dependency-check.mjs",
    "release.md",
    "`dev`",
    "after the CI workflow has reported",
  ]) {
    assert.ok(
      text.includes(needle),
      `repo-standards does not mention: ${needle}`,
    );
  }
});

test("audit lists one drift check per setting", async () => {
  const drift = section(await read("audit/SKILL.md"), "## Setup record drift");
  for (const setting of SETTINGS) {
    assert.ok(
      drift.split("\n").some((line) => line.startsWith(`| ${setting} |`)),
      `audit has no drift check for ${setting}`,
    );
  }
  assert.match(drift, /no setup record/i);
  assert.ok(drift.includes(".github/scripts/senior-standards/"));
  assert.ok(drift.includes("VERSION"));
});

const ID_HEADING = /^#+ [A-Z]\d+ /;

test("every item in checklist part 2 has an ID", async () => {
  const text = await part2();
  const check = (block, prefix) => {
    const lines = block.split("\n");
    const headings = lines.filter(
      (line, i) => line.startsWith(prefix) && !inFence(lines, i),
    );
    assert.ok(headings.length > 0, `no ${prefix.trim()} headings`);
    for (const heading of headings) {
      assert.match(heading, ID_HEADING, `item without an ID: ${heading}`);
    }
  };
  check(section(text, "### Always"), "#### ");
  check(section(text, "### By setup record"), "##### ");
});

test("every ID project-init's effects table lists exists in the checklist", async () => {
  const init = section(
    await read("project-init/SKILL.md"),
    "## What each answer turns on",
  );
  const ids = new Set(init.match(/\b[A-Z]\d+\b/g));
  for (const id of ["C4", "D7", "R7", "V5"]) {
    assert.ok(ids.has(id), `project-init does not list ${id}`);
  }
  const full = await checklist();
  // Part 3 optional items are table rows, not headings.
  const optional = section(
    full,
    "## Part 3: optional items (offer once, per project)",
  );
  for (const id of ids) {
    const found =
      itemHeadings(full, id).length > 0 ||
      optional.split("\n").some((line) => line.startsWith(`| ${id} `));
    assert.ok(found, `no item ${id}`);
  }
});

test("new IDs sit under their setting", async () => {
  const text = await part2();
  assert.equal(itemHeadings(section(text, "### Always"), "C4").length, 1);
  const maintained = section(text, "#### Maintained: yes");
  assert.equal(itemHeadings(maintained, "D7").length, 1);
  const versioned = section(text, "#### Versioned: yes");
  for (const id of ["R7", "V5"]) {
    assert.equal(itemHeadings(versioned, id).length, 1, `missing ${id}`);
  }
});

test("CI runs on PRs into main and, when versioned, dev", async () => {
  const always = section(await part2(), "### Always");
  const r5 = section(always, "#### R5 One `check` entry point");
  assert.match(r5, /into `main`, and into `dev` too when Versioned is `yes`/);
  const d6 = section(always, "#### D6 Dependency check in CI");
  assert.match(d6, /branches: \[main\]/);
  assert.match(d6, /add dev when Versioned is yes/);
  assert.doesNotMatch(r5, /runs on PRs into the integration branch/);
});
