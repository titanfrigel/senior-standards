import { cannotParse, newResult, record } from "./shared.mjs";
import { tomlSections, unquote } from "./toml-lines.mjs";

export const id = "gradle";

const STRING = /"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/g;
const CONFIGURATION =
  "(?:\\w*[Ii]mplementation|api|compileOnly|runtimeOnly|testRuntimeOnly|kapt|ksp)";
const CALL = new RegExp(
  `\\b${CONFIGURATION}\\b\\s*\\(?\\s*(?:platform\\(\\s*)?(?:"([^"]+)"|'([^']+)')`,
  "g",
);
const COORDINATE = /^([^:\s"']+):([^:\s"']+)(?::|$)/;

export function matches(fileName) {
  return (
    fileName === "build.gradle" ||
    fileName === "build.gradle.kts" ||
    fileName === "libs.versions.toml"
  );
}

function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");
}

function extractBuildScript(text, fileName) {
  const code = stripComments(text);
  let depth = 0;
  for (const ch of code.replace(STRING, '""')) {
    if (ch === "{") depth += 1;
    if (ch === "}") depth -= 1;
    if (depth < 0) break;
  }
  if (depth !== 0) throw cannotParse(fileName);
  const result = newResult();
  for (const call of code.matchAll(CALL)) {
    const coordinate = COORDINATE.exec(call[1] ?? call[2]);
    if (coordinate) record(result, `${coordinate[1]}:${coordinate[2]}`);
  }
  return result;
}

function extractCatalog(text, fileName) {
  const result = newResult();
  for (const { segments, entries } of tomlSections(text, fileName)) {
    if (segments.join(".") !== "libraries") continue;
    for (const { value } of entries) {
      if (value.startsWith("{")) {
        const group = /(?:^|[{,\s])group\s*=\s*["']([^"']+)["']/.exec(value);
        const name = /(?:^|[{,\s])name\s*=\s*["']([^"']+)["']/.exec(value);
        const coordinate =
          /(?:^|[{,\s])module\s*=\s*["']([^"':]+:[^"':]+)["']/.exec(value);
        if (coordinate) record(result, coordinate[1]);
        else if (group && name) record(result, `${group[1]}:${name[1]}`);
      } else {
        const coordinate = COORDINATE.exec(unquote(value));
        if (coordinate) record(result, `${coordinate[1]}:${coordinate[2]}`);
      }
    }
  }
  return result;
}

export function extract(text, fileName = "build.gradle") {
  return fileName === "libs.versions.toml"
    ? extractCatalog(text, fileName)
    : extractBuildScript(text, fileName);
}
