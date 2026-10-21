import { isObject, newResult, parseJsonObject, record } from "./shared.mjs";

export const id = "composer";

export function matches(fileName) {
  return fileName === "composer.json";
}

export function extract(text, fileName = "composer.json") {
  const doc = parseJsonObject(text, fileName);
  const result = newResult();
  for (const section of ["require", "require-dev"]) {
    if (!isObject(doc[section])) continue;
    for (const name of Object.keys(doc[section])) {
      if (name === "php" || name.startsWith("ext-")) continue;
      record(result, name);
    }
  }
  return result;
}
