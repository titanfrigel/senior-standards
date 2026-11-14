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
// Push options that take a separate value.
const PUSH_VALUE_FLAGS = new Set([
  "-o",
  "--push-option",
  "--repo",
  "--receive-pack",
  "--exec",
]);

/** `{ sub, args }` when the segment is a `git <watched subcommand>`; else null. */
function gitSubcommand(segment) {
  const tokens = tokenizeSegment(segment);
  if (tokens[0] !== "git") return null;
  let i = 1;
  while (i < tokens.length && tokens[i].startsWith("-")) {
    i += GLOBAL_VALUE_FLAGS.has(tokens[i]) ? 2 : 1;
  }
  const sub = tokens[i];
  return WATCHED.has(sub) ? { sub, args: tokens.slice(i + 1) } : null;
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

function createsMaster(sub, args) {
  if (sub === "branch") {
    if (args.some((a) => ["-d", "-D", "--delete"].includes(a))) return false;
    return args.some((a) => !a.startsWith("-") && a === "master");
  }
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
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("-")) {
      if (PUSH_VALUE_FLAGS.has(args[i])) i += 1;
      continue;
    }
    positional.push(args[i]);
  }
  const refspecs = positional.slice(1);
  if (refspecs.length === 0) return [null];
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

  for (const { sub, args } of subcommandsOf(command)) {
    if (sub === "init") {
      const chosen = initialBranchOf(args);
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
