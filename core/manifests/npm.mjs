import { isObject, newResult, parseJsonObject, record } from "./shared.mjs";

export const id = "npm";

const SECTIONS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
];
const INTERNAL = /^(workspace|file|link):/;
const EXTERNAL = /^(git|github:|https?:)/;
const GITHUB_SHORTHAND = /^[\w.-]+\/[\w.-]+(#.*)?$/;

export function matches(fileName) {
  return fileName === "package.json";
}

export function extract(text, fileName = "package.json") {
  const doc = parseJsonObject(text, fileName);
  const result = newResult();
  for (const section of SECTIONS) {
    if (!isObject(doc[section])) continue;
    for (const [name, spec] of Object.entries(doc[section])) {
      if (typeof spec !== "string") {
        record(result, name);
      } else if (INTERNAL.test(spec)) {
        // internal reference: not a new dependency
      } else if (EXTERNAL.test(spec) || GITHUB_SHORTHAND.test(spec)) {
        record(result, name, spec);
      } else {
        record(result, name);
      }
    }
  }
  return result;
}
