// Finds the text a shell command would write into commit messages, tags, notes,
// merges, pull requests and issues, so it can be checked for AI attribution.

import { open, stat } from "node:fs/promises";
import path from "node:path";
import { splitCommand, tokenizeSegment } from "./parse-install.mjs";

const MAX_FILE_BYTES = 1024 * 1024;

const GIT_GLOBAL_VALUE_FLAGS = [
  "-C",
  "-c",
  "--git-dir",
  "--work-tree",
  "--namespace",
];
const GH_TARGETS = {
  pr: ["create", "edit", "comment", "review", "merge"],
  issue: ["create", "edit", "comment"],
};

// Per tool: flags that name a file with the text, and the other flags that
// take a value (so a value like "-F x" is never read as a flag).
const FLAGS = {
  git: {
    fileShort: "F",
    fileLong: ["--file"],
    valueShort: "mCctF",
    valueLong: [
      "--message",
      "--file",
      "--author",
      "--date",
      "--reuse-message",
      "--reedit-message",
      "--fixup",
      "--squash",
      "--template",
      "--cleanup",
      "--gpg-sign",
      "--trailer",
    ],
  },
  gh: {
    fileShort: "F",
    fileLong: ["--body-file"],
    valueShort: "tbFRBalpH",
    valueLong: [
      "--title",
      "--body",
      "--body-file",
      "--subject",
      "--repo",
      "--base",
      "--head",
      "--label",
      "--assignee",
      "--reviewer",
      "--milestone",
      "--project",
    ],
  },
};

/** The command's arguments after `git [global flags] <sub>`, or null. */
function gitArgs(tokens) {
  let i = 1;
  while (tokens[i]?.startsWith("-")) {
    i += GIT_GLOBAL_VALUE_FLAGS.includes(tokens[i]) ? 2 : 1;
  }
  const sub = tokens[i];
  if (["commit", "tag", "merge"].includes(sub)) return tokens.slice(i + 1);
  if (sub === "notes" && ["add", "append"].includes(tokens[i + 1])) {
    return tokens.slice(i + 2);
  }
  return null;
}

function ghArgs(tokens) {
  const targets = GH_TARGETS[tokens[1]];
  return targets?.includes(tokens[2]) ? tokens.slice(3) : null;
}

/** Arguments of a recognised commit or PR command; null for anything else. */
function vcsArgs(tokens) {
  if (tokens[0] === "git") return gitArgs(tokens);
  if (tokens[0] === "gh") return ghArgs(tokens);
  return null;
}

/**
 * File paths given to the command's file flag, and whether any of them is
 * stdin (`-`). Handles `--file f`, `--file=f`, `-F f`, `-Ff` and grouped
 * short flags (`-aF f`, `-am msg`, `-mmsg`).
 */
function referencedFiles(tool, args) {
  const spec = FLAGS[tool];
  const files = [];
  let stdin = false;
  const take = (value) => {
    if (value === "-") stdin = true;
    else if (value) files.push(value);
  };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const [flag, inline] = arg.split(/=(.*)/s);
      const isFile = spec.fileLong.includes(flag);
      if (inline !== undefined) {
        if (isFile) take(inline);
      } else if (isFile) {
        take(args[i + 1]);
        i += 1;
      } else if (spec.valueLong.includes(flag)) {
        i += 1;
      }
      continue;
    }
    if (!arg.startsWith("-") || arg === "-") continue;
    for (let j = 1; j < arg.length; j++) {
      const flag = arg[j];
      if (!spec.valueShort.includes(flag)) continue;
      const attached = arg.slice(j + 1);
      const value = attached === "" ? args[i + 1] : attached;
      if (flag === spec.fileShort) take(value);
      if (attached === "") i += 1;
      break;
    }
  }
  return { files, stdin };
}

const WINDOWS_DEVICE = /^(con|prn|aux|nul|conin\$|conout\$|com\d|lpt\d)$/i;

/** Paths that are devices or pipes rather than files: never opened. */
function isDevicePath(file) {
  const slashed = file.replaceAll("\\", "/");
  if (/^\/dev\//.test(slashed) || /^\/\/[.?]\//.test(slashed)) return true;
  const base = slashed.split("/").pop().split(".")[0];
  return WINDOWS_DEVICE.test(base);
}

async function readIfPossible(projectDir, file) {
  if (file === "-" || isDevicePath(file)) return null;
  try {
    const target = path.resolve(projectDir, file);
    if (!(await stat(target)).isFile()) return null;
    const handle = await open(target, "r");
    try {
      const buffer = Buffer.alloc(MAX_FILE_BYTES);
      const { bytesRead } = await handle.read(buffer, 0, MAX_FILE_BYTES, 0);
      return buffer.toString("utf8", 0, bytesRead);
    } finally {
      await handle.close();
    }
  } catch {
    return null;
  }
}

const VARIABLE = /\$[A-Za-z_{]/;
const HEREDOC_OPERATOR = /(?<!<)<<(?!<)-?[ \t]*(['"]?)([\w-]+)\1/g;

/** Bodies of the heredocs opened by `segment` (which starts at `at` in `command`). */
function heredocBodies(command, segment, at) {
  const bodies = [];
  for (const match of segment.matchAll(HEREDOC_OPERATOR)) {
    const lineEnd = command.indexOf("\n", at + match.index);
    if (lineEnd === -1) continue;
    const lines = command.slice(lineEnd + 1).split("\n");
    const body = [];
    for (const line of lines) {
      if (line.trim() === match[2]) break;
      body.push(line);
    }
    bodies.push(body.join("\n"));
  }
  return bodies;
}

/**
 * Text to scan for a command that writes commit, tag, note, merge, PR or issue
 * text: each matching segment with its heredoc bodies (the whole command when
 * the segment reads a variable or piped stdin), followed by the contents of
 * every readable file it references. [] for any other command.
 */
export async function vcsTextOf(command, projectDir) {
  const texts = [];
  const files = [];
  let cursor = 0;
  for (const segment of splitCommand(command)) {
    const at = command.indexOf(segment, cursor);
    if (at !== -1) cursor = at + segment.length;
    const tokens = tokenizeSegment(segment);
    const args = vcsArgs(tokens);
    if (!args) continue;
    const referenced = referencedFiles(tokens[0], args);
    files.push(...referenced.files);
    const hasHeredoc = new RegExp(HEREDOC_OPERATOR).test(segment);
    const needsContext =
      at === -1 || VARIABLE.test(segment) || (referenced.stdin && !hasHeredoc);
    texts.push(
      needsContext
        ? command
        : [segment, ...heredocBodies(command, segment, at)].join("\n"),
    );
  }
  if (texts.length === 0) return [];
  const contents = await Promise.all(
    files.map((file) => readIfPossible(projectDir, file)),
  );
  return [...texts, ...contents.filter((text) => text !== null)];
}
