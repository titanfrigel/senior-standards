import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { checkDependencies, runCli } from "../../core/dependency-check.mjs";

const run = promisify(execFile);
const cli = fileURLToPath(
  new URL("../../core/dependency-check.mjs", import.meta.url),
);
const BASE = "base123";

async function withAdr(packages, fn) {
  const dir = await mkdtemp(path.join(tmpdir(), "ss-depcheck-"));
  try {
    if (packages !== null) {
      await mkdir(path.join(dir, "docs", "adr"), { recursive: true });
      await writeFile(
        path.join(dir, "docs", "adr", "0001-x.md"),
        `---\nstatus: accepted\ndate: 2026-01-01\npackages: [${packages.join(", ")}]\n---\n# x\n`,
      );
    }
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Fake git: `changes` is the name-status list, `base`/`head` map path to text. */
function fakeGit({ changes, base = {}, head = {} }) {
  return {
    changedFiles: async () => changes,
    show: async (rev, filePath) => {
      const tree = rev === "HEAD" ? head : base;
      return tree[filePath] ?? null;
    },
  };
}

const pkg = (deps) => JSON.stringify({ name: "app", dependencies: deps });

function check(dir, git) {
  return checkDependencies({ projectDir: dir, base: BASE, git });
}

function capture() {
  const out = [];
  const err = [];
  return {
    io: { out: (s) => out.push(s), err: (s) => err.push(s) },
    stdout: () => out.join(""),
    stderr: () => err.join(""),
  };
}

async function cliRun(dir, git) {
  const io = capture();
  const code = await runCli(["--base", BASE, "--dir", dir], {
    git,
    ...io.io,
  });
  return { code, stdout: io.stdout(), stderr: io.stderr() };
}

test("added name approved by an accepted ADR is covered", async () => {
  await withAdr(["zod"], async (dir) => {
    const git = fakeGit({
      changes: [{ status: "M", path: "package.json" }],
      base: { "package.json": pkg({}) },
      head: { "package.json": pkg({ zod: "^3.0.0" }) },
    });
    const result = await check(dir, git);
    assert.deepEqual(result.uncovered, []);
    assert.deepEqual(result.warnings, []);
  });
});

test("unapproved added name is reported per file", async () => {
  await withAdr(["zod"], async (dir) => {
    const git = fakeGit({
      changes: [{ status: "M", path: "package.json" }],
      base: { "package.json": pkg({}) },
      head: { "package.json": pkg({ zod: "^3.0.0", lodash: "^4.0.0" }) },
    });
    const result = await check(dir, git);
    assert.deepEqual(result.uncovered, [
      { file: "package.json", names: ["lodash"] },
    ]);
  });
});

test("cargo names match across - and _", async () => {
  await withAdr(["serde-json"], async (dir) => {
    const git = fakeGit({
      changes: [{ status: "M", path: "Cargo.toml" }],
      base: { "Cargo.toml": '[package]\nname = "x"\n\n[dependencies]\n' },
      head: {
        "Cargo.toml":
          '[package]\nname = "x"\n\n[dependencies]\nserde_json = "1"\n',
      },
    });
    assert.deepEqual((await check(dir, git)).uncovered, []);
  });
});

test("version bump, removal and lockfile-only changes pass", async () => {
  await withAdr(null, async (dir) => {
    const bump = fakeGit({
      changes: [{ status: "M", path: "package.json" }],
      base: { "package.json": pkg({ zod: "^3.0.0" }) },
      head: { "package.json": pkg({ zod: "^3.1.0" }) },
    });
    assert.deepEqual((await check(dir, bump)).uncovered, []);
    const removal = fakeGit({
      changes: [{ status: "M", path: "package.json" }],
      base: { "package.json": pkg({ zod: "^3.0.0", lodash: "^4.0.0" }) },
      head: { "package.json": pkg({ zod: "^3.0.0" }) },
    });
    assert.deepEqual((await check(dir, removal)).uncovered, []);
    const lockfile = fakeGit({
      changes: [{ status: "M", path: "package-lock.json" }],
      base: { "package-lock.json": "{}" },
      head: { "package-lock.json": '{"packages":{"node_modules/x":{}}}' },
    });
    const result = await check(dir, lockfile);
    assert.deepEqual(result.uncovered, []);
    assert.deepEqual(result.warnings, []);
  });
});

test("deleted manifest is ignored", async () => {
  await withAdr(null, async (dir) => {
    const git = fakeGit({
      changes: [{ status: "D", path: "package.json" }],
      base: { "package.json": pkg({ zod: "^3.0.0" }) },
    });
    assert.deepEqual(await check(dir, git), {
      uncovered: [],
      warnings: [],
      problems: [],
    });
  });
});

test("renamed manifest compares against the old path at the base", async () => {
  await withAdr(null, async (dir) => {
    const git = fakeGit({
      changes: [
        { status: "R", path: "app/package.json", oldPath: "web/package.json" },
      ],
      base: { "web/package.json": pkg({ zod: "^3.0.0" }) },
      head: { "app/package.json": pkg({ zod: "^3.0.0", lodash: "^4.0.0" }) },
    });
    assert.deepEqual((await check(dir, git)).uncovered, [
      { file: "app/package.json", names: ["lodash"] },
    ]);
  });
});

test("added manifest counts every name as new", async () => {
  await withAdr(null, async (dir) => {
    const git = fakeGit({
      changes: [{ status: "A", path: "tools/package.json" }],
      head: { "tools/package.json": pkg({ b: "1", a: "1" }) },
    });
    assert.deepEqual((await check(dir, git)).uncovered, [
      { file: "tools/package.json", names: ["a", "b"] },
    ]);
  });
});

test("BOM and CRLF in manifests are tolerated", async () => {
  await withAdr(null, async (dir) => {
    const git = fakeGit({
      changes: [{ status: "M", path: "package.json" }],
      base: { "package.json": `﻿${pkg({})}\r\n` },
      head: {
        "package.json": `﻿{\r\n  "dependencies": { "lodash": "^4.0.0" }\r\n}\r\n`,
      },
    });
    assert.deepEqual((await check(dir, git)).uncovered, [
      { file: "package.json", names: ["lodash"] },
    ]);
  });
});

test("non-registry source is uncovered unless its source is approved", async () => {
  const git = () =>
    fakeGit({
      changes: [{ status: "M", path: "package.json" }],
      base: { "package.json": pkg({}) },
      head: { "package.json": pkg({ mylib: "github:acme/mylib" }) },
    });
  await withAdr(null, async (dir) => {
    assert.deepEqual((await check(dir, git())).uncovered, [
      {
        file: "package.json",
        names: [],
        external: ["mylib (github:acme/mylib)"],
      },
    ]);
    const { code, stdout } = await cliRun(dir, git());
    assert.equal(code, 1);
    assert.match(stdout, /^ {2}package\.json$/m);
    assert.match(
      stdout,
      /^ {4}mylib comes from a non-registry source: github:acme\/mylib; list the source `github:acme\/mylib` in an accepted ADR's packages to approve it$/m,
    );
    assert.doesNotMatch(stdout, /these names in packages/);
  });
  await withAdr(["mylib"], async (dir) => {
    assert.equal((await cliRun(dir, git())).code, 1);
  });
  await withAdr(["github:acme/mylib"], async (dir) => {
    assert.deepEqual((await check(dir, git())).uncovered, []);
  });
});

test("ADR source entries are trimmed and unquoted but otherwise exact", async () => {
  const git = fakeGit({
    changes: [{ status: "M", path: "package.json" }],
    base: { "package.json": pkg({}) },
    head: { "package.json": pkg({ mylib: "github:acme/mylib" }) },
  });
  const withAdrText = async (frontmatterPackages, expectedCode) => {
    const dir = await mkdtemp(path.join(tmpdir(), "ss-depcheck-src-"));
    try {
      await mkdir(path.join(dir, "docs", "adr"), { recursive: true });
      await writeFile(
        path.join(dir, "docs", "adr", "0001-x.md"),
        `---\r\nstatus: accepted\r\ndate: 2026-01-01\r\n${frontmatterPackages}---\r\n# x\r\n`,
      );
      assert.equal((await cliRun(dir, git)).code, expectedCode);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  };
  await withAdrText('packages: [ "github:acme/mylib" ]\r\n', 0);
  await withAdrText("packages:\r\n  -  'github:acme/mylib'  \r\n", 0);
  await withAdrText("packages: [GitHub:Acme/MyLib]\r\n", 1);
  await withAdrText("packages: [github:acme/mylib#v2]\r\n", 1);
});

test("switching an approved name to a non-registry source needs the source approved", async () => {
  const git = () =>
    fakeGit({
      changes: [{ status: "M", path: "package.json" }],
      base: { "package.json": pkg({ zod: "^3" }) },
      head: { "package.json": pkg({ zod: "github:someone/zod" }) },
    });
  await withAdr(["zod"], async (dir) => {
    const { code, stdout } = await cliRun(dir, git());
    assert.equal(code, 1);
    assert.match(
      stdout,
      /^ {4}zod comes from a non-registry source: github:someone\/zod; list the source `github:someone\/zod` in an accepted ADR's packages to approve it$/m,
    );
  });
  await withAdr(["zod", "github:someone/zod"], async (dir) => {
    const { code, stdout } = await cliRun(dir, git());
    assert.equal(code, 0);
    assert.match(stdout, /No new dependencies outside accepted ADRs/);
  });
});

test("unparsed manifest changes are warnings and exit 0", async () => {
  await withAdr(null, async (dir) => {
    const git = fakeGit({
      changes: [{ status: "M", path: "ios/Package.swift" }],
      base: { "ios/Package.swift": "// a" },
      head: { "ios/Package.swift": "// b" },
    });
    const result = await check(dir, git);
    assert.deepEqual(result.uncovered, []);
    assert.equal(result.warnings.length, 1);
    assert.match(result.warnings[0], /Package\.swift/);
    const { code, stdout } = await cliRun(dir, git);
    assert.equal(code, 0);
    assert.match(stdout, /Package\.swift/);
  });
});

test("manifest that cannot be parsed at the head fails closed", async () => {
  await withAdr(null, async (dir) => {
    const git = fakeGit({
      changes: [{ status: "M", path: "package.json" }],
      base: { "package.json": pkg({}) },
      head: { "package.json": "{ not json" },
    });
    const result = await check(dir, git);
    assert.deepEqual(result.warnings, []);
    assert.equal(result.uncovered.length, 1);
    assert.equal(result.uncovered[0].file, "package.json");
    assert.deepEqual(result.uncovered[0].names, []);
    assert.match(result.uncovered[0].note, /could not be parsed/);
    const { code, stdout } = await cliRun(dir, git);
    assert.equal(code, 1);
    assert.match(
      stdout,
      /^ {4}could not be parsed .*; confirm its dependencies with an accepted ADR$/m,
    );
  });
});

test("manifest that cannot be parsed at the base counts every name as new", async () => {
  await withAdr(["zod"], async (dir) => {
    const git = fakeGit({
      changes: [{ status: "M", path: "package.json" }],
      base: { "package.json": "{ not json" },
      head: { "package.json": pkg({ zod: "1", lodash: "1" }) },
    });
    assert.deepEqual(await check(dir, git), {
      uncovered: [{ file: "package.json", names: ["lodash"] }],
      warnings: [],
      problems: [],
    });
  });
});

test("CLI prints files, names and the ADR instruction on exit 1", async () => {
  await withAdr(["zod"], async (dir) => {
    const git = fakeGit({
      changes: [
        { status: "M", path: "package.json" },
        { status: "A", path: "api/package.json" },
      ],
      base: { "package.json": pkg({}) },
      head: {
        "package.json": pkg({ zod: "1", lodash: "1" }),
        "api/package.json": pkg({ lodash: "1", express: "1" }),
      },
    });
    const { code, stdout } = await cliRun(dir, git);
    assert.equal(code, 1);
    assert.match(stdout, /^ {2}package\.json: lodash$/m);
    assert.match(stdout, /^ {2}api\/package\.json: express, lodash$/m);
    assert.match(
      stdout,
      /Write an ADR in docs\/adr with status: accepted and these names in packages: express, lodash$/m,
    );
  });
});

test("CLI exits 0 when nothing is uncovered", async () => {
  await withAdr(null, async (dir) => {
    const { code } = await cliRun(dir, fakeGit({ changes: [] }));
    assert.equal(code, 0);
  });
});

test("CLI exits 2 without --base", async () => {
  const io = capture();
  const code = await runCli([], { git: fakeGit({ changes: [] }), ...io.io });
  assert.equal(code, 2);
  assert.match(io.stderr(), /--base/);
});

test("CLI exits 2 with a fetch-depth hint when the base is unreadable", async () => {
  await withAdr(null, async (dir) => {
    const git = {
      changedFiles: async () => [{ status: "M", path: "package.json" }],
      show: async (rev) => {
        if (rev === BASE) throw new Error(`bad revision '${BASE}'`);
        return pkg({ zod: "1" });
      },
    };
    const { code, stderr } = await cliRun(dir, git);
    assert.equal(code, 2);
    assert.match(stderr, /fetch-depth: 0/);
  });
});

function gitIn(dir, ...args) {
  return run(
    "git",
    ["-c", "user.name=Test", "-c", "user.email=test@example.com", ...args],
    { cwd: dir },
  );
}

test("CLI against a real Git repository names the new package", async () => {
  await withAdr(["zod"], async (dir) => {
    await gitIn(dir, "init", "-q", "-b", "main");
    await gitIn(dir, "config", "commit.gpgsign", "false");
    await writeFile(path.join(dir, "package.json"), pkg({ zod: "1" }));
    await gitIn(dir, "add", "-A");
    await gitIn(dir, "commit", "-q", "-m", "chore: base");
    const { stdout: base } = await gitIn(dir, "rev-parse", "HEAD");
    await writeFile(
      path.join(dir, "package.json"),
      pkg({ zod: "1", "left-pad": "1" }),
    );
    await gitIn(dir, "commit", "-q", "-am", "feat: add left-pad");
    const result = await run(
      process.execPath,
      [cli, "--base", base.trim(), "--dir", dir],
      { cwd: dir },
    ).then(
      () => ({ code: 0, stdout: "" }),
      (error) => ({ code: error.code, stdout: error.stdout }),
    );
    assert.equal(result.code, 1);
    assert.match(result.stdout, /package\.json: left-pad/);
  });
});
