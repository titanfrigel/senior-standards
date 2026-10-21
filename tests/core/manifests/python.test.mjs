import assert from "node:assert/strict";
import { test } from "node:test";
import * as python from "../../../core/manifests/python.mjs";

const names = (text, fileName) =>
  [...python.extract(text, fileName).names].sort();

test("matches pyproject.toml, Pipfile and requirements*.txt", () => {
  for (const f of [
    "pyproject.toml",
    "Pipfile",
    "requirements.txt",
    "requirements-dev.txt",
    "requirements_test.txt",
  ]) {
    assert.equal(python.matches(f), true, f);
  }
  assert.equal(python.matches("dev-requirements.txt"), false);
  assert.equal(python.matches("Pipfile.lock"), false);
});

test("reads PEP 621 dependencies and optional-dependencies", () => {
  const toml = `[project]
name = "app"
requires-python = ">=3.11"
dependencies = [
  "Requests>=2.31",
  "typing_extensions; python_version < '3.12'",
  "httpx[http2]>=0.27",
]

[project.optional-dependencies]
docs = ["Sphinx"]
test = ["pytest>=8", "pytest-cov"]
`;
  assert.deepEqual(names(toml, "pyproject.toml"), [
    "httpx",
    "pytest",
    "pytest-cov",
    "requests",
    "sphinx",
    "typing-extensions",
  ]);
});

test("reads [dependency-groups], ignoring include-group tables", () => {
  const toml = `[dependency-groups]
dev = ["ruff", {include-group = "test"}]
test = ["pytest"]
`;
  assert.deepEqual(names(toml, "pyproject.toml"), ["pytest", "ruff"]);
});

test("reads poetry tables and excludes python", () => {
  const toml = `[tool.poetry.dependencies]
python = "^3.11"
Django = "^5"
local = { path = "../local" }
fork = { git = "https://github.com/x/fork.git" }

[tool.poetry.group.dev.dependencies]
black = "*"
`;
  const result = python.extract(toml, "pyproject.toml");
  assert.deepEqual([...result.names].sort(), ["black", "django"]);
  assert.equal(result.external.get("fork"), "https://github.com/x/fork.git");
});

test("a PEP 508 direct reference is external", () => {
  const toml =
    '[project]\ndependencies = ["pkg @ git+https://github.com/x/pkg"]\n';
  const result = python.extract(toml, "pyproject.toml");
  assert.equal(result.names.size, 0);
  assert.equal(result.external.get("pkg"), "git+https://github.com/x/pkg");
});

test("reads Pipfile packages and dev-packages", () => {
  const pipfile = `[packages]
Flask = "*"
local = {path = ".", editable = true}
fork = {git = "https://github.com/x/fork.git", ref = "main"}

[dev-packages]
pytest = ">=8"
`;
  const result = python.extract(pipfile, "Pipfile");
  assert.deepEqual([...result.names].sort(), ["flask", "pytest"]);
  assert.equal(result.external.get("fork"), "https://github.com/x/fork.git");
});

test("reads requirements lines, skipping comments, -r, -e and options", () => {
  const txt = [
    "# comment",
    "-r base.txt",
    "-e ./local",
    "--index-url https://example.com/simple",
    "",
    "Flask_Login==0.6  # trailing",
    "numpy>=1.26 ; python_version >= '3.9'",
    "pandas[all]==2 \\",
    "    --hash=sha256:abc",
    "./vendored",
    "git+https://github.com/x/tool.git#egg=Tool.Name",
    "named @ https://example.com/named.whl",
  ].join("\r\n");
  const result = python.extract(txt, "requirements.txt");
  assert.deepEqual([...result.names].sort(), [
    "flask-login",
    "numpy",
    "pandas",
  ]);
  assert.deepEqual([...result.external.keys()].sort(), ["named", "tool-name"]);
});

test("normalises names per PEP 503", () => {
  assert.deepEqual(names("My.Pkg__Name\nother-pkg\n", "requirements.txt"), [
    "my-pkg-name",
    "other-pkg",
  ]);
});

test("throws on an unterminated table header", () => {
  assert.throws(
    () => python.extract("[project\nname = 'x'\n", "pyproject.toml"),
    {
      message: "could not parse pyproject.toml",
    },
  );
});

test("throws on a requirements line without a package name", () => {
  assert.throws(() => python.extract("==1.0\n", "requirements.txt"), {
    message: "could not parse requirements.txt",
  });
});

test("multi-line strings elsewhere in pyproject.toml are skipped", () => {
  const toml = `[project]
description = """
A [tricky] description
= with brackets
"""
dependencies = ["requests"]

[tool.pytest.ini_options]
addopts = '''
-ra
[not a header]
'''
`;
  assert.deepEqual(names(toml, "pyproject.toml"), ["requests"]);
});
