// Decides pass or ask for a normalised tool call by comparing the
// dependencies it adds with packages approved in accepted ADRs.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { readApprovedPackages } from "./adr-index.mjs";
import { applyUpdate, parsePatch } from "./apply-patch.mjs";
import { findAttribution } from "./attribution.mjs";
import { addedDependencies, applyEdit } from "./diff-manifest.mjs";
import { findExtractor, isUnparsedManifest } from "./manifests/index.mjs";
import { parseInstall } from "./parse-install.mjs";
import { vcsTextOf } from "./parse-vcs-text.mjs";

const TAIL = "Run the decision gate first, or approve to proceed anyway.";

const ATTRIBUTION_HEAD = "Commit or PR text contains AI attribution";
const ATTRIBUTION_TAIL =
  "The user prefers no AI attribution; remove it, or approve to proceed anyway.";
const MAX_SHOWN_MATCHES = 5;
const ATTRIBUTION_ITEM = "ai-attribution";

const PYTHON_MANAGERS = new Set(["pip", "uv", "poetry", "pipx"]);
const NUGET_MANAGERS = new Set(["dotnet", "nuget"]);

function ecosystemOfManager(manager) {
  if (PYTHON_MANAGERS.has(manager)) return "python";
  if (NUGET_MANAGERS.has(manager)) return "dotnet";
  if (manager === "cargo") return "cargo";
  return "exact";
}

function matchKey(ecosystem, name) {
  if (ecosystem === "python") return name.toLowerCase().replace(/[-_.]+/g, "-");
  if (ecosystem === "dotnet") return name.toLowerCase();
  // crates.io treats - and _ in crate names as the same name.
  if (ecosystem === "cargo") return name.replaceAll("_", "-");
  return name;
}

function isApproved(approved, ecosystem, name) {
  const key = matchKey(ecosystem, name);
  for (const entry of approved) {
    if (matchKey(ecosystem, entry) === key) return true;
  }
  return false;
}

async function readIfExists(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") return null;
    throw error;
  }
}

function resolvePath(projectDir, filePath) {
  return path.isAbsolute(filePath)
    ? filePath
    : path.resolve(projectDir, filePath);
}

function baseName(filePath) {
  return filePath.split(/[\\/]/).pop();
}

function emptyFindings() {
  return { dependencies: [], tools: [], external: [], notes: [] };
}

function addDiff(findings, extractor, before, after) {
  const { packages, external } = addedDependencies(extractor, before, after);
  for (const name of packages) {
    findings.dependencies.push({ name, ecosystem: extractor.id });
  }
  findings.external.push(...external);
}

function fromShell(command) {
  const findings = emptyFindings();
  for (const install of parseInstall(command)) {
    const ecosystem = ecosystemOfManager(install.manager);
    const bucket =
      install.kind === "tool" ? findings.tools : findings.dependencies;
    for (const name of install.packages) bucket.push({ name, ecosystem });
    findings.external.push(...install.external);
  }
  return findings;
}

async function fromWriteOrEdit(call, projectDir) {
  const findings = emptyFindings();
  const extractor = findExtractor(call.filePath);
  if (!extractor) {
    if (isUnparsedManifest(call.filePath)) {
      findings.notes.push(unparsedNote(call.filePath));
    }
    return findings;
  }
  const before = await readIfExists(resolvePath(projectDir, call.filePath));
  let after;
  if (call.kind === "write") after = call.content;
  else {
    after = applyEdit(
      before ?? "",
      call.oldString,
      call.newString,
      call.replaceAll,
    );
  }
  addDiff(findings, extractor, before, after);
  return findings;
}

function unparsedNote(filePath) {
  return `Edit to ${baseName(filePath)} may change dependencies (this manifest type is not parsed). Confirm it matches an accepted ADR.`;
}

function unapplicableNote(filePath) {
  return `Patch modifies ${baseName(filePath)}; confirm any dependency change matches an accepted ADR.`;
}

