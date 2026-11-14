// CI check: fails when a branch adds a direct dependency that no accepted ADR
// lists. Runs with Node alone, so it imports only files that
// scripts/vendor-dependency-check.mjs copies into a project.
//
// Usage: node dependency-check.mjs --base <sha> [--dir <path>]
// Exit 0: nothing uncovered. 1: uncovered names. 2: usage or Git error.

import { execFile } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { readApprovedPackages } from "./adr-index.mjs";
import { isApproved } from "./approval.mjs";
import { addedDependencies } from "./diff-manifest.mjs";
import { findExtractor, isUnparsedManifest } from "./manifests/index.mjs";

const GIT_TIMEOUT_MS = 10_000;
const GIT_MAX_BUFFER = 64 * 1024 * 1024;
const CONFIRM = "Confirm any dependency change matches an accepted ADR.";
const ADR_HINT =
  "Write an ADR in docs/adr with status: accepted and these names in packages:";
const USAGE = "Usage: node dependency-check.mjs --base <sha> [--dir <path>]";

class GitError extends Error {}

/** Default Git access through `execFile`; every failure rejects. */
export function createGit(cwd) {
  function git(args) {
    return new Promise((resolve, reject) => {
      execFile(
        "git",
        args,
        {
          cwd,
          timeout: GIT_TIMEOUT_MS,
          maxBuffer: GIT_MAX_BUFFER,
          windowsHide: true,
        },
        (error, stdout, stderr) => {
          if (error) {
            const detail = String(stderr ?? "").trim() || error.message;
            reject(new Error(detail));
          } else resolve(String(stdout));
        },
      );
    });
  }

  return {
    async mergeBase(base) {
      return (await git(["merge-base", base, "HEAD"])).trim();
    },
    async changedFiles(base) {
      const out = await git([
        "diff",
        "--name-status",
        "-z",
        "-M",
        `${base}...HEAD`,
      ]);
      return parseNameStatus(out);
    },
    show: (rev, filePath) => git(["show", `${rev}:${filePath}`]),
  };
}

/** Parses `git diff --name-status -z` output. */
export function parseNameStatus(text) {
  const tokens = text.split("\0").filter((token) => token !== "");
  const changes = [];
  for (let i = 0; i < tokens.length; ) {
    const status = tokens[i];
    if (status.startsWith("R") || status.startsWith("C")) {
      changes.push({ status, oldPath: tokens[i + 1], path: tokens[i + 2] });
      i += 3;
    } else {
      changes.push({ status, path: tokens[i + 1] });
      i += 2;
    }
  }
  return changes;
}

async function viaGit(action) {
  try {
    return await action();
  } catch (error) {
    throw new GitError(error?.message ?? String(error));
  }
}

const stripBom = (text) => (text === null ? null : text.replace(/^﻿/, ""));

function splitExternal(entry) {
  const match = /^(.+?) \((.*)\)$/.exec(entry);
  return match ? { name: match[1], source: match[2] } : { name: entry };
}

async function textsOf(change, from, extractor, git) {
  const kind = change.status[0];
  const after = stripBom(await viaGit(() => git.show("HEAD", change.path)));
  if (kind === "A" || kind === "C") return { before: null, after };
  let beforePath = change.path;
  if (kind === "R") {
    // A rename from a different manifest type counts as a new manifest.
    if (findExtractor(change.oldPath)?.id !== extractor.id) {
      return { before: null, after };
    }
    beforePath = change.oldPath;
  }
  const before = stripBom(await viaGit(() => git.show(from, beforePath)));
  return { before, after };
}

/**
 * Lists names that manifests changed between `base` and HEAD add without an
 * accepted ADR. `git` is injectable: { changedFiles, show, mergeBase? }.
 */
export async function checkDependencies({ projectDir, base, git }) {
  const uncovered = [];
  const warnings = [];
  const changes = await viaGit(() => git.changedFiles(base));
  const from = (await viaGit(() => git.mergeBase?.(base))) || base;
  const { approved, problems } = await readApprovedPackages(projectDir);

  for (const change of changes) {
    if (change.status.startsWith("D")) continue;
    const file = change.path;
    const extractor = findExtractor(file);
    if (!extractor) {
      if (isUnparsedManifest(file)) {
        warnings.push(
          `${file} changed; this manifest type is not parsed. ${CONFIRM}`,
        );
      }
      continue;
    }
    const { before, after } = await textsOf(change, from, extractor, git);
    if (after === null) continue;
    let added;
    try {
      added = addedDependencies(extractor, before, after);
    } catch (error) {
      warnings.push(
        `${file} could not be parsed (${error.message}). ${CONFIRM}`,
      );
      continue;
    }
    const names = new Set(
      added.packages.filter(
        (name) => !isApproved(approved, extractor.id, name),
      ),
    );
    const external = [];
    for (const entry of added.external) {
      const { name } = splitExternal(entry);
      if (isApproved(approved, extractor.id, name)) continue;
      names.add(name);
      external.push(entry);
    }
    if (names.size === 0) continue;
    const result = { file, names: [...names].sort() };
    if (external.length > 0) result.external = external;
    uncovered.push(result);
  }
  return { uncovered, warnings, problems };
}

function parseArgs(args) {
  const options = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    const [flag, inline] = arg.split(/=(.*)/s, 2);
    if (flag !== "--base" && flag !== "--dir") {
      throw new Error(`unknown argument ${arg}`);
    }
    const value = inline ?? args[++i];
    if (!value) throw new Error(`${flag} needs a value`);
    options[flag.slice(2)] = value;
  }
  if (!options.base) throw new Error("--base is required");
  return options;
}

function report({ uncovered, warnings, problems }, out) {
  for (const warning of warnings) out(`Warning: ${warning}\n`);
  if (uncovered.length === 0) {
    out("No new dependencies outside accepted ADRs.\n");
    return 0;
  }
  out("New dependencies not covered by an accepted ADR:\n");
  const all = new Set();
  for (const { file, names, external = [] } of uncovered) {
    out(`  ${file}: ${names.join(", ")}\n`);
    for (const entry of external) {
      const { name, source } = splitExternal(entry);
      out(`    ${name} comes from a non-registry source: ${source}\n`);
    }
    for (const name of names) all.add(name);
  }
  for (const problem of problems) out(`ADR issue: ${problem}\n`);
  out(`${ADR_HINT} ${[...all].sort().join(", ")}\n`);
  return 1;
}

/** Runs the check as a CLI and resolves the exit code. */
export async function runCli(
  args,
  {
    git,
    out = (text) => process.stdout.write(text),
    err = (text) => process.stderr.write(text),
  } = {},
) {
  let options;
  try {
    options = parseArgs(args);
  } catch (error) {
    err(`dependency-check: ${error.message}\n${USAGE}\n`);
    return 2;
  }
  const projectDir = path.resolve(options.dir ?? process.cwd());
  try {
    const result = await checkDependencies({
      projectDir,
      base: options.base,
      git: git ?? createGit(projectDir),
    });
    return report(result, out);
  } catch (error) {
    if (error instanceof GitError) {
      err(
        `dependency-check: Git could not compare ${options.base} with HEAD (${error.message}). ` +
          "The base commit must be in the clone: check out with fetch-depth: 0.\n",
      );
    } else {
      err(`dependency-check: ${error?.message ?? String(error)}\n`);
    }
    return 2;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  process.exitCode = await runCli(process.argv.slice(2));
}
