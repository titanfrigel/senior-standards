// Helpers shared by the manifest extractors.

export function cannotParse(fileName) {
  return new Error(`could not parse ${fileName}`);
}

export function newResult() {
  return { names: new Set(), external: new Map() };
}

/** Records a dependency; an external source wins over a registry entry. */
export function record(result, name, source) {
  if (source) {
    result.names.delete(name);
    result.external.set(name, source);
  } else if (!result.external.has(name)) {
    result.names.add(name);
  }
}

export function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function parseJsonObject(text, fileName) {
  let doc;
  try {
    doc = JSON.parse(text);
  } catch {
    throw cannotParse(fileName);
  }
  if (!isObject(doc)) throw cannotParse(fileName);
  return doc;
}

/** Removes // and block comments and trailing commas, leaving strings intact. */
export function stripJsonc(text) {
  let out = "";
  let inString = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      out += ch;
      if (ch === "\\") {
        out += text[i + 1] ?? "";
        i += 1;
      } else if (ch === '"') {
        inString = false;
      }
    } else if (ch === '"') {
      inString = true;
      out += ch;
    } else if (ch === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i += 1;
      out += "\n";
    } else if (ch === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2);
      i = end === -1 ? text.length : end + 1;
    } else if (ch === ",") {
      if (!/^\s*[}\]]/.test(text.slice(i + 1))) out += ch;
    } else {
      out += ch;
    }
  }
  return out;
}

export function splitLines(text) {
  return text.split(/\r?\n/);
}
