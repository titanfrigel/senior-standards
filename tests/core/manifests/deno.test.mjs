import assert from "node:assert/strict";
import { test } from "node:test";
import * as deno from "../../../core/manifests/deno.mjs";

test("matches deno.json and deno.jsonc", () => {
  assert.equal(deno.matches("deno.json"), true);
  assert.equal(deno.matches("deno.jsonc"), true);
  assert.equal(deno.matches("deno.lock"), false);
});

test("reads imports keys, skipping local paths", () => {
  const text = JSON.stringify({
    imports: {
      "@std/assert": "jsr:@std/assert@^1",
      chalk: "npm:chalk@5",
      "@/": "./src/",
      util: "../util.ts",
    },
  });
  assert.deepEqual([...deno.extract(text).names].sort(), [
    "@std/assert",
    "chalk",
  ]);
});

test("URL imports are external", () => {
  const result = deno.extract(
    '{"imports": {"x": "https://deno.land/x/x@1/mod.ts"}}',
  );
  assert.equal(result.names.size, 0);
  assert.equal(result.external.get("x"), "https://deno.land/x/x@1/mod.ts");
});

test("strips comments and trailing commas for .jsonc", () => {
  const text = [
    "{",
    "  // a comment",
    '  "imports": {',
    '    "a": "jsr:a@1", /* block */',
    '    "url": "jsr:b@1//keep",',
    "  },",
    "}",
  ].join("\r\n");
  const result = deno.extract(text, "deno.jsonc");
  assert.deepEqual([...result.names].sort(), ["a", "url"]);
});

test("throws on invalid JSON", () => {
  assert.throws(() => deno.extract("{"), {
    message: "could not parse deno.json",
  });
  assert.throws(() => deno.extract("{", "deno.jsonc"), {
    message: "could not parse deno.jsonc",
  });
});