async function fromPatch(patchText, projectDir) {
  const findings = emptyFindings();
  const sections = parsePatch(patchText);
  for (const section of sections) {
    if (section.op === "delete") continue;
    const target = section.moveTo ?? section.path;
    const extractor = findExtractor(target);
    if (!extractor) {
      if (isUnparsedManifest(target)) {
        findings.notes.push(unparsedNote(target));
      }
      continue;
    }
    if (section.op === "add") {
      const after = section.lines
        .filter((line) => line.startsWith("+"))
        .map((line) => line.slice(1))
        .join("\n");
      addDiff(findings, extractor, null, after);
      continue;
    }
    const updates = sections.filter(
      (other) => other.op === "update" && other.path === section.path,
    );
    let after = null;
    let before = null;
    if (updates.length === 1) {
      before = await readIfExists(resolvePath(projectDir, target));
      const source = section.moveTo
        ? await readIfExists(resolvePath(projectDir, section.path))
        : before;
      if (source !== null) {
        try {
          after = applyUpdate(source, section.lines);
        } catch {
          after = null;
        }
      }
    }
    if (after === null) findings.notes.push(unapplicableNote(target));
    else addDiff(findings, extractor, before, after);
  }
  return findings;
}

function gather(call, projectDir) {
  switch (call.kind) {
    case "shell":
      return fromShell(call.command);
    case "write":
    case "edit":
      return fromWriteOrEdit(call, projectDir);
    case "patch":
      return fromPatch(call.patchText, projectDir);
    default:
      return emptyFindings();
  }
}

function uncovered(entries, approved) {
  const names = new Set();
  for (const { name, ecosystem } of entries) {
    if (!isApproved(approved, ecosystem, name)) names.add(name);
  }
  return [...names];
}

async function dependencyReason(call, projectDir) {
  const findings = await gather(call, projectDir);
  const nothing =
    findings.dependencies.length === 0 &&
    findings.tools.length === 0 &&
    findings.external.length === 0 &&
    findings.notes.length === 0;
  if (nothing) return null;

  const { approved, problems } = await readApprovedPackages(projectDir);
  const sentences = [];
  const missingDeps = uncovered(findings.dependencies, approved);
  if (missingDeps.length > 0) {
    sentences.push(
      `New dependency not covered by an accepted ADR: ${missingDeps.join(", ")}. ${TAIL}`,
    );
  }
  const missingTools = uncovered(findings.tools, approved);
  if (missingTools.length > 0) {
    sentences.push(
      `New tool install not covered by an accepted ADR: ${missingTools.join(", ")}. ${TAIL}`,
    );
  }
  if (findings.external.length > 0) {
    sentences.push(
      `New dependency from a non-registry source: ${[...new Set(findings.external)].join(", ")}. ${TAIL}`,
    );
  }
  sentences.push(...findings.notes);
  if (sentences.length === 0) return null;

  let reason = sentences.join(" ");
  if (problems.length > 0) reason += ` ADR issues: ${problems.join("; ")}.`;
  return reason;
}

/** Sentence for AI attribution in commit, tag, note, PR or issue text; null when clean. */
async function attributionReason(call, projectDir) {
  if (call.kind !== "shell") return null;
  const texts = await vcsTextOf(call.command, projectDir);
  const matches = [...new Set(texts.flatMap(findAttribution))];
  if (matches.length === 0) return null;
  const shown = matches.slice(0, MAX_SHOWN_MATCHES);
  if (matches.length > shown.length) {
    shown.push(`and ${matches.length - shown.length} more`);
  }
  return `${ATTRIBUTION_HEAD} (${shown.join("; ")}). ${ATTRIBUTION_TAIL}`;
}

async function decide(call, projectDir) {
  if (!call) return { decision: "pass" };
  const dependency = await dependencyReason(call, projectDir);
  const attribution = await attributionReason(call, projectDir);
  if (dependency === null && attribution === null) return { decision: "pass" };
  const reason = [dependency, attribution].filter(Boolean).join(" ");
  return attribution === null
    ? { decision: "ask", reason }
    : { decision: "ask", reason, items: [ATTRIBUTION_ITEM] };
}

/** Never throws: any internal error becomes an `ask`. */
export async function evaluate(call, projectDir) {
  try {
    return await decide(call, projectDir);
  } catch (error) {
    let reason = `senior-standards guard error: ${error?.message ?? String(error)}`;
    try {
      const { problems } = await readApprovedPackages(projectDir);
      if (problems.length > 0) reason += ` ADR issues: ${problems.join("; ")}.`;
    } catch {
      // best effort only
    }
    return { decision: "ask", reason };
  }
}
