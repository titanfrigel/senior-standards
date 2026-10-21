import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { buildIndex, renderIndex } from "../../scripts/adr-index.mjs";

const run = promisify(execFile);
const script = fileURLToPath(
  new URL("../../scripts/adr-index.mjs", import.meta.url),
);

async function project() {
  const dir = await mkdtemp(path.join(tmpdir(), "adr-script-"));
  const adr = path.join(dir, "docs", "adr");
  await mkdir(adr, { recursive: true });
  await writeFile(
    path.join(adr, "0002-use-postgres.md"),
    "---\r\nstatus: accepted\r\ndate: 2026-02-03\r\npackages: [pg]\r\n---\r\n\r\n# Use Postgres\r\n\r\nBody\r\n",
  );
  await writeFile(
    path.join(adr, "0001-record-decisions.md"),
    "---\nstatus: superseded\ndate: 2026-01-02\npackages: []\n---\n\n# Record decisions\n",
  );
  await writeFile(path.join(adr, "README.md"), "stale");
  await writeFile(path.join(adr, "notes.md"), "# not an ADR\n");
  return dir;
}

test("buildIndex lists ADRs in number order with status and date", async () => {
  const dir = await project();
  const out = await buildIndex(dir);
  const rows = out.split("\n").filter((l) => /^\| \d{4} /.test(l));
  assert.deepEqual(rows, [
    "| 0001 | [Record decisions](0001-record-decisions.md) | superseded | 2026-01-02 |",
    "| 0002 | [Use Postgres](0002-use-postgres.md) | accepted | 2026-02-03 |",
  ]);
  assert.match(out, /<!-- .*generated/i);
  assert.match(out, /\| Number \| Title \| Status \| Date \|/);
});

test("renderIndex is pure and handles empty input", () => {
  assert.equal(renderIndex([]), renderIndex([]));
  assert.doesNotMatch(renderIndex([]), /^\| \d{4}/m);
});

test("CLI writes README.md idempotently", async () => {
  const dir = await project();
  await run(process.execPath, [script, dir]);
  const readme = path.join(dir, "docs", "adr", "README.md");
  const first = await readFile(readme, "utf8");
  assert.match(first, /\| 0002 \| \[Use Postgres\]/);
  await run(process.execPath, [script, dir]);
  assert.equal(await readFile(readme, "utf8"), first);
});

test("CLI exits non-zero when docs/adr is missing", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "adr-script-empty-"));
  await assert.rejects(run(process.execPath, [script, dir]), (error) => {
    assert.notEqual(error.code, 0);
    assert.match(error.stderr, /docs.adr/);
    return true;
  });
});

test("renderIndex escapes pipes in titles", () => {
  const out = renderIndex([
    {
      number: "0001",
      file: "0001-a-b.md",
      title: "Use A | B",
      status: "accepted",
      date: "2026-01-01",
    },
  ]);
  assert.ok(out.includes(String.raw`[Use A \| B](0001-a-b.md)`));
});
