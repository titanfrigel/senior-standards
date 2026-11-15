import { cannotParse, newResult, record, splitLines } from "./shared.mjs";

export const id = "go";

export function matches(fileName) {
  return fileName === "go.mod";
}

function addRequirement(result, body) {
  if (/\/\/\s*indirect\b/.test(body)) return;
  const [module] = body
    .replace(/\/\/.*$/, "")
    .trim()
    .split(/\s+/);
  if (module) record(result, module);
}

export function extract(text, fileName = "go.mod") {
  const result = newResult();
  let inBlock = false;
  for (const raw of splitLines(text)) {
    const line = raw.trim();
    if (inBlock) {
      if (line.startsWith(")")) inBlock = false;
      else if (line && !line.startsWith("//")) addRequirement(result, line);
    } else if (/^require\s*\(/.test(line)) {
      inBlock = true;
    } else if (/^require\s+\S/.test(line)) {
      addRequirement(result, line.replace(/^require\s+/, ""));
    }
  }
  if (inBlock) throw cannotParse(fileName);
  return result;
}
