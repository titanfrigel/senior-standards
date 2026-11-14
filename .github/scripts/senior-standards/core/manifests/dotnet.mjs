import {
  cannotParse,
  isObject,
  newResult,
  parseJsonObject,
  record,
} from "./shared.mjs";

export const id = "dotnet";

const PROJECT_FILE = /\.(csproj|fsproj|vbproj)$/;
const REFERENCE_OPEN = /<(?:PackageReference|PackageVersion)\b/g;
const REFERENCE_TAG = /<(?:PackageReference|PackageVersion)\b([^>]*)>/g;
const INCLUDE = /\bInclude\s*=\s*(?:"([^"]*)"|'([^']*)')/;

export function matches(fileName) {
  return (
    PROJECT_FILE.test(fileName) ||
    fileName === "Directory.Packages.props" ||
    fileName === "dotnet-tools.json"
  );
}

function extractTools(text, fileName) {
  const doc = parseJsonObject(text, fileName);
  const result = newResult();
  if (isObject(doc.tools)) {
    for (const name of Object.keys(doc.tools)) record(result, name);
  }
  return result;
}

export function extract(text, fileName = "project.csproj") {
  if (fileName === "dotnet-tools.json") return extractTools(text, fileName);
  const xml = text.replace(/<!--[\s\S]*?-->/g, "");
  const tags = [...xml.matchAll(REFERENCE_TAG)];
  if (tags.length !== [...xml.matchAll(REFERENCE_OPEN)].length) {
    throw cannotParse(fileName);
  }
  const result = newResult();
  for (const tag of tags) {
    const include = INCLUDE.exec(tag[1]);
    const name = include?.[1] ?? include?.[2];
    if (name) record(result, name);
  }
  return result;
}
