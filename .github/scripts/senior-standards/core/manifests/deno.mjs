import {
  isObject,
  newResult,
  parseJsonObject,
  record,
  stripJsonc,
} from "./shared.mjs";

export const id = "deno";

export function matches(fileName) {
  return fileName === "deno.json" || fileName === "deno.jsonc";
}

export function extract(text, fileName = "deno.json") {
  const source = fileName.endsWith(".jsonc") ? stripJsonc(text) : text;
  const doc = parseJsonObject(source, fileName);
  const result = newResult();
  if (!isObject(doc.imports)) return result;
  for (const [name, target] of Object.entries(doc.imports)) {
    if (typeof target === "string" && /^(\.{0,2}\/|file:)/.test(target)) {
      continue;
    }
    const remote = typeof target === "string" && /^https?:/.test(target);
    record(result, name, remote ? target : undefined);
  }
  return result;
}
