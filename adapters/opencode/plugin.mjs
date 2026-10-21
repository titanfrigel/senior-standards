// OpenCode v2 adapter (spec §6.5, ADR 0003). A plain { id, setup } default
// export with no dependency on the OpenCode plugin package.

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseFrontmatter } from "../../core/adr-index.mjs";
import { evaluate } from "../../core/evaluate.mjs";
import { loadStandards } from "../../core/load-standards.mjs";
import { normalize } from "../../core/normalize.mjs";

const ID = "senior-standards";
// Tag wrapping the injected text; also the duplicate check (a bare "senior-standards"
// would match e.g. the working directory in the host system prompt).
const MARKER = `<${ID}>`;
const DEPENDENCY_ACTION = "senior-standards.dependency";
const DEFAULT_SKILLS_DIR = fileURLToPath(
  new URL("../../skills", import.meta.url),
);
const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/;

const log = (logger, ...args) => {
  try {
    logger.error(`[${ID}]`, ...args);
  } catch {
    // logging must never throw
  }
};

/** Reads `<skillsDir>/<name>/SKILL.md` for every folder; [] when the dir is missing. */
export function listSkills(skillsDir) {
  let entries;
  try {
    entries = readdirSync(skillsDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const skills = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const skillPath = path.join(skillsDir, entry.name, "SKILL.md");
    if (!existsSync(skillPath)) continue;
    try {
      const text = readFileSync(skillPath, "utf8").replace(/^﻿/, "");
      const meta = parseFrontmatter(text) ?? {};
      const skill = {
        id: entry.name,
        name: meta.name || entry.name,
        path: skillPath,
        content: text.replace(FRONTMATTER, "").trim(),
      };
      if (meta.description) skill.description = meta.description;
      skills.push(skill);
    } catch {
      // unreadable skill: skip it, keep the rest
    }
  }
  return skills;
}

/** True when the session has a parentID (a subagent session). Fails open. */
export async function isChildSession(getSession, sessionID) {
  if (!sessionID) return false;
  try {
    const result = await getSession(sessionID);
    const session = result && "data" in result ? result.data : result;
    return (
      Boolean(session) && session.parentID != null && session.parentID !== ""
    );
  } catch {
    return false;
  }
}

// OpenCode may run setup several times per launch (ADR 0003), and every run
// registers its own hooks. The guard state is module-level so that stacked
// hooks share it.
//
// Guard decisions in flight, keyed on the whole call: session, message, call
// id, tool and a fingerprint of the input. A stacked execute.before hook for
// the same call awaits the pending decision instead of prompting again. The
// entry is removed as soon as it settles: a settled decision is never reused,
// because providers may emit non-unique call ids and a stale pass would let a
// different call through unchecked. Known limits (ADR 0003, "Not yet
// verified"): stacked hooks that OpenCode runs strictly one after another
// each evaluate, and may prompt, again for the same call; and if OpenCode
// re-imports this module per setup, the module-level dedup does not apply.
const inFlight = new Map();
// Guard reasons for pending prompts, so any evaluate hook can show the full
// text. The evaluate event only carries the session, the source (message and
// call id) and the resources, so the reason is keyed on those.
const reasons = new Map();

/** JSON with object keys sorted at every level, so equal inputs match. */
function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys
      .filter((k) => value[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function callKey(event) {
  const input = createHash("sha256")
    .update(stableStringify(event.input))
    .digest("hex");
  return JSON.stringify([
    event.sessionID,
    event.messageID,
    event.id,
    event.tool,
    input,
  ]);
}

function reasonKey(sessionID, source, resources) {
  return JSON.stringify([
    sessionID,
    source?.messageID,
    source?.id,
    resources ?? [],
  ]);
}

const REJECTION_TAG = /^Permission\.\w+Error$/;

/**
 * OpenCode's own permission rejection: `Permission.DeclinedError` /
 * `Permission.CorrectedError`, bare or wrapped in a `Tool.Error` (ADR 0003).
 */
function isPermissionRejection(error) {
  for (const e of [error, error?.error, error?.cause]) {
    const tag = e?._tag ?? e?.name;
    if (typeof tag === "string" && REJECTION_TAG.test(tag)) return true;
  }
  return false;
}

/**
 * Prompt resources: the packages and specs named in the reason prose plus the
 * decision's structured `items`; falls back to the touched file.
 */
function resourcesFor(reason, call, items = []) {
  const names = [];
  const listed = /(?:ADR|source): (.+?)\. (?=[A-Z]|$)/g;
  for (const match of reason.matchAll(listed)) {
    for (const name of match[1].split(", ")) if (name) names.push(name);
  }
  names.push(...items);
  if (names.length > 0) return [...new Set(names)];
  const file = call?.path ?? call?.filePath;
  if (typeof file === "string" && file)
    return [path.basename(file.replaceAll("\\", "/"))];
  return ["dependency"];
}

export function createPlugin({
  skillsDir = DEFAULT_SKILLS_DIR,
  logger = console,
} = {}) {
  async function setup(ctx) {
    const guarded = async (label, fn) => {
      try {
        await fn();
      } catch (error) {
        log(logger, `${label} failed:`, error);
      }
    };

    // assert alone resolves as allow without the evaluate hook (ADR 0003).
    let evaluateHooked = false;
    let standards;

    await guarded("skill registration", async () => {
      const skills = listSkills(skillsDir);
      await ctx.skill.transform((editor) => {
        for (const skill of skills) {
          try {
            editor.add(skill);
          } catch (error) {
            log(
              logger,
              `skill "${skill.id}" rejected by host, skipping:`,
              error,
            );
          }
        }
      });
    });

    await guarded("context hook registration", async () => {
      await ctx.session.hook("context", async (event) => {
        try {
          const system = event.system;
          if (!Array.isArray(system)) return;
          if (system.some((part) => String(part?.text ?? "").includes(MARKER)))
            return;
          if (
            typeof ctx.session.get === "function" &&
            (await isChildSession(
              (sessionID) => ctx.session.get({ sessionID }),
              event.sessionID,
            ))
          ) {
            return;
          }
          standards ??= loadStandards();
          system.push({
            type: "text",
            text: `<${ID}>\n${standards}\n</${ID}>`,
          });
        } catch (error) {
          log(logger, "context hook failed:", error);
        }
      });
    });

    await guarded("permission hook registration", async () => {
      await ctx.permission.hook("evaluate", async (event) => {
        try {
          if (event?.action !== DEPENDENCY_ACTION) return;
          // A configured deny is final; never weaken it to ask.
          if (event.effect === "deny") return;
          event.effect = "ask";
          const stored = reasons.get(
            reasonKey(event.sessionID, event.source, event.resources),
          );
          event.message =
            stored ??
            `Dependency not covered by an accepted ADR: ${(event.resources ?? []).join(", ")}. Record a decision (ADR) first.`;
        } catch (error) {
          log(logger, "evaluate hook failed:", error);
        }
      });
      evaluateHooked = true;
    });

    await guarded("tool hook registration", async () => {
      async function guardCall(event) {
        let decision;
        let call;
        try {
          call = normalize("opencode", event.tool, event.input);
          decision = await evaluate(call, ctx.location.directory);
        } catch (error) {
          log(logger, "guard failed:", error);
          throw new Error(
            `senior-standards guard error: ${error?.message ?? String(error)}`,
          );
        }
        if (decision?.decision !== "ask") return;

        const reason = decision.reason;
        const request = {
          sessionID: event.sessionID,
          agent: event.agent,
          source: { type: "tool", messageID: event.messageID, id: event.id },
          action: DEPENDENCY_ACTION,
          resources: resourcesFor(reason, call, decision.items),
          save: [],
        };
        if (!evaluateHooked || typeof ctx.permission?.assert !== "function") {
          throw new Error(reason);
        }
        const reasonAt = reasonKey(
          request.sessionID,
          request.source,
          request.resources,
        );
        reasons.set(reasonAt, reason);
        try {
          await ctx.permission.assert(request);
        } catch (error) {
          if (isPermissionRejection(error)) throw error;
          log(
            logger,
            "permission.assert unavailable, blocking instead:",
            error,
          );
          throw new Error(reason);
        } finally {
          reasons.delete(reasonAt);
        }
      }

      await ctx.tool.hook("execute.before", (event) => {
        const id = event?.id;
        if (id === undefined || id === null || id === "") {
          return guardCall(event);
        }
        let key;
        try {
          key = callKey(event);
        } catch {
          return guardCall(event);
        }
        let pending = inFlight.get(key);
        if (!pending) {
          pending = guardCall(event).finally(() => inFlight.delete(key));
          inFlight.set(key, pending);
        }
        return pending;
      });
    });
  }

  return { id: ID, setup };
}

export default createPlugin();
