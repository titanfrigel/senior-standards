import assert from "node:assert/strict";
import { test } from "node:test";
import * as go from "../../../core/manifests/go.mjs";

const names = (text) => [...go.extract(text).names].sort();

test("matches only go.mod", () => {
  assert.equal(go.matches("go.mod"), true);
  assert.equal(go.matches("go.sum"), false);
});

test("reads single-line and block requires", () => {
  const mod = `module example.com/app

go 1.22

require github.com/a/a v1.0.0

require (
	github.com/b/b v1.2.3
	// a comment
	golang.org/x/text v0.14.0
)
`;
  assert.deepEqual(names(mod), [
    "github.com/a/a",
    "github.com/b/b",
    "golang.org/x/text",
  ]);
});

test("skips indirect requirements", () => {
  const mod = `require (
	github.com/a/a v1.0.0
	github.com/b/b v1.0.0 // indirect
)
require github.com/c/c v1.0.0 // indirect
`;
  assert.deepEqual(names(mod), ["github.com/a/a"]);
});

test("does not read replace directives as dependencies", () => {
  assert.deepEqual(names("replace github.com/a/a => ../a\n"), []);
});

test("accepts CRLF input", () => {
  assert.deepEqual(names("require (\r\n\tgithub.com/a/a v1.0.0\r\n)\r\n"), [
    "github.com/a/a",
  ]);
});

test("throws on an unclosed require block", () => {
  assert.throws(() => go.extract("require (\n\tgithub.com/a/a v1.0.0\n"), {
    message: "could not parse go.mod",
  });
});
