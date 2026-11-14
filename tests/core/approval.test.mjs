import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ecosystemOfManager,
  isApproved,
  matchKey,
} from "../../core/approval.mjs";

test("ecosystemOfManager groups managers that normalise names", () => {
  assert.equal(ecosystemOfManager("pip"), "python");
  assert.equal(ecosystemOfManager("uv"), "python");
  assert.equal(ecosystemOfManager("nuget"), "dotnet");
  assert.equal(ecosystemOfManager("cargo"), "cargo");
  assert.equal(ecosystemOfManager("npm"), "exact");
});

test("matchKey normalises per ecosystem", () => {
  assert.equal(matchKey("python", "Foo_Bar.baz"), "foo-bar-baz");
  assert.equal(matchKey("dotnet", "Newtonsoft.Json"), "newtonsoft.json");
  assert.equal(matchKey("cargo", "serde_json"), "serde-json");
  assert.equal(matchKey("npm", "Left_Pad"), "Left_Pad");
});

test("isApproved compares normalised names", () => {
  assert.equal(
    isApproved(new Set(["serde-json"]), "cargo", "serde_json"),
    true,
  );
  assert.equal(isApproved(new Set(["requests"]), "python", "Requests"), true);
  assert.equal(isApproved(new Set(["lodash"]), "npm", "Lodash"), false);
  assert.equal(isApproved(new Set(), "npm", "zod"), false);
});
