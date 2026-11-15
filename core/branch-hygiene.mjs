// Branch hygiene for shell commands: no master branches, `git init -b main`,
// and no direct pushes to the integration branch.

import { splitCommand, tokenizeSegment } from "./parse-install.mjs";

const INIT_REASON = 'Initialise the repository with "git init -b main".';
const MASTER_REASON = "The default branch is main, not master.";
const pushReason = (branch) =>
  `Changes reach ${branch} through a pull request, not a direct push.`;

const WATCHED = new Set(["init", "branch", "checkout", "switch", "push"]);
// Global git options that take a separate value.
const GLOBAL_VALUE_FLAGS = new Set(["-C", "-c", "--git-dir", "--work-tree"]);
// `git branch` options that never create a branch (delete, list, upstream).
const BRANCH_NON_CREATING = new Set([
  "-d",
  "-D",
  "--delete",
  "-l",
  "--list",
  "--contains",
  "--no-contains",
  "--merged",
  "--no-merged",
  "--points-at",
  "-u",
  "--set-upstream-to",
  "--unset-upstream",
  "--edit-description",
  "--show-current",
]);
const BRANCH_MOVE_COPY = new Set(["-m", "-M", "--move", "-c", "-C", "--copy"]);
// Push options that take a separate value.
const PUSH_VALUE_FLAGS = new Set([
  "-o",
  "--push-option",
  "--repo",
  "--receive-pack",
  "--exec",
]);

/**
 * `{ sub, args, defaultBranch }` when the segment is a `git <watched subcommand>`;
 * else null. `defaultBranch` comes from a global `-c init.defaultBranch=<x>`.
 */
function gitSubcommand(segment) {
  const tokens = tokenizeSegment(segment);
  if (tokens[0] !== "git") return null;
  let defaultBranch = null;
  let i = 1;
  while (i < tokens.length && tokens[i].startsWith("-")) {
    const value = tokens[i + 1] ?? "";
    if (tokens[i] === "-c" && /^init.defaultbranch=/i.test(value)) {
      defaultBranch = value.slice(value.indexOf("=") + 1);
    }
    i += GLOBAL_VALUE_FLAGS.has(tokens[i]) ? 2 : 1;
  }
  const sub = tokens[i];
  return WATCHED.has(sub)
    ? { sub, args: tokens.slice(i + 1), defaultBranch }
    : null;
}

function subcommandsOf(command) {
  return splitCommand(String(command ?? ""))
    .map(gitSubcommand)
    .filter(Boolean);
}

/** True when the command contains a git init/branch/checkout/switch/push segment. */
export function touchesBranches(command) {
  return subcommandsOf(command).length > 0;
}

async function safe(read) {
  try {
    return (await read()) ?? null;
  } catch {
    return null;
  }
}

function initialBranchOf(args) {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "-b" || arg === "--initial-branch") return args[i + 1] ?? null;
    if (arg.startsWith("--initial-branch=")) return arg.slice(17);
    if (/^-b./.test(arg)) return arg.slice(2);
  }
  return null;
}

/** True when a `git branch` invocation creates (or renames/copies to) master. */
function branchCreatesMaster(args) {
  if (args.some((a) => BRANCH_NON_CREATING.has(a.split("=")[0]))) return false;
  const positional = args.filter((a) => !a.startsWith("-"));
  if (args.some((a) => BRANCH_MOVE_COPY.has(a))) {
    // `-m [<old>] <new>`: only the target name matters.
    return positional.length > 0 && positional.at(-1) === "master";
  }
  // `git branch <name> [<start-point>]`: only the new name matters.
  return positional[0] === "master";
}

function createsMaster(sub, args) {
  if (sub === "branch") return branchCreatesMaster(args);
  const creators =
    sub === "checkout"
      ? ["-b", "-B"]
      : ["-c", "-C", "--create", "--force-create"];
  return args.some(
    (a, i) =>
      (creators.includes(a) && args[i + 1] === "master") ||
      (a.startsWith("--create=") && a.slice(9) === "master"),
  );
}

/** Destination branches of a push; `null` entries mean "the current branch". */
function pushTargets(args) {
  const tagsOnly = args.includes("--tags");
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("-")) {
      if (PUSH_VALUE_FLAGS.has(args[i])) i += 1;
      continue;
    }
    positional.push(args[i]);
  }
  const refspecs = positional.slice(1);
  if (refspecs.length === 0) return tagsOnly ? [] : [null];
  return refspecs.map((spec) => {
    const dst = spec.replace(/^\+/, "").split(":").pop();
    const name = dst.replace(/^refs\/heads\//, "");
    return name === "HEAD" || name === "" ? null : name;
  });
}

export async function branchHygieneReasons(
  command,
  dir,
  { git, versioned } = {},
) {
  const reasons = new Set();
  const protectedBranches = new Set(["main"]);
  if (versioned === "yes") protectedBranches.add("dev");

  for (const { sub, args, defaultBranch } of subcommandsOf(command)) {
    if (sub === "init") {
      const chosen = initialBranchOf(args) ?? defaultBranch;
      if (chosen === null) {
        const configured = git
          ? await safe(() => git.defaultBranch(dir))
          : null;
        if (configured !== "main") reasons.add(INIT_REASON);
      } else if (chosen === "master") reasons.add(MASTER_REASON);
    } else if (sub === "push") {
      for (const target of pushTargets(args)) {
        const branch =
          target ?? (git ? await safe(() => git.currentBranch(dir)) : null);
        if (branch !== null && protectedBranches.has(branch)) {
          reasons.add(pushReason(branch));
        }
      }
    } else if (createsMaster(sub, args)) {
      reasons.add(MASTER_REASON);
    }
  }
  return [...reasons];
}
