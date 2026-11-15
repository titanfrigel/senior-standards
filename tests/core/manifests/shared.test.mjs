import assert from "node:assert/strict";
import { test } from "node:test";
import { stripXmlComments } from "../../../core/manifests/shared.mjs";

test("stripXmlComments removes comments", () => {
  assert.equal(stripXmlComments("a<!-- x -->b<!--\ny\n-->c"), "abc");
});

test("stripXmlComments leaves no comment opener after nested comments", () => {
  assert.equal(stripXmlComments("<!<!-- x -->-- hidden -->kept"), "kept");
});
