import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { evaluate } from "../../core/evaluate.mjs";

async function withProject(files, adrPackages, fn) {
  const dir = await mkdtemp(path.join(tmpdir(), "ss-eval-"));
  try {
    if (adrPackages.length > 0) {
      await mkdir(path.join(dir, "docs", "adr"), { recursive: true });
      await writeFile(
        path.join(dir, "docs", "adr", "0001-x.md"),
        `---\nstatus: accepted\ndate: 2026-01-01\npackages: [${adrPackages.join(", ")}]\n---\n# x\n`,
      );
    }
    for (const [name, text] of Object.entries(files)) {
      await writeFile(path.join(dir, name), text);
    }
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const shell = (command) => ({ kind: "shell", command });
const edit = (filePath, oldString, newString) => ({
  kind: "edit",
  filePath,
  oldString,
  newString,
  replaceAll: false,
});
const TAIL = "Run the decision gate first, or approve to proceed anyway.";

test("shell install covered by accepted ADR passes", async () => {
  await withProject({}, ["left-pad"], async (dir) => {
    assert.deepEqual(await evaluate(shell("npm install left-pad"), dir), {
      decision: "pass",
    });
  });
});

test("shell install with one uncovered package asks and names only it", async () => {
  await withProject({}, ["left-pad"], async (dir) => {
    const r = await evaluate(shell("npm install left-pad zod"), dir);
    assert.equal(r.decision, "ask");
    assert.equal(
      r.reason,
      `New dependency not covered by an accepted ADR: zod. ${TAIL}`,
    );
  });
});

test("cargo install uncovered tool asks with the tool sentence", async () => {
  await withProject({}, [], async (dir) => {
    const r = await evaluate(shell("cargo install ripgrep"), dir);
    assert.equal(r.decision, "ask");
    assert.equal(
      r.reason,
      `New tool install not covered by an accepted ADR: ripgrep. ${TAIL}`,
    );
  });
});

test("non-install shell command passes", async () => {
  await withProject({}, [], async (dir) => {
    assert.deepEqual(await evaluate(shell("ls -la"), dir), {
      decision: "pass",
    });
  });
});

test("null call passes", async () => {
  assert.deepEqual(await evaluate(null, "."), { decision: "pass" });
});

test("write of new package.json with uncovered deps asks", async () => {
  await withProject({}, [], async (dir) => {
    const r = await evaluate(
      {
        kind: "write",
        filePath: "package.json",
        content: JSON.stringify({ dependencies: { b: "1", a: "1" } }),
      },
      dir,
    );
    assert.equal(r.decision, "ask");
    assert.equal(
      r.reason,
      `New dependency not covered by an accepted ADR: a, b. ${TAIL}`,
    );
  });
});

test("edit adding a covered devDependency passes", async () => {
  const before = JSON.stringify({ devDependencies: { x: "1" } }, null, 2);
  await withProject({ "package.json": before }, ["vitest"], async (dir) => {
    const r = await evaluate(
      edit(
        path.join(dir, "package.json"),
        '"x": "1"',
        '"x": "1", "vitest": "^2"',
      ),
      dir,
    );
    assert.deepEqual(r, { decision: "pass" });
  });
});

const csproj = (fw, refs) =>
  `<Project Sdk="Microsoft.NET.Sdk">\n<PropertyGroup><TargetFramework>${fw}</TargetFramework></PropertyGroup>\n<ItemGroup>\n${refs.map((n) => `<PackageReference Include="${n}" Version="1" />`).join("\n")}\n</ItemGroup>\n</Project>`;

test("edit adding a PackageReference to Api.csproj asks; TargetFramework-only passes", async () => {
  await withProject(
    { "Api.csproj": csproj("net8.0", ["A"]) },
    [],
    async (dir) => {
      const add = await evaluate(
        edit(
          "Api.csproj",
          '<PackageReference Include="A" Version="1" />',
          '<PackageReference Include="A" Version="1" />\n<PackageReference Include="B" Version="1" />',
        ),
        dir,
      );
      assert.equal(add.decision, "ask");
      assert.match(add.reason, /accepted ADR: B\./);
      const fw = await evaluate(edit("Api.csproj", "net8.0", "net9.0"), dir);
      assert.deepEqual(fw, { decision: "pass" });
    },
  );
});

test("NuGet approval is case-insensitive", async () => {
  await withProject({}, ["serilog"], async (dir) => {
    const r = await evaluate(shell("dotnet add package Serilog"), dir);
    assert.deepEqual(r, { decision: "pass" });
  });
});

test("Python approval is PEP 503-normalised", async () => {
  await withProject({}, ["Flask_Login"], async (dir) => {
    assert.deepEqual(await evaluate(shell("pip install flask-login"), dir), {
      decision: "pass",
    });
    const r = await evaluate(
      {
        kind: "write",
        filePath: "pyproject.toml",
        content: '[project]\nname = "x"\ndependencies = ["flask-login>=1"]\n',
      },
      dir,
    );
    assert.deepEqual(r, { decision: "pass" });
  });
});

test("edit to Package.swift asks with the unparsed-manifest reason", async () => {
  await withProject({ "Package.swift": "// x\n" }, [], async (dir) => {
    const r = await evaluate(edit("Package.swift", "// x", "// y"), dir);
    assert.deepEqual(r, {
      decision: "ask",
      reason:
        "Edit to Package.swift may change dependencies (this manifest type is not parsed). Confirm it matches an accepted ADR.",
    });
  });
});

test("patch adding a [dependencies] line to Cargo.toml asks; patch to README passes", async () => {
  const cargo = '[package]\nname = "x"\n\n[dependencies]\nserde = "1"\n';
  await withProject({ "Cargo.toml": cargo }, ["serde"], async (dir) => {
    const patchText = `*** Begin Patch
*** Update File: Cargo.toml
@@
 [dependencies]
 serde = "1"
+rand = "0.8"
*** End Patch`;
    const r = await evaluate({ kind: "patch", patchText }, dir);
    assert.equal(r.decision, "ask");
    assert.equal(
      r.reason,
      `New dependency not covered by an accepted ADR: rand. ${TAIL}`,
    );
    const readme = await evaluate(
      {
        kind: "patch",
        patchText:
          "*** Begin Patch\n*** Update File: README.md\n@@\n-a\n+b\n*** End Patch",
      },
      dir,
    );
    assert.deepEqual(readme, { decision: "pass" });
  });
});

test("patch Add File, unapplicable Update and unparsed manifest", async () => {
  await withProject({ "Cargo.toml": "[dependencies]\n" }, [], async (dir) => {
    const add = await evaluate(
      {
        kind: "patch",
        patchText:
          '*** Begin Patch\n*** Add File: sub/package.json\n+{"dependencies":{"q":"1"}}\n*** End Patch',
      },
      dir,
    );
    assert.equal(add.decision, "ask");
    assert.match(add.reason, /accepted ADR: q\./);
    const bad = await evaluate(
      {
        kind: "patch",
        patchText:
          "*** Begin Patch\n*** Update File: Cargo.toml\n@@\n-nope\n+x\n*** End Patch",
      },
      dir,
    );
    assert.deepEqual(bad, {
      decision: "ask",
      reason:
        "Patch modifies Cargo.toml; confirm any dependency change matches an accepted ADR.",
    });
    const swift = await evaluate(
      {
        kind: "patch",
        patchText:
          "*** Begin Patch\n*** Update File: Package.swift\n@@\n-a\n+b\n*** End Patch",
      },
      dir,
    );
    assert.match(swift.reason, /^Edit to Package\.swift may change/);
  });
});

test("external specs are reported", async () => {
  await withProject({}, [], async (dir) => {
    const r = await evaluate(shell("npm install github:user/repo"), dir);
    assert.equal(r.decision, "ask");
    assert.match(r.reason, /^New dependency from a non-registry source: /);
    assert.ok(r.reason.includes(TAIL));
  });
});

test("edit with target not found asks with guard error", async () => {
  await withProject({ "package.json": "{}" }, [], async (dir) => {
    const r = await evaluate(edit("package.json", "zzz", "y"), dir);
    assert.deepEqual(r, {
      decision: "ask",
      reason: "senior-standards guard error: edit target not found",
    });
  });
});

test('invalid package.json after edit asks with "could not parse package.json"', async () => {
  await withProject({ "package.json": "{}" }, [], async (dir) => {
    const r = await evaluate(edit("package.json", "{}", "{"), dir);
    assert.equal(r.decision, "ask");
    assert.match(r.reason, /could not parse package\.json/);
  });
});

test("ADR problems are appended to an ask reason", async () => {
  await withProject({}, [], async (dir) => {
    await mkdir(path.join(dir, "docs", "adr"), { recursive: true });
    await writeFile(path.join(dir, "docs", "adr", "bad.md"), "no frontmatter");
    const r = await evaluate(shell("npm install zod"), dir);
    assert.equal(r.decision, "ask");
    assert.ok(r.reason.endsWith(" ADR issues: bad.md: no frontmatter."));
  });
});

test("patch moving a file onto package.json is evaluated as a write to it", async () => {
  await withProject({ "notes.txt": "{}\n" }, [], async (dir) => {
    const r = await evaluate(
      {
        kind: "patch",
        patchText:
          '*** Begin Patch\n*** Update File: notes.txt\n*** Move to: package.json\n@@\n-{}\n+{"dependencies":{"evil":"1"}}\n*** End Patch',
      },
      dir,
    );
    assert.equal(r.decision, "ask");
    assert.match(r.reason, /accepted ADR: evil\./);
  });
});

test("patch moving onto an unparsed manifest asks; between plain files passes", async () => {
  await withProject({ "a.txt": "x\n" }, [], async (dir) => {
    const swift = await evaluate(
      {
        kind: "patch",
        patchText:
          "*** Begin Patch\n*** Update File: a.txt\n*** Move to: Package.swift\n@@\n-x\n+y\n*** End Patch",
      },
      dir,
    );
    assert.match(swift.reason, /^Edit to Package\.swift may change/);
    const plain = await evaluate(
      {
        kind: "patch",
        patchText:
          "*** Begin Patch\n*** Update File: a.txt\n*** Move to: b.txt\n@@\n-x\n+y\n*** End Patch",
      },
      dir,
    );
    assert.deepEqual(plain, { decision: "pass" });
    const bad = await evaluate(
      {
        kind: "patch",
        patchText:
          "*** Begin Patch\n*** Update File: a.txt\n*** Move to: Cargo.toml\n@@\n-nope\n+y\n*** End Patch",
      },
      dir,
    );
    assert.match(bad.reason, /^Patch modifies Cargo\.toml;/);
  });
});

test("patch hunk with @@ text lands under that header", async () => {
  const cargo =
    '[features]\na = []\n\n[dependencies]\nserde = "1"\n\n[profile.release]\nlto = true\n';
  await withProject({ "Cargo.toml": cargo }, ["serde"], async (dir) => {
    const r = await evaluate(
      {
        kind: "patch",
        patchText:
          '*** Begin Patch\n*** Update File: Cargo.toml\n@@ [dependencies]\n \n+rand = "0.8"\n*** End Patch',
      },
      dir,
    );
    assert.equal(r.decision, "ask");
    assert.match(r.reason, /accepted ADR: rand\./);
  });
});

test("ambiguous hunk without @@ text is unapplicable", async () => {
  await withProject({ "Cargo.toml": "a\n\nb\n\nc\n" }, [], async (dir) => {
    const r = await evaluate(
      {
        kind: "patch",
        patchText:
          "*** Begin Patch\n*** Update File: Cargo.toml\n@@\n \n+x\n*** End Patch",
      },
      dir,
    );
    assert.equal(
      r.reason,
      "Patch modifies Cargo.toml; confirm any dependency change matches an accepted ADR.",
    );
  });
});

test("ADR issues are appended to a guard-error ask", async () => {
  await withProject({ "package.json": "{}" }, [], async (dir) => {
    await mkdir(path.join(dir, "docs", "adr"), { recursive: true });
    await writeFile(path.join(dir, "docs", "adr", "bad.md"), "no frontmatter");
    const r = await evaluate(edit("package.json", "zzz", "y"), dir);
    assert.equal(
      r.reason,
      "senior-standards guard error: edit target not found ADR issues: bad.md: no frontmatter.",
    );
  });
});

const crlf = (value) =>
  `${JSON.stringify(value, null, 2).replaceAll("\n", "\r\n")}\r\n`;

test("edit of a CRLF package.json with LF strings reports the added dependency", async () => {
  const before = crlf({ dependencies: { a: "1" } });
  await withProject({ "package.json": before }, [], async (dir) => {
    const r = await evaluate(
      edit(
        path.join(dir, "package.json"),
        '"a": "1"\n  }',
        '"a": "1",\n    "zod": "^3"\n  }',
      ),
      dir,
    );
    assert.equal(r.decision, "ask");
    assert.equal(
      r.reason,
      `New dependency not covered by an accepted ADR: zod. ${TAIL}`,
    );
  });
});

test("covered edit of a CRLF package.json with LF strings passes", async () => {
  const before = crlf({ dependencies: { a: "1" } });
  await withProject({ "package.json": before }, ["zod"], async (dir) => {
    const r = await evaluate(
      edit(
        path.join(dir, "package.json"),
        '"a": "1"\n  }',
        '"a": "1",\n    "zod": "^3"\n  }',
      ),
      dir,
    );
    assert.deepEqual(r, { decision: "pass" });
  });
});

test("Cargo approval treats - and _ as the same crate name", async () => {
  await withProject({}, ["serde_json"], async (dir) => {
    assert.deepEqual(await evaluate(shell("cargo add serde-json"), dir), {
      decision: "pass",
    });
    const r = await evaluate(
      {
        kind: "write",
        filePath: "Cargo.toml",
        content: '[package]\nname = "x"\n\n[dependencies]\nserde-json = "1"\n',
      },
      dir,
    );
    assert.deepEqual(r, { decision: "pass" });
  });
  await withProject({}, ["cargo-deny"], async (dir) => {
    assert.deepEqual(await evaluate(shell("cargo install cargo_deny"), dir), {
      decision: "pass",
    });
    assert.equal(
      (await evaluate(shell("npm i cargo_deny"), dir)).decision,
      "ask",
    );
  });
});

const ATTRIBUTION_TAIL =
  "The user prefers no AI attribution; remove it, or approve to proceed anyway.";
const attributionReason = (matches) =>
  `Commit or PR text contains AI attribution (${matches}). ${ATTRIBUTION_TAIL}`;

test("git commit with a Co-Authored-By: Claude trailer asks", async () => {
  await withProject({}, [], async (dir) => {
    const r = await evaluate(
      shell(
        'git commit -m "feat: x" -m "Co-Authored-By: Claude <noreply@anthropic.com>"',
      ),
      dir,
    );
    assert.equal(r.decision, "ask");
    assert.equal(
      r.reason,
      attributionReason("Co-Authored-By: Claude <noreply@anthropic.com>"),
    );
    assert.deepEqual(r.items, ["ai-attribution"]);
  });
});

test("heredoc commit with a Claude Code footer asks", async () => {
  await withProject({}, [], async (dir) => {
    const command =
      "git commit -m \"$(cat <<'EOF'\nfeat: x\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)\nEOF\n)\"";
    const r = await evaluate(shell(command), dir);
    assert.equal(r.decision, "ask");
    assert.match(r.reason, /^Commit or PR text contains AI attribution \(/);
    assert.match(r.reason, /Generated with \[Claude Code\]/);
  });
});

test("gh pr create with an attribution body asks", async () => {
  await withProject({}, [], async (dir) => {
    const r = await evaluate(
      shell(
        'gh pr create --title t --body "Summary. Generated with Claude Code"',
      ),
      dir,
    );
    assert.equal(r.decision, "ask");
    assert.equal(r.reason, attributionReason("Generated with Claude"));
  });
});

test("gh pr create --body-file with attribution in the file asks", async () => {
  await withProject(
    {
      "body.md":
        "Summary\r\n\r\nCo-Authored-By: Claude <noreply@anthropic.com>\r\n",
    },
    [],
    async (dir) => {
      const r = await evaluate(shell("gh pr create --body-file body.md"), dir);
      assert.equal(r.decision, "ask");
      assert.equal(
        r.reason,
        attributionReason("Co-Authored-By: Claude <noreply@anthropic.com>"),
      );
    },
  );
});

test("an unreadable body file does not ask by itself", async () => {
  await withProject({}, [], async (dir) => {
    assert.deepEqual(
      await evaluate(shell("gh pr create --body-file missing.md"), dir),
      { decision: "pass" },
    );
  });
});

test("bare product mentions and plain commits pass", async () => {
  await withProject({}, [], async (dir) => {
    for (const command of [
      'git commit -m "fix(opencode): adapter"',
      'git commit -m "feat: support Claude Code hooks"',
      'git commit -m "feat: add parser"',
      "git status",
    ]) {
      assert.deepEqual(await evaluate(shell(command), dir), {
        decision: "pass",
      });
    }
  });
});

test("attribution text outside commit and PR commands is not checked", async () => {
  await withProject({}, [], async (dir) => {
    assert.deepEqual(
      await evaluate(shell('echo "Generated with Claude Code"'), dir),
      { decision: "pass" },
    );
  });
});

test("matches are joined with a semicolon", async () => {
  await withProject({}, [], async (dir) => {
    const r = await evaluate(
      shell(
        'git commit -m "x" -m "Co-Authored-By: Claude <noreply@anthropic.com>" -m "Generated with Claude Code"',
      ),
      dir,
    );
    assert.equal(r.decision, "ask");
    assert.match(
      r.reason,
      /\(Co-Authored-By: Claude <noreply@anthropic\.com>; Generated with Claude\)/,
    );
  });
});

test("dependency and attribution in one command give both sentences, dependency first", async () => {
  await withProject({}, [], async (dir) => {
    const r = await evaluate(
      shell(
        'npm install zod && git commit -m "feat: x" -m "Generated with Claude Code"',
      ),
      dir,
    );
    assert.equal(r.decision, "ask");
    assert.equal(
      r.reason,
      `New dependency not covered by an accepted ADR: zod. ${TAIL} ${attributionReason("Generated with Claude")}`,
    );
  });
});

test("heredoc with -F - asks", async () => {
  await withProject({}, [], async (dir) => {
    const r = await evaluate(
      shell(
        "git commit -F - <<'EOF'\nfeat: x\n\nGenerated with Claude Code\nEOF",
      ),
      dir,
    );
    assert.equal(r.decision, "ask");
    assert.match(r.reason, /Generated with Claude/);
  });
});

test("PowerShell here-strings ask, inline or through a variable", async () => {
  await withProject({}, [], async (dir) => {
    for (const command of [
      "git commit -m @'\nfeat: x\n\nGenerated with Claude Code\n'@",
      "$m = @'\nfeat: x\n\nGenerated with Claude Code\n'@; git commit -m $m",
      '$m = @"\nCo-Authored-By: Claude <noreply@anthropic.com>\n"@\ngit commit -m $m',
    ]) {
      assert.equal(
        (await evaluate(shell(command), dir)).decision,
        "ask",
        command,
      );
    }
  });
});

test("--message=, lowercase co-authored-by, gh pr merge and git merge ask", async () => {
  await withProject({}, [], async (dir) => {
    for (const command of [
      'git commit --message="Co-Authored-By: Claude <noreply@anthropic.com>"',
      'git commit -m "x" -m "co-authored-by: claude <noreply@anthropic.com>"',
      "gh pr merge 4 --squash --body 'Generated with Claude Code'",
      'git merge feature -m "Generated with Claude Code"',
    ]) {
      assert.equal(
        (await evaluate(shell(command), dir)).decision,
        "ask",
        command,
      );
    }
  });
});

test("attribution text in an unrelated chained command passes", async () => {
  await withProject({}, [], async (dir) => {
    assert.deepEqual(
      await evaluate(shell("git tag -l && echo 'Generated with Claude'"), dir),
      { decision: "pass" },
    );
  });
});

test("a human co-author named Claude passes", async () => {
  await withProject({}, [], async (dir) => {
    assert.deepEqual(
      await evaluate(
        shell(
          'git commit -m "x" -m "Co-Authored-By: Claude Dupont <claude.dupont@example.fr>"',
        ),
        dir,
      ),
      { decision: "pass" },
    );
  });
});

test("more than five matches are summarised", async () => {
  await withProject({}, [], async (dir) => {
    const ids = Array.from({ length: 8 }, (_, i) => `claude-opus-${i}`).join(
      " ",
    );
    const r = await evaluate(shell(`git commit -m "${ids}"`), dir);
    assert.match(
      r.reason,
      /\(claude-opus-0; claude-opus-1; claude-opus-2; claude-opus-3; claude-opus-4; and 3 more\)/,
    );
  });
});
