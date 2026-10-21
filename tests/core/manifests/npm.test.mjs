import assert from "node:assert/strict";
import { test } from "node:test";
import * as npm from "../../../core/manifests/npm.mjs";

const names = (text) => [...npm.extract(text).names].sort();

test("matches only package.json", () => {
  assert.equal(npm.matches("package.json"), true);
  assert.equal(npm.matches("package.json.bak"), false);
});

test("reads the four dependency sections", () => {
  const text = JSON.stringify({
    name: "app",
    dependencies: { a: "^1" },
    devDependencies: { b: "^2" },
    peerDependencies: { c: "*" },
    optionalDependencies: { d: "1.0.0" },
  });
  assert.deepEqual(names(text), ["a", "b", "c", "d"]);
});

test("skips workspace, file and link references", () => {
  const text = JSON.stringify({
    dependencies: { a: "workspace:*", b: "file:../b", c: "link:../c", d: "1" },
  });
  assert.deepEqual(names(text), ["d"]);
});

test("git, github and http specs are external, not names", () => {
  const text = JSON.stringify({
    dependencies: {
      a: "git+https://github.com/x/a.git",
      b: "github:x/b",
      c: "https://example.com/c.tgz",
      d: "x/d#main",
      e: "1",
    },
  });
  const result = npm.extract(text);
  assert.deepEqual([...result.names], ["e"]);
  assert.deepEqual([...result.external.keys()].sort(), ["a", "b", "c", "d"]);
  assert.equal(result.external.get("b"), "github:x/b");
});

test("accepts CRLF input", () => {
  assert.deepEqual(
    names('{\r\n  "dependencies": {\r\n    "a": "1"\r\n  }\r\n}\r\n'),
    ["a"],
  );
});

test("throws on invalid JSON", () => {
  assert.throws(() => npm.extract("{ nope"), {
    message: "could not parse package.json",
  });
});
