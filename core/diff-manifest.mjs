// Computes which dependencies an edit to a manifest adds.

function replace(content, oldString, newString, replaceAll) {
  if (oldString === "" || !content.includes(oldString)) return null;
  if (replaceAll) return content.split(oldString).join(newString);
  const index = content.indexOf(oldString);
  return (
    content.slice(0, index) +
    newString +
    content.slice(index + oldString.length)
  );
}

const toLf = (text) => text.replaceAll("\r\n", "\n");

/**
 * Applies an Edit-style replacement; throws when the target is absent. When the
 * exact text is not found, retries with CRLF and LF treated alike and keeps the
 * file's line endings.
 */
export function applyEdit(content, oldString, newString, replaceAll = false) {
  const exact = replace(content, oldString, newString, replaceAll);
  if (exact !== null) return exact;
  const normalised = replace(
    toLf(content),
    toLf(oldString),
    toLf(newString),
    replaceAll,
  );
  if (normalised === null) throw new Error("edit target not found");
  return content.includes("\r\n")
    ? normalised.replaceAll("\n", "\r\n")
    : normalised;
}

// A source without its ref: ref-only bumps are not a new source.
function sourceKey(source) {
  const noFragment = source.split("#")[0];
  return noFragment.startsWith("git+")
    ? noFragment.replace(/@[^/@]+$/, "")
    : noFragment;
}

/**
 * Names present after the edit and not before. External (git/URL) entries are
 * reported as "name (source)" when the name is new to the external set.
 */
export function addedDependencies(extractor, beforeText, afterText) {
  const after = extractor.extract(afterText);
  const before =
    beforeText === null
      ? { names: new Set(), external: new Map() }
      : extractor.extract(beforeText);
  const packages = [...after.names]
    .filter((name) => !before.names.has(name) && !before.external.has(name))
    .sort();
  const external = [...after.external]
    .filter(
      ([name, source]) =>
        !before.external.has(name) ||
        sourceKey(before.external.get(name)) !== sourceKey(source),
    )
    .map(([name, source]) => `${name} (${source})`)
    .sort();
  return { packages, external };
}
