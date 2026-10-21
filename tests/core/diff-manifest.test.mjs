import assert from "node:assert/strict";
import { test } from "node:test";
import { addedDependencies, applyEdit } from "../../core/diff-manifest.mjs";
import { findExtractor } from "../../core/manifests/index.mjs";

const csproj = (framework, refs) => `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup><TargetFramework>${framework}</TargetFramework></PropertyGroup>
  <ItemGroup>
${refs.map(([n, v]) => `    <PackageReference Include="${n}" Version="${v}" />`).join("\n")}
  </ItemGroup>
</Project>`;

const pkg = (deps) => JSON.stringify({ dependencies: deps }, null, 2);

test("new file: every dependency is added", () => {
  const added = addedDependencies(
    findExtractor("package.json"),
    null,
    pkg({ b: "1", a: "1" }),
  );
  assert.deepEqual(added, { packages: ["a", "b"], external: [] });
});

test("version bump adds nothing", () => {
  const added = addedDependencies(
    findExtractor("package.json"),
    pkg({ a: "^1.0.0" }),
    pkg({ a: "^2.0.0" }),
  );
  assert.deepEqual(added, { packages: [], external: [] });
});

test("reordering adds nothing", () => {
  const added = addedDependencies(
    findExtractor("package.json"),
    pkg({ a: "1", b: "1" }),
    pkg({ b: "1", a: "1" }),
  );
  assert.deepEqual(added, { packages: [], external: [] });
});

test(".csproj edit that only changes TargetFramework adds nothing", () => {
  const refs = [["Serilog", "3.0.0"]];
  const added = addedDependencies(
    findExtractor("Api.csproj"),
    csproj("net8.0", refs),
    csproj("net9.0", refs),
  );
  assert.deepEqual(added, { packages: [], external: [] });
});

test("added PackageReference is reported", () => {
  const added = addedDependencies(
    findExtractor("Api.csproj"),
    csproj("net8.0", [["Serilog", "3.0.0"]]),
    csproj("net8.0", [
      ["Serilog", "3.0.0"],
      ["Dapper", "2.1.0"],
    ]),
  );
  assert.deepEqual(added, { packages: ["Dapper"], external: [] });
});

test("added Cargo dev-dependency is reported", () => {
  const before = '[dependencies]\nserde = "1"\n';
  const after = `${before}\n[dev-dependencies]\ninsta = "1"\n`;
  const added = addedDependencies(findExtractor("Cargo.toml"), before, after);
  assert.deepEqual(added, { packages: ["insta"], external: [] });
});

test("added external dependency is reported as name (source)", () => {
  const before = '[dependencies]\nserde = "1"\n';
  const after = `${before}fork = { git = "https://github.com/x/fork" }\n`;
  const added = addedDependencies(findExtractor("Cargo.toml"), before, after);
  assert.deepEqual(added, {
    packages: [],
    external: ["fork (https://github.com/x/fork)"],
  });
});

test("changing the ref of an existing external dependency adds nothing", () => {
  const dep = (ref) =>
    `[dependencies]\nfork = { git = "https://github.com/x/fork", rev = "${ref}" }\n`;
  const added = addedDependencies(
    findExtractor("Cargo.toml"),
    dep("a"),
    dep("b"),
  );
  assert.deepEqual(added, { packages: [], external: [] });
});

test("switching an external dependency to the registry adds nothing", () => {
  const added = addedDependencies(
    findExtractor("Cargo.toml"),
    '[dependencies]\nfork = { git = "https://github.com/x/fork" }\n',
    '[dependencies]\nfork = "1"\n',
  );
  assert.deepEqual(added, { packages: [], external: [] });
});

test("applyEdit replaces the first occurrence by default", () => {
  assert.equal(applyEdit("a b a", "a", "X"), "X b a");
});

test("applyEdit replaces every occurrence with replaceAll", () => {
  assert.equal(applyEdit("a b a", "a", "X", true), "X b X");
});

test("applyEdit does not interpret $ patterns in the replacement", () => {
  assert.equal(applyEdit("a", "a", "$&$1"), "$&$1");
});

