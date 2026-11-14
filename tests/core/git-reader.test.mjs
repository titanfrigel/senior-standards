import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { createGitReader } from "../../core/git-reader.mjs";

async function tempDir() {
  return realpath(await mkdtemp(path.join(tmpdir(), "git-reader-")));
}

test("topLevel resolves null when git fails (not a repository)", async () => {
  const git = createGitReader({
    execFile: (_f, _a, _o, cb) => cb(new Error("not a git repository")),
  });
  assert.equal(await git.topLevel("."), null);
});

test("topLevel resolves null in a real non-repo temp dir", async () => {
  const dir = await tempDir();
  try {
    const git = createGitReader();
    const top = await git.topLevel(dir);
    // A temp dir nested inside some repository would resolve to that repository.
    if (top !== null) {
      assert.notEqual(path.resolve(top), path.resolve(dir));
    } else {
      assert.equal(top, null);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("topLevel resolves the repository path in a repo", async () => {
  const dir = await tempDir();
  try {
    execFileSync("git", ["init", "-b", "main"], { cwd: dir, stdio: "ignore" });
    const git = createGitReader();
    const top = await git.topLevel(dir);
    assert.equal(path.resolve(top), path.resolve(dir));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("a slow git call resolves null at the timeout", async () => {
  const git = createGitReader({
    timeoutMs: 1,
    execFile: (_f, _a, _o, cb) => setTimeout(() => cb(null, "late\n"), 200),
  });
  assert.equal(await git.topLevel("."), null);
});

test("empty output and thrown errors resolve null", async () => {
  const empty = createGitReader({
    execFile: (_f, _a, _o, cb) => cb(null, "\n"),
  });
  assert.equal(await empty.defaultBranch("."), null);
  const thrower = createGitReader({
    execFile: () => {
      throw new Error("spawn failed");
    },
  });
  assert.equal(await thrower.currentBranch("."), null);
});

test("passes git arguments and cwd", async () => {
  const calls = [];
  const git = createGitReader({
    execFile: (file, args, opts, cb) => {
      calls.push({ file, args, cwd: opts.cwd });
      cb(null, "x\n");
    },
  });
  assert.equal(await git.defaultBranch("/d"), "x");
  assert.deepEqual(calls[0], {
    file: "git",
    args: ["config", "--get", "init.defaultBranch"],
    cwd: "/d",
  });
});
