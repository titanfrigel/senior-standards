import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const repo = fileURLToPath(new URL("../../", import.meta.url));
const script = path.join(repo, "scripts", "vendor-dependency-check.mjs");

async function filesUnder(dir) {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) =>
      path
        .relative(dir, path.join(entry.parentPath, entry.name))
        .split(path.sep)
        .join("/"),
    )
    .sort();
}

test("vendored check is self-contained and runs with node", async () => {
  const project = await mkdtemp(path.join(tmpdir(), "ss-vendor-"));
  // A copy outside the repository proves no import reaches back into it.
  const elsewhere = await mkdtemp(path.join(tmpdir(), "ss-vendor-moved-"));
  try {
    await run(process.execPath, [script, project]);
    const target = path.join(project, ".github", "scripts", "senior-standards");
    const files = await filesUnder(target);
    for (const expected of [
      "core/dependency-check.mjs",
      "core/approval.mjs",
      "core/adr-index.mjs",
      "core/diff-manifest.mjs",
      "core/manifests/index.mjs",
      "README.md",
      "VERSION",
    ]) {
      assert.ok(files.includes(expected), `missing ${expected}`);
    }

    const { version } = JSON.parse(
      await readFile(path.join(repo, "package.json"), "utf8"),
    );
    assert.equal(
      (await readFile(path.join(target, "VERSION"), "utf8")).trim(),
      version,
    );
    const readme = await readFile(path.join(target, "README.md"), "utf8");
    assert.match(readme, /generated/i);
    assert.match(readme, /vendor-dependency-check\.mjs/);

    // Every import in every vendored module resolves inside the folder.
    for (const file of files.filter((f) => f.endsWith(".mjs"))) {
      const text = await readFile(path.join(target, file), "utf8");
      for (const [, spec] of text.matchAll(/from\s+"([^"]+)"/g)) {
        if (spec.startsWith("node:")) continue;
        assert.ok(spec.startsWith("."), `${file} imports ${spec}`);
        const resolved = path.resolve(
          path.dirname(path.join(target, file)),
          spec,
        );
        const rel = path.relative(target, resolved).split(path.sep).join("/");
        assert.ok(files.includes(rel), `${file} imports ${spec} outside`);
      }
    }

    // Move the vendored folder somewhere unrelated and run the CLI there.
    for (const file of files) {
      const dest = path.join(elsewhere, file);
      await mkdir(path.dirname(dest), { recursive: true });
      await writeFile(dest, await readFile(path.join(target, file)));
    }
    const moved = path.join(elsewhere, "core", "dependency-check.mjs");
    const usage = await run(process.execPath, [moved], { cwd: elsewhere }).then(
      () => ({ code: 0, stderr: "" }),
      (error) => ({ code: error.code, stderr: error.stderr }),
    );
    assert.doesNotMatch(usage.stderr, /ERR_MODULE_NOT_FOUND/);
    assert.equal(usage.code, 2);
    assert.match(usage.stderr, /--base/);

    // Rerunning refreshes in place with the same file set.
    await run(process.execPath, [script, project]);
    assert.deepEqual(await filesUnder(target), files);
  } finally {
    await rm(project, { recursive: true, force: true });
    await rm(elsewhere, { recursive: true, force: true });
  }
});

test("vendor script exits 2 without a project directory", async () => {
  await assert.rejects(run(process.execPath, [script]), (error) => {
    assert.equal(error.code, 2);
    return true;
  });
});

test("this repository's vendored copy matches core/ and package.json", async () => {
  const vendored = path.join(repo, ".github", "scripts", "senior-standards");
  const refresh = "run `node scripts/vendor-dependency-check.mjs .`";
  for (const file of await filesUnder(path.join(vendored, "core"))) {
    const copy = await readFile(path.join(vendored, "core", file));
    const source = await readFile(path.join(repo, "core", file));
    assert.ok(copy.equals(source), `core/${file} drifted: ${refresh}`);
  }
  const { version } = JSON.parse(
    await readFile(path.join(repo, "package.json"), "utf8"),
  );
  const pinned = await readFile(path.join(vendored, "VERSION"), "utf8");
  assert.equal(pinned.trim(), version, `VERSION is stale: ${refresh}`);
});
