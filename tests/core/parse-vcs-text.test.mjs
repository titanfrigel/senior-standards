import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { vcsTextOf } from "../../core/parse-vcs-text.mjs";

async function withDir(files, fn) {
  const dir = await mkdtemp(path.join(tmpdir(), "ss-vcs-"));
  try {
    for (const [name, text] of Object.entries(files)) {
      await writeFile(path.join(dir, name), text);
    }
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("commands that carry no commit or PR text yield nothing", async () => {
  await withDir({}, async (dir) => {
    for (const command of [
      "git status",
      "git log -n 3",
      "gh pr view 12",
      "gh pr list",
      "npm test",
      "echo git commit",
    ]) {
      assert.deepEqual(await vcsTextOf(command, dir), [], command);
    }
  });
});

test("recognised commands return their own segment text", async () => {
  await withDir({}, async (dir) => {
    for (const command of [
      'git commit -m "x"',
      'git commit -am "x"',
      "git commit --amend --no-edit",
      "git -C web commit -m x",
      'git tag -a v1 -m "x"',
      'git notes add -m "x"',
      "git merge feature -m x",
      'gh pr create --title t --body "x"',
      "gh pr edit 3 --body x",
      "gh pr comment 3 -b x",
      "gh pr review 3 --approve -b x",
      "gh pr merge 3 --squash --subject s --body x",
      "gh issue create -t t -b x",
      "gh issue edit 3 -b x",
      "gh issue comment 3 -b x",
      "env GIT_X=1 git commit -m x",
    ]) {
      assert.deepEqual(await vcsTextOf(command, dir), [command], command);
    }
    assert.deepEqual(await vcsTextOf('pnpm test && git commit -m "x"', dir), [
      'git commit -m "x"',
    ]);
  });
});

test("unrelated segments are not returned", async () => {
  await withDir({}, async (dir) => {
    assert.deepEqual(
      await vcsTextOf("git tag -l && echo 'Generated with Claude'", dir),
      ["git tag -l"],
    );
  });
});

test("heredoc bodies of a matching segment are returned", async () => {
  await withDir({}, async (dir) => {
    const command =
      "git commit -F - <<'EOF'\nfeat: x\n\nBody line\nEOF\necho after";
    const texts = await vcsTextOf(command, dir);
    assert.equal(texts.length, 1);
    assert.ok(texts[0].includes("Body line"));
    assert.ok(!texts[0].includes("echo after"));
    for (const operator of ["<<EOF", "<<-EOF"]) {
      const body = await vcsTextOf(
        `git commit -F - ${operator}\n\tbody text\n\tEOF`,
        dir,
      );
      assert.ok(body[0].includes("body text"), operator);
    }
  });
});

test("a segment that reads a variable or piped stdin gets the whole command", async () => {
  await withDir({}, async (dir) => {
    const withVariable =
      "$m = @'\nGenerated with Claude Code\n'@; git commit -m $m";
    assert.deepEqual(await vcsTextOf(withVariable, dir), [withVariable]);
    const piped = 'echo "Generated with Claude Code" | git commit -F -';
    assert.deepEqual(await vcsTextOf(piped, dir), [piped]);
  });
});

test("short flags attached or grouped are understood", async () => {
  await withDir({ "msg.txt": "MSG" }, async (dir) => {
    for (const command of [
      "git commit -Fmsg.txt",
      "git commit -aF msg.txt",
      "git commit --amend -F msg.txt",
      "gh pr create -F msg.txt",
      "gh pr merge 3 -F msg.txt",
    ]) {
      assert.deepEqual(
        (await vcsTextOf(command, dir)).slice(1),
        ["MSG"],
        command,
      );
    }
    for (const command of [
      'git commit -am "-F msg.txt"',
      "git commit -m-Fmsg.txt",
      'git commit --message "-F msg.txt"',
    ]) {
      assert.deepEqual((await vcsTextOf(command, dir)).slice(1), [], command);
    }
  });
});

test("devices, pipes and directories are never read", async () => {
  await withDir({}, async (dir) => {
    for (const file of [
      "/dev/stdin",
      "/dev/zero",
      "/dev/null",
      "NUL",
      "nul.txt",
      "CON",
      "\\\\.\\pipe\\x",
      dir,
    ]) {
      assert.deepEqual(
        (await vcsTextOf(`git commit -F "${file}"`, dir)).slice(1),
        [],
        file,
      );
    }
  });
});

test("only the first megabyte of a file is read", async () => {
  await withDir({ "big.txt": "a".repeat(2 * 1024 * 1024) }, async (dir) => {
    const texts = await vcsTextOf("git commit -F big.txt", dir);
    assert.equal(texts[1].length, 1024 * 1024);
  });
});

test("heredoc bodies stay in the scanned text", async () => {
  await withDir({}, async (dir) => {
    const command =
      "git commit -m \"$(cat <<'EOF'\nfeat: x\n\nGenerated with Claude Code\nEOF\n)\"";
    const texts = await vcsTextOf(command, dir);
    assert.ok(texts[0].includes("Generated with Claude Code"));
  });
});

test("-F, --file and --body-file are read relative to the project dir", async () => {
  await withDir({ "msg.txt": "MSG", "body.md": "BODY" }, async (dir) => {
    assert.deepEqual((await vcsTextOf("git commit -F msg.txt", dir)).slice(1), [
      "MSG",
    ]);
    assert.deepEqual(
      (await vcsTextOf("git commit --file=msg.txt", dir)).slice(1),
      ["MSG"],
    );
    assert.deepEqual(
      (await vcsTextOf("gh pr create --body-file body.md", dir)).slice(1),
      ["BODY"],
    );
    assert.deepEqual(
      (await vcsTextOf("gh pr create -F body.md --title t", dir)).slice(1),
      ["BODY"],
    );
    assert.deepEqual(
      (
        await vcsTextOf(`git commit -F "${path.join(dir, "msg.txt")}"`, dir)
      ).slice(1),
      ["MSG"],
    );
  });
});

test("stdin (-), missing and unreadable files are ignored", async () => {
  await withDir({}, async (dir) => {
    for (const command of [
      "git commit -F -",
      "git commit -F nope.txt",
      `git commit -F ${dir}`,
      "gh pr create --body-file -",
    ]) {
      assert.deepEqual((await vcsTextOf(command, dir)).slice(1), [], command);
    }
  });
});
