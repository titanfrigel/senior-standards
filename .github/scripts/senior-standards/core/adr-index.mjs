// Reads the project's ADR log and reports which packages accepted ADRs approve.
// Also parses the small YAML subset used by ADR and SKILL.md frontmatter.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

function unquote(value) {
  const v = value.trim();
  if (v.length >= 2 && (v[0] === '"' || v[0] === "'") && v.at(-1) === v[0]) {
    return v.slice(1, -1);
  }
  return v;
}

/**
 * Parses a leading `---` frontmatter block. Supports scalars, inline lists and
 * block lists; nested maps are ignored. Returns null when there is no block.
 */
export function parseFrontmatter(text) {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  if (lines[0]?.trimEnd() !== "---") return null;
  const end = lines.findIndex((line, i) => i > 0 && line.trimEnd() === "---");
  if (end === -1) return null;

  const result = {};
  let listKey = null;
  for (const line of lines.slice(1, end)) {
    const item = /^\s+-\s+(.*)$/.exec(line) ?? /^-\s+(.*)$/.exec(line);
    if (item && listKey) {
      result[listKey].push(unquote(item[1]));
      continue;
    }
    const pair = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!pair) continue;
    const [, key, raw] = pair;
    const value = raw.trim();
    listKey = null;
    if (value === "") {
      result[key] = [];
      listKey = key;
    } else if (value.startsWith("[") && value.endsWith("]")) {
      result[key] = value
        .slice(1, -1)
        .split(",")
        .map(unquote)
        .filter((entry) => entry !== "");
    } else {
      result[key] = unquote(value);
    }
  }
  return result;
}

/** Collects `packages` from `status: accepted` ADRs under docs/adr/. */
export async function readApprovedPackages(projectDir) {
  const approved = new Set();
  const problems = [];
  const adrDir = path.join(projectDir, "docs", "adr");

  let names;
  try {
    names = await readdir(adrDir);
  } catch (error) {
    if (error.code === "ENOENT") return { approved, problems };
    problems.push(`docs/adr: ${error.message}`);
    return { approved, problems };
  }

  for (const name of names.filter((n) => n.endsWith(".md")).sort()) {
    let text;
    try {
      text = await readFile(path.join(adrDir, name), "utf8");
    } catch (error) {
      problems.push(`${name}: unreadable (${error.message})`);
      continue;
    }
    const meta = parseFrontmatter(text);
    if (!meta) {
      problems.push(`${name}: no frontmatter`);
      continue;
    }
    if (meta.status !== "accepted") continue;
    const packages = Array.isArray(meta.packages)
      ? meta.packages
      : meta.packages
        ? [meta.packages]
        : [];
    for (const pkg of packages) approved.add(pkg);
  }
  return { approved, problems };
}
