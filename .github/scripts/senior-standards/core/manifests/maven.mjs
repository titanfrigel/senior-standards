import { cannotParse, newResult, record } from "./shared.mjs";

export const id = "maven";

const OWN_GROUP = new Set(["${project.groupId}", "${pom.groupId}"]);

export function matches(fileName) {
  return fileName === "pom.xml";
}

function child(block, tag) {
  const m = new RegExp(`<${tag}>\\s*([^<]*?)\\s*</${tag}>`).exec(block);
  return m ? m[1] : null;
}

export function extract(text, fileName = "pom.xml") {
  const xml = text.replace(/<!--[\s\S]*?-->/g, "");
  const opened = [...xml.matchAll(/<dependency>/g)].length;
  const blocks = [...xml.matchAll(/<dependency>([\s\S]*?)<\/dependency>/g)];
  if (opened !== blocks.length) throw cannotParse(fileName);
  const result = newResult();
  for (const [, body] of blocks) {
    const block = body.replace(/<exclusions>[\s\S]*?<\/exclusions>/g, "");
    const group = child(block, "groupId");
    const artifact = child(block, "artifactId");
    if (!group || !artifact || OWN_GROUP.has(group)) continue;
    if (child(block, "scope") === "system") continue;
    record(result, `${group}:${artifact}`);
  }
  return result;
}
