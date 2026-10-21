// A tiny line-oriented TOML walker: enough to read dependency tables.
// Not a TOML parser; multi-line arrays and inline tables are joined into
// one logical entry, everything else is left as text.
import { cannotParse, splitLines } from "./shared.mjs";

function scanOutsideQuotes(text, onChar) {
  let quote = null;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (onChar(ch, i) === false) {
      return;
    }
  }
}

/**
 * Removes the comment from one line and replaces multi-line string contents
 * with an empty string. `state.triple` carries an open `"""` / `'''` across
 * lines.
 */
function cleanLine(line, state) {
  let out = "";
  let quote = null;
  let i = 0;
  while (i < line.length) {
    if (state.triple) {
      const close = line.indexOf(state.triple, i);
      if (close === -1) return out;
      i = close + 3;
      state.triple = null;
      continue;
    }
    const ch = line[i];
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === "#") {
      break;
    } else if (line.startsWith('"""', i) || line.startsWith("'''", i)) {
      state.triple = line.slice(i, i + 3);
      out += '""';
      i += 3;
      continue;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    }
    out += ch;
    i += 1;
  }
  return out;
}

function bracketDelta(line) {
  let delta = 0;
  scanOutsideQuotes(line, (ch) => {
    if (ch === "[" || ch === "{") delta += 1;
    if (ch === "]" || ch === "}") delta -= 1;
    return true;
  });
  return delta;
}

export function unquote(text) {
  const t = text.trim();
  const first = t[0];
  if ((first === '"' || first === "'") && t.endsWith(first) && t.length > 1) {
    return t.slice(1, -1);
  }
  return t;
}

/** Splits `a.'b.c'.d` on dots outside quotes and unquotes each segment. */
export function splitDotted(text) {
  const parts = [];
  let start = 0;
  scanOutsideQuotes(text, (ch, i) => {
    if (ch === ".") {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
    return true;
  });
  parts.push(text.slice(start));
  return parts.map(unquote);
}

function splitKeyValue(logical, fileName) {
  let eq = -1;
  scanOutsideQuotes(logical, (ch, i) => {
    if (ch !== "=") return true;
    eq = i;
    return false;
  });
  if (eq === -1) throw cannotParse(fileName);
  return {
    key: logical.slice(0, eq).trim(),
    value: logical.slice(eq + 1).trim(),
  };
}

/**
 * Returns sections in order: `{ segments, entries: [{ key, value }] }`.
 * Entries before the first header belong to a section with `segments: []`.
 * Throws on an unterminated table header or an unclosed array/table value.
 */
export function tomlSections(text, fileName) {
  const sections = [{ segments: [], entries: [] }];
  let pending = "";
  let depth = 0;
  const state = { triple: null };
  for (const raw of splitLines(text)) {
    const line = cleanLine(raw, state).trim();
    if (!pending && !line) continue;
    if (!pending && line.startsWith("[")) {
      const header = /^\[\[?\s*([^[\]]+?)\s*\]\]?$/.exec(line);
      if (!header) throw cannotParse(fileName);
      sections.push({ segments: splitDotted(header[1]), entries: [] });
      continue;
    }
    pending = pending ? `${pending} ${line}` : line;
    depth += bracketDelta(line);
    if (depth <= 0) {
      sections.at(-1).entries.push(splitKeyValue(pending, fileName));
      pending = "";
      depth = 0;
    }
  }
  if (pending || state.triple) throw cannotParse(fileName);
  return sections;
}

/** Quoted strings in a TOML value, ignoring anything inside `{ }`. */
export function arrayStrings(value) {
  const flat = value.replace(/\{[^}]*\}/g, " ");
  return [...flat.matchAll(/"([^"]*)"|'([^']*)'/g)]
    .map((m) => m[1] ?? m[2])
    .filter(Boolean);
}

/**
 * Classifies a dependency's value text (an inline table, or the joined
 * attributes of a `[…dependencies.name]` table).
 */
export function readDependencySpec(text) {
  const value = (name) => {
    const pattern = new RegExp(
      `(?:^|[{,\\s])${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s,}]+))`,
    );
    const m = pattern.exec(text);
    return m ? (m[1] ?? m[2] ?? m[3]) : null;
  };
  return {
    internal:
      value("path") !== null ||
      value("file") !== null ||
      value("workspace") === "true",
    source: value("git") ?? value("url"),
    packageName: value("package"),
  };
}
