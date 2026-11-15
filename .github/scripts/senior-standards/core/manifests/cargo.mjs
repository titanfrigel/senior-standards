import { newResult, record } from "./shared.mjs";
import {
  readDependencySpec,
  splitDotted,
  tomlSections,
} from "./toml-lines.mjs";

export const id = "cargo";

const DEP_TABLES = new Set([
  "dependencies",
  "dev-dependencies",
  "build-dependencies",
]);

export function matches(fileName) {
  return fileName === "Cargo.toml";
}

/** Index of the dependency-table keyword in a section path, or -1. */
function tableIndex(segments) {
  let start = 0;
  if (segments[0] === "workspace") start = 1;
  else if (segments[0] === "target") start = 2;
  return DEP_TABLES.has(segments[start]) ? start : -1;
}

function add(result, name, specText) {
  const spec = readDependencySpec(specText);
  if (spec.internal) return;
  record(result, spec.packageName ?? name, spec.source ?? undefined);
}

export function extract(text, fileName = "Cargo.toml") {
  const result = newResult();
  for (const { segments, entries } of tomlSections(text, fileName)) {
    const index = tableIndex(segments);
    if (index === -1) continue;
    if (segments.length === index + 1) {
      // [dependencies]: `name = …` or dotted `name.attr = …`, grouped by name
      const grouped = new Map();
      for (const { key, value } of entries) {
        const [name, ...attr] = splitDotted(key);
        const line = attr.length ? `${attr.join(".")} = ${value}` : value;
        grouped.set(name, `${grouped.get(name) ?? ""}, ${line}`);
      }
      for (const [name, specText] of grouped) add(result, name, specText);
    } else if (segments.length === index + 2) {
      // [dependencies.name]
      const specText = entries.map((e) => `${e.key} = ${e.value}`).join(", ");
      add(result, segments[index + 1], specText);
    }
  }
  return result;
}
