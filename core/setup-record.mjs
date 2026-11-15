// Finds and parses the project setup record in the root AGENTS.md (spec 5.4).

import { open, readdir } from "node:fs/promises";
import path from "node:path";
import { createGitReader } from "./git-reader.mjs";
import { findExtractor, isUnparsedManifest } from "./manifests/index.mjs";

export const SETUP_MARKER = "<!-- senior-standards:setup v1 -->";
export const REMINDER =
  "This repository has no project setup record. Before planning features, run project-init.";

const MAX_BYTES = 256 * 1024;

const FIELDS = [
  { label: "goal", key: "goal", keepCase: true },
  { label: "docs", key: "docs", title: "Docs", allowed: ["basic", "full"] },
  {
    label: "tests",
    key: "tests",
    title: "Tests",
    allowed: ["light", "standard", "strict"],
  },
  {
    label: "public repository",
    key: "public",
    title: "Public repository",
    allowed: ["yes", "no"],
  },
  {
    label: "maintained over time",
    key: "maintained",
    title: "Maintained over time",
    allowed: ["yes", "no"],
  },
  {
    label: "versioned releases",
    key: "versioned",
    title: "Versioned releases",
    allowed: ["yes", "no"],
  },
  { label: "overrides", key: "overrides", keepCase: true },
  { label: "recorded", key: "recorded" },
];

/** Parses the lines after the marker, up to the next `## ` heading. */
export function parseSetupRecord(text) {
  const lines = String(text).replace(/^﻿/, "").split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === SETUP_MARKER);
  if (start === -1) return { found: false, values: {}, problems: [] };

  const values = {};
  for (const line of lines.slice(start + 1)) {
    if (/^##\s/.test(line)) break;
    const pair = /^\s*-\s+([^:]+?)\s*:\s*(.*)$/.exec(line);
    if (!pair) continue;
    const field = FIELDS.find((f) => f.label === pair[1].toLowerCase());
    if (!field || field.key in values) continue;
    const value = pair[2].trim();
    values[field.key] = field.keepCase ? value : value.toLowerCase();
  }

  const problems = [];
  for (const field of FIELDS) {
    if (!field.allowed) continue;
    const value = values[field.key];
    if (value === undefined || value === "") {
      delete values[field.key];
      problems.push(`${field.title}: missing`);
    } else if (!field.allowed.includes(value)) {
      problems.push(
        `${field.title}: "${value}" is not one of ${field.allowed.join(", ")}`,
      );
    }
  }
  return { found: true, values, problems };
}

export function integrationBranch(values) {
  return values?.versioned === "yes" ? "dev" : "main";
}

async function topLevelOf(dir, git) {
  try {
    return (await git.topLevel(dir)) ?? null;
  } catch {
    return null;
  }
}

export async function findProjectRoot(dir, git = createGitReader()) {
  return (await topLevelOf(dir, git)) ?? dir;
}

async function hasManifest(dir) {
  try {
    const names = await readdir(dir);
    return names.some(
      (name) => findExtractor(name) || isUnparsedManifest(name),
    );
  } catch {
    return false;
  }
}

async function readHead(file) {
  let handle;
  try {
    handle = await open(file, "r");
    const buffer = Buffer.alloc(MAX_BYTES);
    const { bytesRead } = await handle.read(buffer, 0, MAX_BYTES, 0);
    return buffer.subarray(0, bytesRead).toString("utf8");
  } catch {
    return null;
  } finally {
    await handle?.close().catch(() => {});
  }
}

export async function isProjectDir(dir, git = createGitReader()) {
  return (await topLevelOf(dir, git)) !== null || (await hasManifest(dir));
}

async function readRecordAt(root) {
  const text = await readHead(path.join(root, "AGENTS.md"));
  if (text === null) return { root, found: false, values: {}, problems: [] };
  return { root, ...parseSetupRecord(text) };
}

export async function readSetupRecord(dir, git = createGitReader()) {
  return readRecordAt(await findProjectRoot(dir, git));
}

export async function setupReminder(dir, git = createGitReader()) {
  // One Git call: the top level answers both "is this a project" and "where".
  const top = await topLevelOf(dir, git);
  if (top === null && !(await hasManifest(dir))) return null;
  const record = await readRecordAt(top ?? dir);
  if (record.found && record.problems.length === 0) return null;
  if (!record.found) return REMINDER;
  return `${REMINDER} Setup record problems: ${record.problems.join("; ")}.`;
}
