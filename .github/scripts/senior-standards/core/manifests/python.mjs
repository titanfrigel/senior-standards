import { cannotParse, newResult, record, splitLines } from "./shared.mjs";
import {
  arrayStrings,
  readDependencySpec,
  tomlSections,
  unquote,
} from "./toml-lines.mjs";

export const id = "python";

const REQUIREMENTS = /^requirements.*\.txt$/;
const NAME = /^([A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?)/;

export function matches(fileName) {
  return (
    fileName === "pyproject.toml" ||
    fileName === "Pipfile" ||
    REQUIREMENTS.test(fileName)
  );
}

/** PEP 503 normalisation. */
function normalise(name) {
  return name.toLowerCase().replace(/[-_.]+/g, "-");
}

function add(result, name, source) {
  record(result, normalise(name), source);
}

/** Adds a PEP 508 requirement string such as `name[extra]>=1 ; marker`. */
function addRequirement(result, spec, fileName) {
  const named = NAME.exec(spec.trim());
  if (!named) throw cannotParse(fileName);
  const direct = /^\s*(?:\[[^\]]*\])?\s*@\s*(\S+)/.exec(
    spec.trim().slice(named[0].length),
  );
  add(result, named[1], direct?.[1]);
}

function addTable(result, entries, { skip } = {}) {
  for (const { key, value } of entries) {
    const name = unquote(key);
    if (skip?.(name)) continue;
    const spec = readDependencySpec(value);
    if (spec.internal) continue;
    add(result, name, spec.source ?? undefined);
  }
}

function extractToml(text, fileName) {
  const result = newResult();
  for (const { segments, entries } of tomlSections(text, fileName)) {
    const path = segments.join(".");
    if (path === "project") {
      for (const { key, value } of entries) {
        if (key !== "dependencies") continue;
        for (const spec of arrayStrings(value)) {
          addRequirement(result, spec, fileName);
        }
      }
    } else if (
      path === "project.optional-dependencies" ||
      path === "dependency-groups" ||
      path === "tool.uv"
    ) {
      for (const { key, value } of entries) {
        if (path === "tool.uv" && key !== "dev-dependencies") continue;
        for (const spec of arrayStrings(value)) {
          addRequirement(result, spec, fileName);
        }
      }
    } else if (
      path === "tool.poetry.dependencies" ||
      path === "tool.poetry.dev-dependencies" ||
      /^tool\.poetry\.group\.[^.]+\.dependencies$/.test(path)
    ) {
      addTable(result, entries, { skip: (n) => n.toLowerCase() === "python" });
    } else if (path === "packages" || path === "dev-packages") {
      addTable(result, entries);
    }
  }
  return result;
}

function extractRequirements(text, fileName) {
  const result = newResult();
  const joined = text.replace(/\\\r?\n/g, " ");
  for (const raw of splitLines(joined)) {
    const line = raw.replace(/(^|\s)#.*$/, "").trim();
    if (!line || line.startsWith("-")) continue;
    if (/^(\.{0,2}[\\/]|file:)/.test(line)) continue;
    if (/^(git\+|hg\+|svn\+|bzr\+|https?:)/.test(line)) {
      const egg = /[#&]egg=([^\s&]+)/.exec(line);
      add(result, egg ? egg[1] : line, line);
      continue;
    }
    addRequirement(result, line, fileName);
  }
  return result;
}

export function extract(text, fileName = "pyproject.toml") {
  return REQUIREMENTS.test(fileName)
    ? extractRequirements(text, fileName)
    : extractToml(text, fileName);
}
