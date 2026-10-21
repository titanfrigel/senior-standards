import assert from "node:assert/strict";
import { test } from "node:test";
import * as ruby from "../../../core/manifests/ruby.mjs";

test("matches only Gemfile", () => {
  assert.equal(ruby.matches("Gemfile"), true);
  assert.equal(ruby.matches("Gemfile.lock"), false);
});

test("reads gem calls with single and double quotes", () => {
  const gemfile = `source "https://rubygems.org"
gemspec

gem "rails", "~> 7.1"
gem 'pg'
group :test do
  gem "rspec", require: false # comment
end
# gem "commented"
`;
  assert.deepEqual([...ruby.extract(gemfile).names].sort(), [
    "pg",
    "rails",
    "rspec",
  ]);
});

test("skips path gems; git and github gems are external", () => {
  const gemfile = `gem "local", path: "../local"
gem "old", :path => "../old"
gem "forked", git: "https://github.com/x/forked.git"
gem "hashrocket", :github => "x/hashrocket"
gem "gh", github: 'x/gh'
`;
  const result = ruby.extract(gemfile);
  assert.equal(result.names.size, 0);
  assert.equal(
    result.external.get("forked"),
    "https://github.com/x/forked.git",
  );
  assert.equal(result.external.get("hashrocket"), "x/hashrocket");
  assert.equal(result.external.get("gh"), "x/gh");
  assert.equal(result.external.has("local"), false);
});

test("accepts CRLF input", () => {
  assert.deepEqual([...ruby.extract('gem "a"\r\ngem "b"\r\n').names].sort(), [
    "a",
    "b",
  ]);
});

test("throws on a gem line with an unterminated name", () => {
  assert.throws(() => ruby.extract('gem "rails\n'), {
    message: "could not parse Gemfile",
  });
});
