import assert from "node:assert/strict";
import { test } from "node:test";
import * as cargo from "../../../core/manifests/cargo.mjs";

const names = (text) => [...cargo.extract(text).names].sort();

test("matches only Cargo.toml", () => {
  assert.equal(cargo.matches("Cargo.toml"), true);
  assert.equal(cargo.matches("cargo.toml"), false);
});

test("reads every dependency table", () => {
  const toml = `[package]
name = "app"

[dependencies]
serde = "1"
tokio = { version = "1", features = ["full"] }

[dev-dependencies]
insta = "1"

[build-dependencies]
cc = "1"

[workspace.dependencies]
anyhow = "1"

[target.'cfg(windows)'.dependencies]
winapi = "0.3"

[target.'cfg(target_os = "linux")'.build-dependencies]
pkg-config = "0.3"
`;
  assert.deepEqual(names(toml), [
    "anyhow",
    "cc",
    "insta",
    "pkg-config",
    "serde",
    "tokio",
    "winapi",
  ]);
});

test("reads dotted and sub-table forms", () => {
  const toml = `[dependencies]
a.version = "1"
a.features = ["x"]

[dependencies.serde]
version = "1"
features = [
  "derive",
]

[dev-dependencies.mockall]
version = "0.12"
`;
  assert.deepEqual(names(toml), ["a", "mockall", "serde"]);
});

test("skips path and workspace-inherited dependencies", () => {
  const toml = `[dependencies]
local = { path = "../local" }
shared = { workspace = true }
inherited.workspace = true
real = "1"

[dependencies.other]
path = "../other"
`;
  assert.deepEqual(names(toml), ["real"]);
});

test("git dependencies are external", () => {
  const toml = `[dependencies]
a = { git = "https://github.com/x/a", branch = "main" }

[dependencies.b]
git = "https://github.com/x/b"
`;
  const result = cargo.extract(toml);
  assert.equal(result.names.size, 0);
  assert.equal(result.external.get("a"), "https://github.com/x/a");
  assert.equal(result.external.get("b"), "https://github.com/x/b");
});

test("uses the real crate name when renamed with package", () => {
  assert.deepEqual(
    names('[dependencies]\nfoo = { package = "bar", version = "1" }\n'),
    ["bar"],
  );
});

test("ignores comments and unrelated tables", () => {
  const toml = `# serde = "1"
[features]
default = []
[dependencies]
serde = "1" # trailing
`;
  assert.deepEqual(names(toml), ["serde"]);
});

test("accepts CRLF input", () => {
  assert.deepEqual(
    names('[dependencies]\r\nserde = "1"\r\nlog = { version = "0.4" }\r\n'),
    ["log", "serde"],
  );
});

test("throws on an unterminated table header", () => {
  assert.throws(() => cargo.extract('[dependencies\nserde = "1"\n'), {
    message: "could not parse Cargo.toml",
  });
});

test("multi-line strings do not break parsing", () => {
  const toml = `[package]
description = """
Line one # not a comment
[dependencies]
fake = "1"
"""

[dependencies]
serde = "1"
`;
  assert.deepEqual(names(toml), ["serde"]);
});
