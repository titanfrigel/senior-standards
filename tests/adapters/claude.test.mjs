import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const script = (name) => path.join(root, "adapters", "claude", name);

function run(name, input, env = {}) {
  const result = spawnSync("node", [script(name)], {
    input,
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  assert.equal(result.status, 0, `exit code: ${result.stderr}`);
  return result.stdout;
}

async function withProject(adrPackages, fn) {
  const dir = await mkdtemp(path.join(tmpdir(), "ss-claude-"));
  try {
    await mkdir(path.join(dir, "docs", "adr"), { recursive: true });
    await writeFile(
      path.join(dir, "docs", "adr", "0001-x.md"),
      `---\nstatus: accepted\ndate: 2026-01-01\npackages: [${adrPackages.join(", ")}]\n---\n# x\n`,
    );
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const bash = (command, cwd) =>
  JSON.stringify({
    hook_event_name: "PreToolUse",
    tool_name: "Bash",
    tool_input: { command },
    cwd,
  });

const powershell = (command, cwd) =>
  JSON.stringify({
    hook_event_name: "PreToolUse",
    tool_name: "PowerShell",
    tool_input: { command },
    cwd,
  });

test("session-start emits additionalContext containing decision-gate", () => {
  const out = JSON.parse(run("session-start.mjs", "{}"));
  assert.equal(out.hookSpecificOutput.hookEventName, "SessionStart");
  assert.match(out.hookSpecificOutput.additionalContext, /decision-gate/);
});

test("pre-tool-use: uncovered pnpm add asks and names the package", async () => {
  await withProject([], async (dir) => {
    const out = JSON.parse(
      run("pre-tool-use.mjs", bash("pnpm add left-pad", dir), {
        CLAUDE_PROJECT_DIR: "",
      }),
    );
    assert.equal(out.hookSpecificOutput.hookEventName, "PreToolUse");
    assert.equal(out.hookSpecificOutput.permissionDecision, "ask");
    assert.match(out.hookSpecificOutput.permissionDecisionReason, /left-pad/);
  });
});

test("pre-tool-use: CLAUDE_PROJECT_DIR takes precedence over cwd", async () => {
  await withProject(["left-pad"], async (dir) => {
    const out = run("pre-tool-use.mjs", bash("pnpm add left-pad", root), {
      CLAUDE_PROJECT_DIR: dir,
    });
    assert.equal(out, "");
  });
});

test("pre-tool-use: covered install prints nothing", async () => {
  await withProject(["left-pad"], async (dir) => {
    assert.equal(
      run("pre-tool-use.mjs", bash("pnpm add left-pad", dir), {
        CLAUDE_PROJECT_DIR: "",
      }),
      "",
    );
  });
});

test("pre-tool-use: Read tool prints nothing", () => {
  const input = JSON.stringify({
    tool_name: "Read",
    tool_input: { file_path: "package.json" },
    cwd: root,
  });
  assert.equal(run("pre-tool-use.mjs", input), "");
});

test("pre-tool-use: invalid JSON stdin asks with guard error", () => {
  const out = JSON.parse(run("pre-tool-use.mjs", "not json"));
  assert.equal(out.hookSpecificOutput.permissionDecision, "ask");
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /guard error/);
});

test("pre-tool-use: stdin with BOM parses", async () => {
  await withProject([], async (dir) => {
    const out = JSON.parse(
      run("pre-tool-use.mjs", `﻿${bash("pnpm add left-pad", dir)}`, {
        CLAUDE_PROJECT_DIR: "",
      }),
    );
    assert.match(out.hookSpecificOutput.permissionDecisionReason, /left-pad/);
  });
});

test("session-start: loader failure still emits valid JSON and exits 0", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "ss-claude-fail-"));
  try {
    await mkdir(path.join(dir, "adapters", "claude"), { recursive: true });
    await mkdir(path.join(dir, "core"), { recursive: true });
    await copyFile(
      script("session-start.mjs"),
      path.join(dir, "adapters", "claude", "session-start.mjs"),
    );
    await writeFile(
      path.join(dir, "core", "load-standards.mjs"),
      'export const FALLBACK = "fallback-text";\nexport function loadStandards() { throw new Error("boom"); }\n',
    );
    const result = spawnSync(
      "node",
      [path.join(dir, "adapters", "claude", "session-start.mjs")],
      { input: "{}", encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
    const out = JSON.parse(result.stdout);
    assert.equal(out.hookSpecificOutput.hookEventName, "SessionStart");
    assert.equal(out.hookSpecificOutput.additionalContext, "fallback-text");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("pre-tool-use: uncovered install through PowerShell asks", async () => {
  await withProject([], async (dir) => {
    for (const command of ["npm i zod", "& npm install zod; Write-Host done"]) {
      const out = JSON.parse(
        run("pre-tool-use.mjs", powershell(command, dir), {
          CLAUDE_PROJECT_DIR: "",
        }),
      );
      assert.equal(out.hookSpecificOutput.permissionDecision, "ask", command);
      assert.match(out.hookSpecificOutput.permissionDecisionReason, /zod/);
    }
  });
});

test("pre-tool-use: Write to a Windows package.json path is evaluated", async () => {
  await withProject([], async (dir) => {
    const input = JSON.stringify({
      tool_name: "Write",
      tool_input: {
        file_path: path.win32.join("C:\\", "work", "app", "package.json"),
        content: '{ "dependencies": { "zod": "^3.0.0" } }',
      },
      cwd: dir,
    });
    const out = JSON.parse(
      run("pre-tool-use.mjs", input, { CLAUDE_PROJECT_DIR: "" }),
    );
    assert.equal(out.hookSpecificOutput.permissionDecision, "ask");
    assert.match(out.hookSpecificOutput.permissionDecisionReason, /zod/);
  });
});

test("pre-tool-use: a core module that fails to load still asks and exits 0", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "ss-claude-broken-"));
  try {
    await mkdir(path.join(dir, "adapters", "claude"), { recursive: true });
    await mkdir(path.join(dir, "core"), { recursive: true });
    for (const name of ["pre-tool-use.mjs", "io.mjs"]) {
      await copyFile(script(name), path.join(dir, "adapters", "claude", name));
    }
    await writeFile(
      path.join(dir, "core", "evaluate.mjs"),
      'throw new Error("broken core");\n',
    );
    await writeFile(
      path.join(dir, "core", "normalize.mjs"),
      "export function normalize() { return null; }\n",
    );
    const result = spawnSync(
      "node",
      [path.join(dir, "adapters", "claude", "pre-tool-use.mjs")],
      { input: bash("pnpm add left-pad", dir), encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
    const out = JSON.parse(result.stdout);
    assert.equal(out.hookSpecificOutput.permissionDecision, "ask");
    assert.match(
      out.hookSpecificOutput.permissionDecisionReason,
      /guard error: broken core/,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("pre-tool-use: a commit with AI attribution asks", async () => {
  await withProject([], async (dir) => {
    const out = JSON.parse(
      run(
        "pre-tool-use.mjs",
        bash(
          'git commit -m "feat: x" -m "Co-Authored-By: Claude <noreply@anthropic.com>"',
          dir,
        ),
        { CLAUDE_PROJECT_DIR: "" },
      ),
    );
    assert.equal(out.hookSpecificOutput.permissionDecision, "ask");
    assert.match(
      out.hookSpecificOutput.permissionDecisionReason,
      /contains AI attribution/,
    );
  });
});

test("pre-tool-use: a plain commit prints nothing", async () => {
  await withProject([], async (dir) => {
    const out = run(
      "pre-tool-use.mjs",
      bash('git commit -m "fix(claude): x"', dir),
      {
        CLAUDE_PROJECT_DIR: "",
      },
    );
    assert.equal(out, "");
  });
});
