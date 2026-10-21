import assert from "node:assert/strict";
import { test } from "node:test";
import {
  EXTRACTORS,
  findExtractor,
  isUnparsedManifest,
} from "../../../core/manifests/index.mjs";

test("every extractor has an id, matches and extract", () => {
  assert.equal(EXTRACTORS.length, 11);
  for (const e of EXTRACTORS) {
    assert.equal(typeof e.id, "string");
    assert.equal(typeof e.matches, "function");
    assert.equal(typeof e.extract, "function");
  }
});

test("findExtractor works on the basename with either separator", () => {
  assert.equal(findExtractor("C:\\src\\Api\\Api.csproj").id, "dotnet");
  assert.equal(findExtractor("web/package.json").id, "npm");
  assert.equal(findExtractor("deno.jsonc").id, "deno");
  assert.equal(findExtractor("svc/requirements-dev.txt").id, "python");
  assert.equal(findExtractor("a/.config/dotnet-tools.json").id, "dotnet");
});

test("findExtractor returns null for non-manifests", () => {
  assert.equal(findExtractor("package.json.bak"), null);
  assert.equal(findExtractor("src/index.js"), null);
});

test("isUnparsedManifest recognises manifests we cannot read", () => {
  for (const f of [
    "Package.swift",
    "app/mix.exs",
    "build.sbt",
    "Podfile",
    "vcpkg.json",
    "conanfile.txt",
    "conanfile.py",
    "lib\\CMakeLists.txt",
  ]) {
    assert.equal(isUnparsedManifest(f), true, f);
  }
  assert.equal(isUnparsedManifest("package.json"), false);
  assert.equal(isUnparsedManifest("Podfile.lock"), false);
});

test("findExtractor binds the extractor to the real file name", () => {
  assert.throws(
    () => findExtractor("a/requirements-dev.txt").extract("==1\n"),
    {
      message: "could not parse requirements-dev.txt",
    },
  );
  assert.throws(() => findExtractor("deno.jsonc").extract("{"), {
    message: "could not parse deno.jsonc",
  });
});
