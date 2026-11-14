import { cannotParse, newResult, record, splitLines } from "./shared.mjs";

export const id = "ruby";

const GEM = /^\s*gem\s*\(?\s*(?:"([^"]+)"|'([^']+)')(.*)$/;
const GIT =
  /(?::git\s*=>|\bgit:|:github\s*=>|\bgithub:)\s*(?:"([^"]+)"|'([^']+)')/;
const PATH = /(?::path\s*=>|\bpath:)/;

export function matches(fileName) {
  return fileName === "Gemfile";
}

export function extract(text, fileName = "Gemfile") {
  const result = newResult();
  for (const raw of splitLines(text)) {
    const line = raw.replace(/(^|\s)#.*$/, "");
    if (!/^\s*gem\b/.test(line)) continue;
    const gem = GEM.exec(line);
    if (!gem) throw cannotParse(fileName);
    const rest = gem[3];
    if (PATH.test(rest)) continue;
    const git = GIT.exec(rest);
    record(result, gem[1] ?? gem[2], git ? (git[1] ?? git[2]) : undefined);
  }
  return result;
}
