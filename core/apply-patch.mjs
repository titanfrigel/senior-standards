// Parses and applies the `*** Begin Patch` format used by OpenCode and Codex.

const HEADER = /^\*\*\* (Add File|Update File|Delete File): (.*)$/;
const OPS = {
  "Add File": "add",
  "Update File": "update",
  "Delete File": "delete",
};

/**
 * Splits a patch into per-file sections. `lines` are the raw body lines
 * (hunk headers, context, removed and added lines) without line endings.
 */
export function parsePatch(text) {
  const sections = [];
  let current = null;
  for (const line of text.split(/\r?\n/)) {
    const header = HEADER.exec(line);
    if (header) {
      current = { op: OPS[header[1]], path: header[2].trim(), lines: [] };
      sections.push(current);
    } else if (line.startsWith("*** Begin Patch")) {
      current = null;
    } else if (line.startsWith("*** End Patch")) {
      current = null;
    } else if (line.startsWith("*** Move to:")) {
      if (current?.op === "update") current.moveTo = line.slice(12).trim();
    } else if (current && line !== "") {
      current.lines.push(line);
    } else if (current && current.op === "update" && line === "") {
      // A blank line inside a hunk is an empty context line.
      current.lines.push(" ");
    }
  }
  for (const section of sections) {
    // Trailing blank context produced by the final newline is not part of the hunk.
    while (section.lines.at(-1) === " ") section.lines.pop();
  }
  return sections;
}

function matchesAt(haystack, needle, i) {
  return needle.every((line, j) => haystack[i + j] === line);
}

function findSequence(haystack, needle, from) {
  if (needle.length === 0) return { at: haystack.length, count: 1 };
  let first = -1;
  let count = 0;
  for (let i = from; i + needle.length <= haystack.length; i++) {
    if (matchesAt(haystack, needle, i)) {
      if (first === -1) first = i;
      count++;
    }
  }
  return { at: first, count };
}

/** Applies an Update section's hunks; throws when any hunk does not match. */
export function applyUpdate(content, lines) {
  const eol = content.includes("\r\n") ? "\r\n" : "\n";
  const endsWithNewline = content === "" || /\r?\n$/.test(content);
  const file = content === "" ? [] : content.split(/\r?\n/);
  if (endsWithNewline && file.at(-1) === "") file.pop();

  const hunks = [];
  for (const line of lines) {
    if (line.startsWith("@@"))
      hunks.push({ header: line.slice(2).trim(), lines: [] });
    else if (line.startsWith("***")) continue;
    else {
      if (hunks.length === 0) hunks.push({ header: "", lines: [] });
      hunks.at(-1).lines.push(line);
    }
  }

  let cursor = 0;
  for (const hunk of hunks) {
    const oldLines = [];
    const newLines = [];
    for (const line of hunk.lines) {
      const body = line.slice(1);
      if (line[0] === " ") {
        oldLines.push(body);
        newLines.push(body);
      } else if (line[0] === "-") oldLines.push(body);
      else if (line[0] === "+") newLines.push(body);
    }
    let from = cursor;
    if (hunk.header !== "") {
      const seek = file.findIndex(
        (line, i) => i >= cursor && line.trim() === hunk.header,
      );
      if (seek === -1) throw new Error("patch hunk did not match");
      from = seek + 1;
    }
    const { at, count } = findSequence(file, oldLines, from);
    if (at === -1) throw new Error("patch hunk did not match");
    if (count > 1 && hunk.header === "")
      throw new Error("patch hunk is ambiguous");
    file.splice(at, oldLines.length, ...newLines);
    cursor = at + newLines.length;
  }
  return file.length === 0 ? "" : file.join(eol) + (endsWithNewline ? eol : "");
}
