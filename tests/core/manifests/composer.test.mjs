import assert from "node:assert/strict";
import { test } from "node:test";
import * as composer from "../../../core/manifests/composer.mjs";

test("matches only composer.json", () => {
  assert.equal(composer.matches("composer.json"), true);
  assert.equal(composer.matches("composer.lock"), false);
});

test("reads require and require-dev, excluding php and ext-*", () => {
  const text = JSON.stringify({
    require: { php: ">=8.2", "ext-json": "*", "vendor/a": "^1" },
    "require-dev": { "vendor/b": "^2" },
  });
  assert.deepEqual([...composer.extract(text).names].sort(), [
    "vendor/a",
    "vendor/b",
  ]);
  assert.equal(composer.extract(text).external.size, 0);
});

test("accepts CRLF input", () => {
  const text = '{\r\n  "require": {\r\n    "vendor/a": "^1"\r\n  }\r\n}\r\n';
  assert.deepEqual([...composer.extract(text).names], ["vendor/a"]);
});

test("throws on invalid JSON", () => {
  assert.throws(() => composer.extract("[1,"), {
    message: "could not parse composer.json",
  });
});