test("applyEdit throws when the target is not found", () => {
  assert.throws(() => applyEdit("abc", "zzz", "X"), {
    message: "edit target not found",
  });
});

test("requirements-dev.txt resolves through findExtractor", () => {
  const added = addedDependencies(
    findExtractor("svc/requirements-dev.txt"),
    "flask\n",
    "flask\nNumPy>=1\n",
  );
  assert.deepEqual(added, { packages: ["numpy"], external: [] });
});

test("commented deno.jsonc resolves through findExtractor", () => {
  const doc = (extra) =>
    `{\n  // deps\n  "imports": {\n    "a": "jsr:a@1",${extra}\n  }\n}\n`;
  const added = addedDependencies(
    findExtractor("deno.jsonc"),
    doc(""),
    doc('\n    "b": "jsr:b@1",'),
  );
  assert.deepEqual(added, { packages: ["b"], external: [] });
});

test("gradle/libs.versions.toml reports an added [libraries] entry", () => {
  const before = '[libraries]\na = "g:a:1"\n';
  const after = `${before}b = { module = "g:b", version = "2" }\n`;
  const added = addedDependencies(
    findExtractor("gradle/libs.versions.toml"),
    before,
    after,
  );
  assert.deepEqual(added, { packages: ["g:b"], external: [] });
});

test(".config/dotnet-tools.json reports an added tool", () => {
  const doc = (tools) => JSON.stringify({ version: 1, tools });
  const added = addedDependencies(
    findExtractor(".config/dotnet-tools.json"),
    doc({ csharpier: { version: "1" } }),
    doc({ csharpier: { version: "1" }, "dotnet-ef": { version: "8" } }),
  );
  assert.deepEqual(added, { packages: ["dotnet-ef"], external: [] });
});

test("pointing an external dependency at another repository is reported", () => {
  const dep = (url) => `[dependencies]\nfoo = { git = "${url}" }\n`;
  const added = addedDependencies(
    findExtractor("Cargo.toml"),
    dep("https://good/foo"),
    dep("https://evil/foo"),
  );
  assert.deepEqual(added, {
    packages: [],
    external: ["foo (https://evil/foo)"],
  });
});

test("URL fragment and git+ ref changes are not source changes", () => {
  const ex = findExtractor("package.json");
  const dep = (spec) => pkg({ foo: spec });
  assert.deepEqual(
    addedDependencies(
      ex,
      dep("git+https://github.com/x/foo.git#v1"),
      dep("git+https://github.com/x/foo.git#v2"),
    ),
    { packages: [], external: [] },
  );
  const req = findExtractor("requirements.txt");
  assert.deepEqual(
    addedDependencies(
      req,
      "foo @ git+https://github.com/x/foo.git@v1\n",
      "foo @ git+https://github.com/x/foo.git@v2\n",
    ),
    { packages: [], external: [] },
  );
});

test("registry to external stays reported", () => {
  const added = addedDependencies(
    findExtractor("Cargo.toml"),
    '[dependencies]\nfoo = "1"\n',
    '[dependencies]\nfoo = { git = "https://x/foo" }\n',
  );
  assert.deepEqual(added.external, ["foo (https://x/foo)"]);
});

test("applyEdit matches LF strings against CRLF content and keeps CRLF", () => {
  const content = '{\r\n  "dependencies": {\r\n    "a": "1"\r\n  }\r\n}\r\n';
  assert.equal(
    applyEdit(content, '"a": "1"\n  }', '"a": "1",\n    "zod": "3"\n  }'),
    '{\r\n  "dependencies": {\r\n    "a": "1",\r\n    "zod": "3"\r\n  }\r\n}\r\n',
  );
});

test("applyEdit matches CRLF strings against LF content and keeps LF", () => {
  assert.equal(
    applyEdit("a\nb\na\nb\n", "a\r\nb", "X\r\nY", true),
    "X\nY\nX\nY\n",
  );
});

test("applyEdit still throws when neither EOL form matches", () => {
  assert.throws(() => applyEdit("a\r\nb\r\n", "a\nc", "X"), {
    message: "edit target not found",
  });
});
