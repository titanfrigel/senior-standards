import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import plugin, {
  createPlugin,
  isChildSession,
  listSkills,
} from "../../adapters/opencode/plugin.mjs";

const quiet = { error() {} };
const missingSkills = path.join(tmpdir(), "ss-oc-no-such-skills-dir");

async function withDir(fn) {
  const dir = await mkdtemp(path.join(tmpdir(), "ss-oc-"));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function addSkill(skillsDir, name, description) {
  await mkdir(path.join(skillsDir, name), { recursive: true });
  await writeFile(
    path.join(skillsDir, name, "SKILL.md"),
    `---\nname: ${name}\ndescription: ${description}\n---\n# ${name}\nbody\n`,
  );
}

/** Fake v2 host context recording every registration. */
function fakeCtx({
  directory = process.cwd(),
  session,
  assert: assertFn,
} = {}) {
  const hooks = {};
  const added = [];
  const calls = { assert: [] };
  const ctx = {
    location: { directory },
    skill: {
      transform: async (fn) => fn({ add: (s) => added.push(s) }),
    },
    session: {
      hook: async (name, fn) => {
        hooks[`session.${name}`] = fn;
      },
      get: async ({ sessionID }) => session ?? { id: sessionID },
    },
    tool: {
      hook: async (name, fn) => {
        hooks[`tool.${name}`] = fn;
      },
    },
    permission: {
      hook: async (name, fn) => {
        hooks[`permission.${name}`] = fn;
      },
      assert:
        assertFn ??
        (async (req) => {
          calls.assert.push(req);
        }),
    },
  };
  return { ctx, hooks, added, calls };
}

const make = (extra = {}) =>
  createPlugin({ skillsDir: missingSkills, logger: quiet, ...extra });

// Every tool call gets its own id by default; the guard shares only
// in-flight decisions, keyed on the whole call.
let callCounter = 0;
const shellEvent = (command, id = `call_${++callCounter}`) => ({
  tool: "shell",
  sessionID: "ses_1",
  agent: "build",
  messageID: "msg_1",
  id,
  input: { command },
});

test("registers every skills/* folder once with name and description from frontmatter", async () => {
  await withDir(async (dir) => {
    await addSkill(dir, "alpha", "Does alpha");
    await addSkill(dir, "beta", "Does beta");
    await mkdir(path.join(dir, "not-a-skill"));
    const { ctx, added } = fakeCtx();
    await make({ skillsDir: dir }).setup(ctx);
    assert.deepEqual(
      added.map((s) => [s.id, s.name, s.description]),
      [
        ["alpha", "alpha", "Does alpha"],
        ["beta", "beta", "Does beta"],
      ],
    );
    assert.equal(added[0].path, path.join(dir, "alpha", "SKILL.md"));
    assert.match(added[0].content, /^# alpha/);
    assert.doesNotMatch(added[0].content, /^---/);
  });
});

test("listSkills returns [] for a missing directory", () => {
  assert.deepEqual(listSkills(missingSkills), []);
});

test("a skill rejected by editor.add does not stop the others", async () => {
  await withDir(async (dir) => {
    await addSkill(dir, "alpha", "a");
    await addSkill(dir, "beta", "b");
    const added = [];
    const { ctx } = fakeCtx();
    ctx.skill.transform = async (fn) =>
      fn({
        add: (s) => {
          if (s.id === "alpha") throw new Error("schema mismatch");
          added.push(s.id);
        },
      });
    await make({ skillsDir: dir }).setup(ctx);
    assert.deepEqual(added, ["beta"]);
  });
});

test("context hook pushes standards for a top-level session", async () => {
  const { ctx, hooks } = fakeCtx();
  await make().setup(ctx);
  const event = { sessionID: "ses_1", system: [] };
  await hooks["session.context"](event);
  assert.equal(event.system.length, 1);
  assert.equal(event.system[0].type, "text");
  assert.match(event.system[0].text, /senior-standards/);
  assert.match(event.system[0].text, /decision-gate/);
});

test("context hook skips child sessions (parentID set)", async () => {
  const { ctx, hooks } = fakeCtx({
    session: { id: "ses_child", parentID: "ses_parent" },
  });
  await make().setup(ctx);
  const event = { sessionID: "ses_child", system: [] };
  await hooks["session.context"](event);
  assert.equal(event.system.length, 0);
});

test("context hook does not duplicate standards", async () => {
  const { ctx, hooks } = fakeCtx();
  await make().setup(ctx);
  const event = { sessionID: "ses_1", system: [] };
  await hooks["session.context"](event);
  await hooks["session.context"](event);
  assert.equal(event.system.length, 1);
});

test("isChildSession fails open on lookup errors and reads parentID", async () => {
  assert.equal(
    await isChildSession(async () => ({ parentID: "p" }), "s"),
    true,
  );
  assert.equal(await isChildSession(async () => ({ data: {} }), "s"), false);
  assert.equal(
    await isChildSession(async () => {
      throw new Error("boom");
    }, "s"),
    false,
  );
  assert.equal(
    await isChildSession(async () => ({ parentID: "p" }), ""),
    false,
  );
});

test("guard: evaluate hook asks only for the dependency action and carries a message", async () => {
  const { ctx, hooks } = fakeCtx();
  await make().setup(ctx);
  const other = { action: "shell", effect: "allow", resources: ["x"] };
  await hooks["permission.evaluate"](other);
  assert.equal(other.effect, "allow");
  assert.equal(other.message, undefined);
  const mine = {
    action: "senior-standards.dependency",
    effect: "allow",
    resources: ["left-pad"],
    source: { type: "tool", id: "call_1" },
  };
  await hooks["permission.evaluate"](mine);
  assert.equal(mine.effect, "ask");
  assert.match(mine.message, /left-pad/);
});

test("guard: uncovered shell install triggers the ADR-0003 mechanism with the package name", async () => {
  await withDir(async (dir) => {
    const { ctx, hooks, calls } = fakeCtx({ directory: dir });
    await make().setup(ctx);
    await hooks["tool.execute.before"](
      shellEvent("pnpm add left-pad", "call_first"),
    );
    assert.equal(calls.assert.length, 1);
    const req = calls.assert[0];
    assert.equal(req.action, "senior-standards.dependency");
    assert.deepEqual(req.resources, ["left-pad"]);
    assert.equal(req.sessionID, "ses_1");
    assert.equal(req.agent, "build");
    assert.deepEqual(req.source, {
      type: "tool",
      messageID: "msg_1",
      id: "call_first",
    });
  });
});

test("guard: covered install and non-install calls do nothing", async () => {
  await withDir(async (dir) => {
    await mkdir(path.join(dir, "docs", "adr"), { recursive: true });
    await writeFile(
      path.join(dir, "docs", "adr", "0001-x.md"),
      "---\nstatus: accepted\ndate: 2026-01-01\npackages: [left-pad]\n---\n# x\n",
    );
    const { ctx, hooks, calls } = fakeCtx({ directory: dir });
    await make().setup(ctx);
    await hooks["tool.execute.before"](shellEvent("pnpm add left-pad"));
    await hooks["tool.execute.before"](shellEvent("echo hello"));
    await hooks["tool.execute.before"]({
      ...shellEvent(""),
      tool: "read",
      input: { path: "a.txt" },
    });
    assert.equal(calls.assert.length, 0);
  });
});

test("guard: a permission rejection propagates unchanged", async () => {
  await withDir(async (dir) => {
    const rejection = {
      _tag: "Tool.Error",
      message: "rejected",
      error: { _tag: "Permission.CorrectedError" },
    };
    const declined = { _tag: "Permission.DeclinedError" };
    for (const err of [rejection, declined]) {
      const { ctx, hooks } = fakeCtx({
        directory: dir,
        assert: async () => {
          throw err;
        },
      });
      await make().setup(ctx);
      await assert.rejects(
        hooks["tool.execute.before"](shellEvent("pnpm add left-pad")),
        (thrown) => thrown === err,
      );
    }
  });
});

test("guard: any other assert error falls back to throwing the guard reason", async () => {
  await withDir(async (dir) => {
    const { ctx, hooks } = fakeCtx({
      directory: dir,
      assert: async () => {
        throw new TypeError("assert is broken");
      },
    });
    await make().setup(ctx);
    await assert.rejects(
      hooks["tool.execute.before"](shellEvent("pnpm add left-pad")),
      /not covered.*left-pad/s,
    );
  });
});

test("guard: missing permission.assert falls back to throwing the guard reason", async () => {
  await withDir(async (dir) => {
    const { ctx, hooks } = fakeCtx({ directory: dir });
    ctx.permission.assert = undefined;
    await make().setup(ctx);
    await assert.rejects(
      hooks["tool.execute.before"](shellEvent("pnpm add left-pad")),
      /left-pad/,
    );
  });
});

test("guard: an error while evaluating fails closed with a guard error", async () => {
  const logged = [];
  const { ctx, hooks, calls } = fakeCtx();
  Object.defineProperty(ctx, "location", {
    get() {
      throw new Error("no location");
    },
  });
  await make({ logger: { error: (...a) => logged.push(a) } }).setup(ctx);
  await assert.rejects(
    hooks["tool.execute.before"](shellEvent("pnpm add left-pad")),
    { message: "senior-standards guard error: no location" },
  );
  await assert.rejects(hooks["tool.execute.before"](null), (error) =>
    error.message.startsWith("senior-standards guard error: "),
  );
  assert.equal(logged.length, 2);
  assert.equal(calls.assert.length, 0);
});

test("setup survives every ctx domain throwing", async () => {
  const boom = () => {
    throw new Error("boom");
  };
  const ctx = {
    get location() {
      return boom();
    },
    skill: { transform: boom },
    session: { hook: boom },
    tool: { hook: boom },
    permission: { hook: boom, assert: boom },
  };
  await make().setup(ctx);
  await make().setup({});
  await make().setup(undefined);
});

test("default export has id and setup; repeated setup is harmless", async () => {
  assert.equal(plugin.id, "senior-standards");
  assert.equal(typeof plugin.setup, "function");
  const { ctx, hooks } = fakeCtx();
  await plugin.setup(ctx);
  await plugin.setup(ctx);
  const event = { sessionID: "ses_1", system: [] };
  await hooks["session.context"](event);
  assert.equal(event.system.length, 1);
});

test("context hook still injects when another system part merely mentions the project path", async () => {
  const { ctx, hooks } = fakeCtx();
  await make().setup(ctx);
  const event = {
    sessionID: "ses_1",
    system: [{ type: "text", text: "cwd: /tmp/senior-standards-smoke" }],
  };
  await hooks["session.context"](event);
  assert.equal(event.system.length, 2);
});

test("guard: fails closed when the evaluate hook could not be registered", async () => {
  await withDir(async (dir) => {
    const { ctx, hooks, calls } = fakeCtx({ directory: dir });
    ctx.permission.hook = async () => {
      throw new Error("boom");
    };
    await make().setup(ctx);
    await assert.rejects(
      hooks["tool.execute.before"](shellEvent("pnpm add left-pad")),
      /not covered.*left-pad/s,
    );
    assert.equal(calls.assert.length, 0);
  });
});

/**
 * Fake host that keeps every registration, as OpenCode does when setup runs
 * more than once, and runs every evaluate hook inside assert.
 */
function stackingHost(directory) {
  const evaluateHooks = [];
  const beforeHooks = [];
  const asserts = [];
  const ctx = {
    location: { directory },
    skill: { transform: async () => {} },
    session: { hook: async () => {}, get: async () => ({}) },
    tool: {
      hook: async (name, fn) => {
        if (name === "execute.before") beforeHooks.push(fn);
      },
    },
    permission: {
      hook: async (name, fn) => {
        if (name === "evaluate") evaluateHooks.push(fn);
      },
      assert: async (req) => {
        const event = {
          sessionID: req.sessionID,
          agent: req.agent,
          action: req.action,
          resources: req.resources,
          source: req.source,
          effect: "allow",
        };
        for (const fn of evaluateHooks) await fn(event);
        asserts.push({ req, effect: event.effect, message: event.message });
        await new Promise((resolve) => setTimeout(resolve, 5));
      },
    },
  };
  return { ctx, evaluateHooks, beforeHooks, asserts };
}

// Known limit (ADR 0003): only in-flight decisions are shared, so stacked
// hooks run strictly one after another each evaluate the call again.
test("guard: stacked hooks run in turn each evaluate with the real reason", async () => {
  await withDir(async (dir) => {
    const host = stackingHost(dir);
    const plugin = make();
    for (let i = 0; i < 3; i++) await plugin.setup(host.ctx);
    assert.equal(host.beforeHooks.length, 3);
    const event = shellEvent("pnpm add left-pad");
    for (const fn of host.beforeHooks) await fn(event);
    assert.equal(host.asserts.length, 3);
    for (const a of host.asserts) {
      assert.equal(a.effect, "ask");
      assert.match(
        a.message,
        /^New dependency not covered by an accepted ADR: left-pad\. /,
      );
    }
  });
});

test("guard: repeated setup asks once per call when hooks run together", async () => {
  await withDir(async (dir) => {
    const host = stackingHost(dir);
    for (let i = 0; i < 3; i++) await make().setup(host.ctx);
    const event = shellEvent("pnpm add left-pad");
    await Promise.all(host.beforeHooks.map((fn) => fn(event)));
    assert.equal(host.asserts.length, 1);
    assert.match(host.asserts[0].message, /not covered.*left-pad/s);
  });
});

test("guard: a rejection reaches every stacked hook for that call", async () => {
  await withDir(async (dir) => {
    const host = stackingHost(dir);
    const declined = { _tag: "Permission.DeclinedError" };
    host.ctx.permission.assert = async () => {
      throw declined;
    };
    for (let i = 0; i < 3; i++) await make().setup(host.ctx);
    const event = shellEvent("pnpm add left-pad");
    for (const fn of host.beforeHooks) {
      await assert.rejects(fn(event), (thrown) => thrown === declined);
    }
  });
});

test("guard: the evaluate hook keeps a configured deny", async () => {
  const { ctx, hooks } = fakeCtx();
  await make().setup(ctx);
  const event = {
    action: "senior-standards.dependency",
    effect: "deny",
    resources: ["left-pad"],
    source: { type: "tool", id: "call_denied" },
  };
  await hooks["permission.evaluate"](event);
  assert.equal(event.effect, "deny");
  assert.equal(event.message, undefined);
});

test("guard: a reused call id with a different command is evaluated again", async () => {
  await withDir(async (dir) => {
    const { ctx, hooks, calls } = fakeCtx({ directory: dir });
    await make().setup(ctx);
    const first = shellEvent("ls", "call_0");
    await hooks["tool.execute.before"](first);
    assert.equal(calls.assert.length, 0);
    await hooks["tool.execute.before"]({
      ...shellEvent("pnpm add left-pad", "call_0"),
      messageID: "msg_other",
    });
    assert.equal(calls.assert.length, 1);
    assert.deepEqual(calls.assert[0].resources, ["left-pad"]);
    // Same message too: the input alone must still force a new decision.
    await hooks["tool.execute.before"](shellEvent("ls", "call_reuse"));
    await hooks["tool.execute.before"](
      shellEvent("pnpm add right-pad", "call_reuse"),
    );
    assert.equal(calls.assert.length, 2);
    assert.deepEqual(calls.assert[1].resources, ["right-pad"]);
  });
});

test("guard: the same call issued after the first settled is evaluated again", async () => {
  await withDir(async (dir) => {
    const { ctx, hooks, calls } = fakeCtx({ directory: dir });
    await make().setup(ctx);
    const event = shellEvent("pnpm add left-pad", "call_again");
    await hooks["tool.execute.before"](event);
    await hooks["tool.execute.before"]({ ...event });
    assert.equal(calls.assert.length, 2);
  });
});

test("guard: concurrent stacked hooks for one call share one assert and its outcome", async () => {
  await withDir(async (dir) => {
    const host = stackingHost(dir);
    for (let i = 0; i < 3; i++) await make().setup(host.ctx);
    const event = shellEvent("pnpm add left-pad");
    const results = await Promise.all(
      host.beforeHooks.map((fn) => fn({ ...event, input: { ...event.input } })),
    );
    assert.equal(host.asserts.length, 1);
    assert.deepEqual(results, [undefined, undefined, undefined]);
  });
});

test("guard: a rejection reaches every concurrent stacked hook for that call", async () => {
  await withDir(async (dir) => {
    const host = stackingHost(dir);
    const declined = { _tag: "Permission.DeclinedError" };
    let count = 0;
    host.ctx.permission.assert = async () => {
      count++;
      await new Promise((resolve) => setTimeout(resolve, 5));
      throw declined;
    };
    for (let i = 0; i < 3; i++) await make().setup(host.ctx);
    const event = shellEvent("pnpm add left-pad");
    const settled = await Promise.allSettled(
      host.beforeHooks.map((fn) => fn(event)),
    );
    assert.equal(count, 1);
    for (const result of settled) {
      assert.equal(result.status, "rejected");
      assert.equal(result.reason, declined);
    }
  });
});

test("guard: the evaluate message does not bleed across sessions sharing a call id", async () => {
  await withDir(async (dir) => {
    const host = stackingHost(dir);
    // Both calls store their reason before either prompt is evaluated.
    const original = host.ctx.permission.assert;
    host.ctx.permission.assert = async (req) => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return original(req);
    };
    await make().setup(host.ctx);
    const [before] = host.beforeHooks;
    const shared = { messageID: "msg_x", id: "call_shared" };
    await Promise.all([
      before({ ...shellEvent("pnpm add left-pad"), ...shared }),
      before({
        ...shellEvent("pnpm add right-pad"),
        ...shared,
        sessionID: "ses_2",
      }),
    ]);
    assert.equal(host.asserts.length, 2);
    for (const a of host.asserts) {
      assert.match(a.message, new RegExp(a.req.resources[0]));
    }
    const right = host.asserts.find((a) => a.req.sessionID === "ses_2");
    assert.doesNotMatch(right.message, /left-pad/);
  });
});

test("guard: a commit with AI attribution prompts with the ai-attribution resource and full reason", async () => {
  await withDir(async (dir) => {
    const { ctx, hooks, calls } = fakeCtx({ directory: dir });
    await make().setup(ctx);
    const event = shellEvent(
      'git commit -m "feat: x" -m "Co-Authored-By: Claude <noreply@anthropic.com>"',
      "call_attr",
    );
    let message;
    calls.assert = [];
    ctx.permission.assert = async (req) => {
      calls.assert.push(req);
      const evalEvent = {
        action: req.action,
        effect: "allow",
        sessionID: req.sessionID,
        source: req.source,
        resources: req.resources,
      };
      await hooks["permission.evaluate"](evalEvent);
      message = evalEvent.message;
    };
    await hooks["tool.execute.before"](event);
    assert.equal(calls.assert.length, 1);
    assert.deepEqual(calls.assert[0].resources, ["ai-attribution"]);
    assert.match(message, /^Commit or PR text contains AI attribution \(/);
  });
});

test("guard: a plain commit does nothing", async () => {
  await withDir(async (dir) => {
    const { ctx, hooks, calls } = fakeCtx({ directory: dir });
    await make().setup(ctx);
    await hooks["tool.execute.before"](shellEvent('git commit -m "fix: x"'));
    assert.equal(calls.assert.length, 0);
  });
});
