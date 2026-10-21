import assert from "node:assert/strict";
import { test } from "node:test";
import * as dart from "../../../core/manifests/dart.mjs";

test("matches only pubspec.yaml", () => {
  assert.equal(dart.matches("pubspec.yaml"), true);
  assert.equal(dart.matches("pubspec.lock"), false);
});

test("reads dependencies and dev_dependencies, skipping sdk and path", () => {
  const yaml = `name: app
environment:
  sdk: ^3.2.0
dependencies:
  flutter:
    sdk: flutter
  http: ^1.2.0
  intl: any # comment
  local_pkg:
    path: ../local_pkg
  hosted_pkg:
    hosted: https://pub.example.com
    version: ^1.0.0
dev_dependencies:
  flutter_test:
    sdk: flutter
  lints: ^3.0.0
dependency_overrides:
  overridden: ^1.0.0
`;
  const result = dart.extract(yaml);
  assert.deepEqual([...result.names].sort(), [
    "hosted_pkg",
    "http",
    "intl",
    "lints",
  ]);
});

test("git dependencies are external", () => {
  const yaml = `dependencies:
  a:
    git:
      url: https://github.com/x/a.git
      ref: main
  b:
    git: https://github.com/x/b.git
  c: {git: {url: "https://github.com/x/c.git"}}
`;
  const result = dart.extract(yaml);
  assert.equal(result.names.size, 0);
  assert.equal(result.external.get("a"), "https://github.com/x/a.git");
  assert.equal(result.external.get("b"), "https://github.com/x/b.git");
  assert.ok(result.external.has("c"));
});

test("accepts CRLF input", () => {
  const yaml =
    "dependencies:\r\n  http: ^1.0.0\r\n  path_pkg:\r\n    path: ../p\r\n";
  assert.deepEqual([...dart.extract(yaml).names], ["http"]);
});

test("throws on a malformed dependency entry", () => {
  assert.throws(() => dart.extract("dependencies:\n  http ^1.0.0\n"), {
    message: "could not parse pubspec.yaml",
  });
});

test("a git dependency with a subdirectory path is external, not internal", () => {
  const yaml = `dependencies:
  foo:
    git:
      url: https://github.com/x/mono.git
      path: packages/foo
  bar:
    git: {url: "https://github.com/x/bar.git", path: pkgs/bar}
`;
  const result = dart.extract(yaml);
  assert.equal(result.names.size, 0);
  assert.equal(result.external.get("foo"), "https://github.com/x/mono.git");
  assert.equal(result.external.get("bar"), "https://github.com/x/bar.git");
});
