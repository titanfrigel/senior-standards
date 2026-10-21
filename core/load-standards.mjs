import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const FALLBACK =
  "senior-standards: standards file could not be loaded; follow the decision-gate skill before adding dependencies or services.";

const DEFAULT_PATH = fileURLToPath(new URL("./standards.md", import.meta.url));

const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/;

export function loadStandards(filePath = DEFAULT_PATH) {
  try {
    const text = readFileSync(filePath, "utf8").replace(/^﻿/, "");
    return text.replace(FRONTMATTER, "").trim();
  } catch {
    return FALLBACK;
  }
}
