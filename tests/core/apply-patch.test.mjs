import assert from "node:assert/strict";
import { test } from "node:test";
import { applyUpdate, parsePatch } from "../../core/apply-patch.mjs";

const patch = `*** Begin Patch
*** Add File: a.txt
+one
+two
*** Update File: b.txt
@@
 keep
-old
+new
*** Delete File: c.txt
*** End Patch`;

test("parsePatch reads add, update and delete sections", () => {
  const sections = parsePatch(patch);
  assert.deepEqual(
    sections.map((s) => [s.op, s.path]),
    [
      ["add", "a.txt"],
      ["update", "b.txt"],
      ["delete", "c.txt"],
    ],
  );
  assert.deepEqual(sections[0].lines, ["+one", "+two"]);
  assert.deepEqual(sections[1].lines, ["@@", " keep", "-old", "+new"]);
});

test("parsePatch handles CRLF and skips Move to", () => {
  const sections = parsePatch(
    "*** Begin Patch\r\n*** Update File: x\r\n*** Move to: y\r\n@@\r\n-a\r\n+b\r\n*** End Patch",
  );
  assert.equal(sections[0].path, "x");
  assert.deepEqual(sections[0].lines, ["@@", "-a", "+b"]);
});

test("applyUpdate replaces context and removed lines in order", () => {
  const out = applyUpdate("a\nkeep\nold\nz\n", ["@@", " keep", "-old", "+new"]);
  assert.equal(out, "a\nkeep\nnew\nz\n");
});

test("applyUpdate applies several hunks", () => {
  const out = applyUpdate("1\n2\n3\n4\n", [
    "@@",
    "-1",
    "+one",
    "@@",
    "-4",
    "+four",
  ]);
  assert.equal(out, "one\n2\n3\nfour\n");
});

test("applyUpdate throws when a hunk does not match", () => {
  assert.throws(
    () => applyUpdate("a\n", ["@@", "-zzz", "+y"]),
    /did not match/,
  );
});

test("applyUpdate with an insert-only hunk appends", () => {
  assert.equal(applyUpdate("a\n", ["@@", "+b"]), "a\nb\n");
});

test("parsePatch records moveTo", () => {
  const [s] = parsePatch(
    "*** Begin Patch\n*** Update File: x\n*** Move to: y\n@@\n-a\n+b\n*** End Patch",
  );
  assert.equal(s.moveTo, "y");
});

test("applyUpdate seeks the @@ header line before matching", () => {
  const out = applyUpdate("[a]\n\n[b]\n\nz\n", ["@@ [b]", " ", "+n"]);
  assert.equal(out, "[a]\n\n[b]\n\nn\nz\n");
});

test("applyUpdate throws on an ambiguous hunk", () => {
  assert.throws(
    () => applyUpdate("a\n\nb\n\n", ["@@", " ", "+n"]),
    /ambiguous/,
  );
});
