import assert from "node:assert/strict";
import { test } from "node:test";
import { branchHygieneReasons } from "../../core/branch-hygiene.mjs";

const INIT = 'Initialise the repository with "git init -b main".';
const MASTER = "The default branch is main, not master.";
const PUSH = (b) =>
  `Changes reach ${b} through a pull request, not a direct push.`;

const reader = ({ defaultBranch = null, currentBranch = null } = {}) => ({
  defaultBranch: async () => defaultBranch,
  currentBranch: async () => currentBranch,
});
const run = (command, git = reader(), versioned) =>
  branchHygieneReasons(command, "/proj", { git, versioned });

test("git init without -b asks unless init.defaultBranch is main", async () => {
  assert.deepEqual(await run("git init", reader({ defaultBranch: "master" })), [
    INIT,
  ]);
  assert.deepEqual(await run("git init"), [INIT]);
  assert.deepEqual(
    await run("git init", reader({ defaultBranch: "main" })),
    [],
  );
});

test("git init with an explicit branch is judged by that branch", async () => {
  assert.deepEqual(await run("git init -b main"), []);
  assert.deepEqual(await run("git init --initial-branch=main"), []);
  assert.deepEqual(await run("git init --initial-branch main"), []);
  assert.deepEqual(await run("git init -b master"), [MASTER]);
});

test("creating a master branch asks", async () => {
  assert.deepEqual(await run("git branch master"), [MASTER]);
  assert.deepEqual(await run("git checkout -b master"), [MASTER]);
  assert.deepEqual(await run("git switch -c master"), [MASTER]);
  assert.deepEqual(await run("git branch masterclass"), []);
  assert.deepEqual(await run("git checkout master"), []);
  assert.deepEqual(await run("git branch -d master"), []);
});

test("direct pushes to main ask", async () => {
  for (const cmd of [
    "git push -u origin main",
    "git push origin feature:main",
    "git push origin HEAD:refs/heads/main",
    "git push --force origin main",
    "git push -o ci.skip origin main",
  ]) {
    assert.deepEqual(await run(cmd), [PUSH("main")], cmd);
  }
  assert.deepEqual(await run("git push", reader({ currentBranch: "main" })), [
    PUSH("main"),
  ]);
  assert.deepEqual(
    await run("git push origin HEAD", reader({ currentBranch: "main" })),
    [PUSH("main")],
  );
});

test("pushes to other branches pass", async () => {
  assert.deepEqual(await run("git push origin main-docs"), []);
  assert.deepEqual(await run("git push origin feature"), []);
  assert.deepEqual(
    await run("git push", reader({ currentBranch: "feature" })),
    [],
  );
  assert.deepEqual(await run("git push origin feature:main-docs"), []);
});

test("pushes to dev ask only for versioned projects", async () => {
  assert.deepEqual(await run("git push origin dev"), []);
  assert.deepEqual(await run("git push origin dev", reader(), "no"), []);
  assert.deepEqual(await run("git push origin dev", reader(), "yes"), [
    PUSH("dev"),
  ]);
});

test("chained commands are all inspected", async () => {
  assert.deepEqual(await run("git add . && git push origin main"), [
    PUSH("main"),
  ]);
});

test("a reader that returns null or throws never produces push reasons", async () => {
  assert.deepEqual(await run("git push"), []);
  const throwing = {
    defaultBranch: async () => {
      throw new Error("x");
    },
    currentBranch: () => {
      throw new Error("x");
    },
  };
  assert.deepEqual(await run("git push", throwing), []);
  assert.deepEqual(await run("git init", throwing), [INIT]);
});

test("non-git commands yield nothing", async () => {
  assert.deepEqual(await run("npm test"), []);
  assert.deepEqual(await run("echo git push origin main"), []);
});
