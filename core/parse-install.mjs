// Detects commands that add dependencies or tools, across ecosystems.
// Adding an ecosystem is one row in RULES.

const SEPARATORS = ["&&", "||", ";", "|", "\n", "\r"];

// A lone & backgrounds a command; `>&`, `&>` and `2>&1` are redirections.
function isBackgroundAmpersand(command, i) {
  const prev = command[i - 1];
  const next = command[i + 1];
  return prev !== ">" && prev !== "<" && next !== ">";
}

/** Splits a shell command on &&, ||, ;, |, &, and newlines outside quotes. */
export function splitCommand(command) {
  const segments = [];
  let current = "";
  let quote = null;
  let i = 0;
  while (i < command.length) {
    const ch = command[i];
    if (quote) {
      if (ch === "\\" && quote === '"' && i + 1 < command.length) {
        current += ch + command[i + 1];
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      current += ch;
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      i += 1;
      continue;
    }
    const sep = SEPARATORS.find((s) => command.startsWith(s, i));
    if (sep) {
      segments.push(current);
      current = "";
      i += sep.length;
      continue;
    }
    if (ch === "&" && isBackgroundAmpersand(command, i)) {
      segments.push(current);
      current = "";
      i += 1;
      continue;
    }
    current += ch;
    i += 1;
  }
  segments.push(current);
  return segments.map((s) => s.trim()).filter(Boolean);
}

/** Quote-aware whitespace tokeniser; quotes are removed from tokens. */
function tokenize(segment) {
  const tokens = [];
  let current = "";
  let started = false;
  let quote = null;
  for (let i = 0; i < segment.length; i++) {
    const ch = segment[i];
    if (quote) {
      if (ch === "\\" && quote === '"' && segment[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (ch === quote) {
        quote = null;
      } else {
        current += ch;
      }
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      started = true;
    } else if (ch === "#" && !started) {
      break; // unquoted comment: ignore the rest
    } else if (/\s/.test(ch)) {
      if (started) tokens.push(current);
      current = "";
      started = false;
    } else {
      current += ch;
      started = true;
    }
  }
  if (started) tokens.push(current);
  return tokens;
}

// ---- version stripping ----

const PREFIXED = /^(jsr|npm):/;

function stripNpmVersion(token) {
  const prefix = PREFIXED.exec(token)?.[0] ?? "";
  const name = token.slice(prefix.length);
  const at = name.lastIndexOf("@");
  return prefix + (at > 0 ? name.slice(0, at) : name);
}

function stripPipVersion(token) {
  const cut = token.search(/[[=<>~!;@\s]/);
  return cut === -1 ? token : token.slice(0, cut);
}

function stripAtVersion(token) {
  const at = token.indexOf("@");
  return at > 0 ? token.slice(0, at) : token;
}

function stripComposerVersion(token) {
  const cut = token.search(/[:=@]/);
  return cut > 0 ? token.slice(0, cut) : token;
}

const keepName = (token) => token;

// ---- local / external classification ----

const LOCAL =
  /^(\.{1,2}([\\/]|$)|[\\/~]|[A-Za-z]:[\\/]|(file|link|workspace|portal):)/;
const EXTERNAL =
  /^(git\+|git:|git@|github:|gitlab:|bitbucket:|gist:|https?:|ssh:)|\.(tgz|tar\.gz|zip|whl)$/;
const REPO_SHORTHAND = /^[\w.-]+\/[\w.-]+(#.*)?$/;

const isLocal = (token) => LOCAL.test(token);
const isExternal = (token) => EXTERNAL.test(token);
const isNpmExternal = (token) =>
  EXTERNAL.test(token) || REPO_SHORTHAND.test(token);

// ---- rule construction ----

const GLOBAL_FLAGS = ["-g", "--global"];

/** Index of the first token at or after `start` that is not a flag or a flag's value. */
function skipFlags(tokens, start, valueFlags) {
  let i = start;
  while (tokens[i]?.startsWith("-")) {
    i += valueFlags.includes(tokens[i]) ? 2 : 1;
  }
  return i;
}

/**
 * Builds a match() from subcommand paths. `table` entries are [words, kind].
 * With leadingFlags, flags before the subcommand are skipped (`pnpm --filter web add`).
 */
function subcommands(
  bins,
  table,
  { valueFlags = [], globalIsTool = false, leadingFlags = false },
) {
  return (tokens) => {
    if (!bins.includes(tokens[0])) return null;
    const start = leadingFlags ? skipFlags(tokens, 1, valueFlags) : 1;
    for (const [words, kind] of table) {
      if (words.every((w, k) => tokens[start + k] === w)) {
        const isGlobal =
          globalIsTool && tokens.some((t) => GLOBAL_FLAGS.includes(t));
        return {
          kind: isGlobal ? "tool" : kind,
          argsStart: start + words.length,
        };
      }
    }
    return null;
  };
}

const rule = (manager, bins, table, extra = {}) => ({
  valueFlags: [],
  externalFlags: [],
  stripVersion: keepName,
  isLocal,
  isExternal,
  ...extra,
  manager,
  match: subcommands(bins, table, extra),
});

const JS_INSTALL = [
  [["install"], "dependency"],
  [["i"], "dependency"],
  [["add"], "dependency"],
];

// `dotnet add [project] package X`, `dotnet tool install X`.
function matchDotnet(tokens) {
  if (tokens[0] !== "dotnet") return null;
  if (tokens[1] === "tool" && tokens[2] === "install")
    return { kind: "tool", argsStart: 3 };
  if (tokens[1] !== "add") return null;
  const packageAt = tokens[2] === "package" ? 2 : 3;
  return tokens[packageAt] === "package"
    ? { kind: "dependency", argsStart: packageAt + 1 }
    : null;
}

const YARN_VALUE_FLAGS = ["--cwd", "--registry"];

// `yarn add X`, `yarn global add X`, `yarn workspace <name> add X`, after any
// leading flags (`yarn --cwd web add X`).
function matchYarn(tokens) {
  if (tokens[0] !== "yarn") return null;
  const at = skipFlags(tokens, 1, YARN_VALUE_FLAGS);
  if (tokens[at] === "add") return { kind: "dependency", argsStart: at + 1 };
  if (tokens[at] === "global" && tokens[at + 1] === "add")
    return { kind: "tool", argsStart: at + 2 };
  if (tokens[at] === "workspace" && tokens[at + 2] === "add")
    return { kind: "dependency", argsStart: at + 3 };
  return null;
}

const DART_FLAGS = [
  "--git-url",
  "--git-ref",
  "--git-path",
  "--hosted-url",
  "--path",
  "--sdk",
];

const RULES = [
  rule("npm", ["npm"], JS_INSTALL, {
    valueFlags: [
      "--prefix",
      "-w",
      "--workspace",
      "--registry",
      "--tag",
      "--loglevel",
    ],
    globalIsTool: true,
    leadingFlags: true,
    stripVersion: stripNpmVersion,
    isExternal: isNpmExternal,
  }),
  rule("pnpm", ["pnpm"], JS_INSTALL, {
    valueFlags: ["--filter", "-F", "-C", "--dir", "--registry"],
    globalIsTool: true,
    leadingFlags: true,
    stripVersion: stripNpmVersion,
    isExternal: isNpmExternal,
  }),
  {
    manager: "yarn",
    match: matchYarn,
    valueFlags: YARN_VALUE_FLAGS,
    externalFlags: [],
    stripVersion: stripNpmVersion,
    isLocal,
    isExternal: isNpmExternal,
  },
  rule("bun", ["bun"], JS_INSTALL, {
    valueFlags: ["--cwd", "--registry"],
    globalIsTool: true,
    leadingFlags: true,
    stripVersion: stripNpmVersion,
    isExternal: isNpmExternal,
  }),
  rule(
    "deno",
    ["deno"],
    [
      [["add"], "dependency"],
      [["install"], "dependency"],
    ],
    {
      valueFlags: ["--config", "-c"],
      globalIsTool: true,
      stripVersion: stripNpmVersion,
    },
  ),
  {
    manager: "dotnet",
    match: matchDotnet,
    valueFlags: [
      "--version",
      "-v",
      "--framework",
      "-f",
      "--source",
      "-s",
      "--package-directory",
      "--add-source",
      "--tool-path",
    ],
    externalFlags: [],
    stripVersion: keepName,
    isLocal,
    isExternal,
  },
  rule(
    "cargo",
    ["cargo"],
    [
      [["add"], "dependency"],
      [["install"], "tool"],
    ],
    {
      valueFlags: [
        "--features",
        "-F",
        "--branch",
        "--tag",
        "--rev",
        "--path",
        "--registry",
        "--rename",
        "-p",
        "--package",
        "--target",
        "--manifest-path",
        "--version",
        "--root",
      ],
      externalFlags: ["--git"],
      stripVersion: stripAtVersion,
    },
  ),
  rule("pip", ["pip", "pip3"], [[["install"], "dependency"]], {
    valueFlags: [
      "-r",
      "--requirement",
      "-c",
      "--constraint",
      "-e",
      "--editable",
      "-i",
      "--index-url",
      "--extra-index-url",
      "-t",
      "--target",
      "--prefix",
      "--root",
      "-f",
      "--find-links",
    ],
    stripVersion: stripPipVersion,
  }),
  rule(
    "uv",
    ["uv"],
    [
      [["tool", "install"], "tool"],
      [["pip", "install"], "dependency"],
      [["add"], "dependency"],
    ],
    {
      valueFlags: [
        "--group",
        "--optional",
        "--extra",
        "--index",
        "--python",
        "-p",
        "--from",
        "--with",
        "-r",
        "--requirement",
        "-c",
        "--constraint",
        "-e",
        "--editable",
        "-i",
        "--index-url",
        "--extra-index-url",
      ],
      externalFlags: ["--git"],
      stripVersion: stripPipVersion,
    },
  ),
  rule("poetry", ["poetry"], [[["add"], "dependency"]], {
    valueFlags: [
      "--group",
      "-G",
      "--source",
      "-s",
      "--extras",
      "-E",
      "--python",
      "--platform",
    ],
    stripVersion: stripPipVersion,
  }),
  rule("pipx", ["pipx"], [[["install"], "tool"]], {
    valueFlags: ["--python", "--pip-args", "--suffix"],
    stripVersion: stripPipVersion,
  }),
  rule(
    "go",
    ["go"],
    [
      [["get"], "dependency"],
      [["install"], "tool"],
    ],
    {
      valueFlags: ["-C", "-o", "-ldflags", "-tags"],
      stripVersion: stripAtVersion,
    },
  ),
  rule(
    "composer",
    ["composer"],
    [
      [["global", "require"], "tool"],
      [["require"], "dependency"],
    ],
    { valueFlags: ["--working-dir", "-d"], stripVersion: stripComposerVersion },
  ),
  rule("bundle", ["bundle"], [[["add"], "dependency"]], {
    valueFlags: [
      "--version",
      "-v",
      "--source",
      "-s",
      "--group",
      "-g",
      "--require",
      "-r",
      "--path",
    ],
  }),
  rule("gem", ["gem"], [[["install"], "tool"]], {
    valueFlags: [
      "--version",
      "-v",
      "--source",
      "-s",
      "--bindir",
      "-n",
      "--install-dir",
      "-i",
    ],
  }),
  rule("dart", ["dart"], [[["pub", "add"], "dependency"]], {
    valueFlags: DART_FLAGS,
    externalFlags: ["--git-url"],
  }),
  rule("flutter", ["flutter"], [[["pub", "add"], "dependency"]], {
    valueFlags: DART_FLAGS,
    externalFlags: ["--git-url"],
  }),
];

const NOT_INSTALLS = new Set(["echo", "printf"]);

function matchRule(tokens) {
  for (const r of RULES) {
    const hit = r.match(tokens);
    if (hit) return { r, ...hit };
  }
  return null;
}

// Leading wrappers that run the real command, with the flags that take a value.
const WRAPPERS = {
  sudo: ["-u", "-g"],
  env: [],
  time: [],
  command: [],
  nice: ["-n"],
  corepack: [],
};
// `py`, `python`, `python3`, `python3.12`.
const PYTHON_BIN = /^(py|python(\d+(\.\d+)?)?)$/;
// Interpreter flags before `-m`: `-3`, `-3.12` (py launcher), `-I`, `-u`, ...
const PYTHON_FLAG = /^-[\w.]+$/;
const PYTHON_VALUE_FLAGS = ["-W", "-X"];
// Windows shims and executable extensions dropped from a command name.
const EXECUTABLE_EXTENSION = /\.(cmd|exe|ps1|bat)$/i;

/** `C:\nodejs\npm.cmd`, `/usr/bin/npm`, `./node_modules/.bin/pnpm` -> the bare name. */
function commandName(token) {
  const base = token.split(/[\\/]/).pop();
  return base.replace(EXECUTABLE_EXTENSION, "");
}

/** Arguments after `-m` in `python [flags] -m <module> ...`; null otherwise. */
function pythonModuleArgs(tokens) {
  if (!PYTHON_BIN.test(tokens[0] ?? "")) return null;
  let i = 1;
  while (tokens[i] !== "-m") {
    const flag = tokens[i];
    if (flag === undefined || flag === "-c" || !PYTHON_FLAG.test(flag))
      return null;
    i += PYTHON_VALUE_FLAGS.includes(flag) ? 2 : 1;
  }
  return tokens.slice(i + 1);
}
const ENV_ASSIGNMENT = /^[A-Za-z_]\w*=/;
// `>f`, `2>f`, `&>f`, `2>&1`, or a bare operator whose target is the next token.
const REDIRECTION = /^(\d*|&)(>>?|<)&?(.*)$/s;

function stripRedirections(tokens) {
  const kept = [];
  for (let i = 0; i < tokens.length; i++) {
    const match = REDIRECTION.exec(tokens[i]);
    if (!match) kept.push(tokens[i]);
    else if (match[3] === "") i += 1; // target is the next token
  }
  return kept;
}

// Drops redirections, env assignments and wrappers, reduces the command to its
// bare name, and rewrites `python -m pip …` to `pip …`.
function normalize(rawTokens) {
  const tokens = stripRedirections(rawTokens);
  for (;;) {
    if (tokens[0] === undefined) break;
    if (ENV_ASSIGNMENT.test(tokens[0])) {
      tokens.shift();
      continue;
    }
    tokens[0] = commandName(tokens[0]);
    const head = tokens[0];
    if (Object.hasOwn(WRAPPERS, head)) {
      tokens.shift();
      while (tokens[0]?.startsWith("-")) {
        const flag = tokens.shift();
        if (WRAPPERS[head].includes(flag)) tokens.shift();
      }
    } else {
      break;
    }
  }
  return pythonModuleArgs(tokens) ?? tokens;
}

/** Tokens of one command segment, with wrappers, env assignments and redirections removed. */
export function tokenizeSegment(segment) {
  return normalize(tokenize(segment));
}

function parseSegment(segment) {
  const tokens = normalize(tokenize(segment));
  if (tokens.length === 0 || NOT_INSTALLS.has(tokens[0])) return null;

  const hit = matchRule(tokens);
  if (!hit) return null;
  const { r, kind, argsStart } = hit;

  const packages = [];
  const external = [];
  for (let i = argsStart; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.startsWith("-")) {
      const [flag, inline] = token.split(/=(.*)/s);
      const value = inline !== undefined ? inline : tokens[i + 1];
      if (r.externalFlags.includes(flag) && value) external.push(value);
      const takesValue =
        r.valueFlags.includes(flag) || r.externalFlags.includes(flag);
      if (inline === undefined && takesValue) i += 1;
      continue;
    }
    if (r.isLocal(token)) continue;
    if (r.isExternal(token)) external.push(token);
    else packages.push(r.stripVersion(token));
  }
  if (packages.length === 0 && external.length === 0) return null;
  return { manager: r.manager, kind, packages, external };
}

/** One entry per command segment that adds a dependency or tool. */
export function parseInstall(command) {
  return splitCommand(command)
    .map(parseSegment)
    .filter((entry) => entry !== null);
}
