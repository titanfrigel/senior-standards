import * as cargo from "./cargo.mjs";
import * as composer from "./composer.mjs";
import * as dart from "./dart.mjs";
import * as deno from "./deno.mjs";
import * as dotnet from "./dotnet.mjs";
import * as go from "./go.mjs";
import * as gradle from "./gradle.mjs";
import * as maven from "./maven.mjs";
import * as npm from "./npm.mjs";
import * as python from "./python.mjs";
import * as ruby from "./ruby.mjs";

export const EXTRACTORS = [
  npm,
  deno,
  dotnet,
  cargo,
  go,
  python,
  maven,
  gradle,
  ruby,
  dart,
  composer,
];

/** Manifests we recognise but cannot read; edits to them always ask. */
export const UNPARSED_MANIFESTS = [
  "Package.swift",
  "mix.exs",
  "build.sbt",
  "Podfile",
  "vcpkg.json",
];

function baseName(filePath) {
  return filePath.split(/[\\/]/).pop();
}

export function findExtractor(filePath) {
  const fileName = baseName(filePath);
  const family = EXTRACTORS.find((extractor) => extractor.matches(fileName));
  if (!family) return null;
  return {
    id: family.id,
    matches: family.matches,
    extract: (text) => family.extract(text, fileName),
  };
}

export function isUnparsedManifest(filePath) {
  const fileName = baseName(filePath);
  return (
    UNPARSED_MANIFESTS.includes(fileName) ||
    fileName.startsWith("conanfile.") ||
    fileName === "CMakeLists.txt"
  );
}
