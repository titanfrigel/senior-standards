import { cannotParse, newResult, record, splitLines } from "./shared.mjs";

export const id = "dart";

const SECTIONS = new Set(["dependencies", "dev_dependencies"]);

export function matches(fileName) {
  return fileName === "pubspec.yaml";
}

function indentOf(line) {
  return line.length - line.trimStart().length;
}

/** Splits a section body into entries: `{ name, inline, body }`. */
function readEntries(lines, fileName) {
  const entries = [];
  let entryIndent = null;
  for (const line of lines) {
    const indent = indentOf(line);
    if (line.slice(0, indent).includes("\t")) throw cannotParse(fileName);
    entryIndent ??= indent;
    if (indent === entryIndent) {
      const m = /^([^\s:][^:]*):\s*(.*)$/.exec(line.trim());
      if (!m) throw cannotParse(fileName);
      entries.push({
        name: m[1].replace(/^["']|["']$/g, ""),
        inline: m[2],
        body: [],
      });
    } else if (entries.length) {
      entries.at(-1).body.push(line.trim());
    }
  }
  return entries;
}

function classify({ inline, body }) {
  const all = [inline, ...body].join("\n");
  const git = /(^|[\s{,])git\s*:\s*(.*)$/m.exec(all);
  if (!git) return { internal: /(^|[\s{,])(sdk|path)\s*:/.test(all) };
  const url =
    /(^|[\s{,])url\s*:\s*([^\s,}]+)/.exec(all)?.[2] ||
    git[2].replace(/[}\s].*$/, "") ||
    "git";
  return { internal: false, source: url.replace(/^["']|["']$/g, "") };
}

export function extract(text, fileName = "pubspec.yaml") {
  const lines = splitLines(text)
    .map((l) => l.replace(/(^|\s)#.*$/, "").trimEnd())
    .filter((l) => l.trim());
  const result = newResult();
  let i = 0;
  while (i < lines.length) {
    const header = /^([A-Za-z_]+):\s*$/.exec(lines[i]);
    i += 1;
    const body = [];
    while (i < lines.length && indentOf(lines[i]) > 0) {
      body.push(lines[i]);
      i += 1;
    }
    if (!header || !SECTIONS.has(header[1])) continue;
    for (const entry of readEntries(body, fileName)) {
      const spec = classify(entry);
      if (!spec.internal) record(result, entry.name, spec.source);
    }
  }
  return result;
}
