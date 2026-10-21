import assert from "node:assert/strict";
import { test } from "node:test";
import { normalize } from "../../core/normalize.mjs";

test("claude Bash maps command to shell", () => {
  assert.deepEqual(normalize("claude", "Bash", { command: "npm i zod" }), {
    kind: "shell",
    command: "npm i zod",
  });
});

test("claude PowerShell maps command to shell", () => {
  assert.deepEqual(
    normalize("claude", "PowerShell", { command: "npm i zod" }),
    { kind: "shell", command: "npm i zod" },
  );
});

test("claude Write maps file_path and content to write", () => {
  assert.deepEqual(
    normalize("claude", "Write", { file_path: "a.txt", content: "hi" }),
    { kind: "write", filePath: "a.txt", content: "hi" },
  );
});

test("claude Edit maps snake_case fields to edit", () => {
  assert.deepEqual(
    normalize("claude", "Edit", {
      file_path: "a.txt",
      old_string: "x",
      new_string: "y",
      replace_all: true,
    }),
    {
      kind: "edit",
      filePath: "a.txt",
      oldString: "x",
      newString: "y",
      replaceAll: true,
    },
  );
});

test("claude Edit defaults replaceAll to false when absent", () => {
  assert.deepEqual(
    normalize("claude", "Edit", {
      file_path: "a.txt",
      old_string: "x",
      new_string: "y",
    }),
    {
      kind: "edit",
      filePath: "a.txt",
      oldString: "x",
      newString: "y",
      replaceAll: false,
    },
  );
});

test("opencode shell maps command to shell", () => {
  assert.deepEqual(normalize("opencode", "shell", { command: "pnpm add x" }), {
    kind: "shell",
    command: "pnpm add x",
  });
});

test("opencode write maps path and content to write", () => {
  assert.deepEqual(
    normalize("opencode", "write", { path: "b.txt", content: "yo" }),
    { kind: "write", filePath: "b.txt", content: "yo" },
  );
});

test("opencode edit maps path and camelCase fields to edit", () => {
  assert.deepEqual(
    normalize("opencode", "edit", {
      path: "b.txt",
      oldString: "x",
      newString: "y",
      replaceAll: false,
    }),
    {
      kind: "edit",
      filePath: "b.txt",
      oldString: "x",
      newString: "y",
      replaceAll: false,
    },
  );
});

test("opencode edit defaults replaceAll to false when absent", () => {
  assert.deepEqual(
    normalize("opencode", "edit", {
      path: "b.txt",
      oldString: "x",
      newString: "y",
    }),
    {
      kind: "edit",
      filePath: "b.txt",
      oldString: "x",
      newString: "y",
      replaceAll: false,
    },
  );
});

test("opencode patch maps patchText to patch", () => {
  assert.deepEqual(normalize("opencode", "patch", { patchText: "@@" }), {
    kind: "patch",
    patchText: "@@",
  });
});

test("unknown tool returns null", () => {
  assert.equal(normalize("claude", "Read", { file_path: "a" }), null);
  assert.equal(normalize("opencode", "read", { filePath: "a" }), null);
});

test("unknown harness returns null", () => {
  assert.equal(normalize("cursor", "Bash", { command: "ls" }), null);
});

test("missing required fields return null rather than throwing", () => {
  assert.equal(normalize("claude", "Bash", {}), null);
  assert.equal(normalize("claude", "Write", { file_path: "a" }), null);
  assert.equal(
    normalize("claude", "Edit", { file_path: "a", old_string: "x" }),
    null,
  );
  assert.equal(normalize("opencode", "patch", {}), null);
  // OpenCode v2.1.2 names the file field "path"; "filePath" is not accepted.
  assert.equal(
    normalize("opencode", "write", { filePath: "a", content: "x" }),
    null,
  );
  assert.equal(normalize("opencode", "shell", { command: 3 }), null);
});

test("missing or non-object input returns null rather than throwing", () => {
  assert.equal(normalize("claude", "Bash", undefined), null);
  assert.equal(normalize("claude", "Bash", null), null);
  assert.equal(normalize("claude", "Bash", "ls"), null);
});

test("non-boolean replaceAll is rejected", () => {
  assert.equal(
    normalize("claude", "Edit", {
      file_path: "a",
      old_string: "x",
      new_string: "y",
      replace_all: "yes",
    }),
    null,
  );
});
