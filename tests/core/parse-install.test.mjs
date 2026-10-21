import assert from "node:assert/strict";
import { test } from "node:test";
import { parseInstall, splitCommand } from "../../core/parse-install.mjs";

const e = (manager, kind, packages, external = []) => ({
  manager,
  kind,
  packages,
  external,
});
const dep = (manager, packages, external) =>
  e(manager, "dependency", packages, external);
const tool = (manager, packages, external) =>
  e(manager, "tool", packages, external);

const cases = [
  ["npm install zod", [dep("npm", ["zod"])]],
  ["npm i -D vitest @types/node@^22", [dep("npm", ["vitest", "@types/node"])]],
  ["npm install --save-exact zod@3.23.8", [dep("npm", ["zod"])]],
  ["npm i -g typescript", [tool("npm", ["typescript"])]],
  ["pnpm add -D @biomejs/biome", [dep("pnpm", ["@biomejs/biome"])]],
  ["pnpm --filter web add zod", [dep("pnpm", ["zod"])]],
  ["yarn add react react-dom", [dep("yarn", ["react", "react-dom"])]],
  ["bun add hono", [dep("bun", ["hono"])]],
  ["deno add jsr:@std/path", [dep("deno", ["jsr:@std/path"])]],
  [
    "deno add npm:chalk@5.3.0 jsr:@std/path@1.0.0",
    [dep("deno", ["npm:chalk", "jsr:@std/path"])],
  ],
  ["cd web && pnpm add zod", [dep("pnpm", ["zod"])]],
  ["FOO=1 npm i -D vitest", [dep("npm", ["vitest"])]],
  ["dotnet add package Serilog --version 4.0.0", [dep("dotnet", ["Serilog"])]],
  ["dotnet add src/Api/Api.csproj package Npgsql", [dep("dotnet", ["Npgsql"])]],
  ["dotnet add reference ../Core/Core.csproj", []],
  ["dotnet tool install -g dotnet-ef", [tool("dotnet", ["dotnet-ef"])]],
  ["dotnet tool install dotnet-ef", [tool("dotnet", ["dotnet-ef"])]],
  ["cargo add serde --features derive", [dep("cargo", ["serde"])]],
  ["cargo add tokio@1 -F full --dev", [dep("cargo", ["tokio"])]],
  ["cargo add --path ../core", []],
  ["cargo install cargo-deny --locked", [tool("cargo", ["cargo-deny"])]],
  [
    'pip install "requests[socks]>=2" flask==3.0',
    [dep("pip", ["requests", "flask"])],
  ],
  ["pip install -r requirements.txt", []],
  ["pip install -e .", []],
  ["uv add httpx", [dep("uv", ["httpx"])]],
  ["poetry add httpx --group dev", [dep("poetry", ["httpx"])]],
  ["uv tool install ruff", [tool("uv", ["ruff"])]],
  ["pipx install black", [tool("pipx", ["black"])]],
  [
    "go get github.com/gin-gonic/gin@v1.10.0",
    [dep("go", ["github.com/gin-gonic/gin"])],
  ],
  [
    "go install golang.org/x/vuln/cmd/govulncheck@latest",
    [tool("go", ["golang.org/x/vuln/cmd/govulncheck"])],
  ],
  ["go install ./cmd/app", []],
  ["composer require laravel/sanctum", [dep("composer", ["laravel/sanctum"])]],
  ["bundle add rails", [dep("bundle", ["rails"])]],
  ["gem install bundler", [tool("gem", ["bundler"])]],
  ["dart pub add http", [dep("dart", ["http"])]],
  ["flutter pub add provider", [dep("flutter", ["provider"])]],
  ["npm i github:user/repo", [dep("npm", [], ["github:user/repo"])]],
  [
    "cargo add --git https://github.com/a/b",
    [dep("cargo", [], ["https://github.com/a/b"])],
  ],
  ["pnpm add ./packages/ui", []],
  ["npm install", []],
  ["pnpm install", []],
  ["npm ci", []],
  ["dotnet restore", []],
  ["cargo build", []],
  ["go mod download", []],
  ["npx create-next-app@latest", []],
  ["pnpm dlx x", []],
  ["bunx x", []],
  ["uvx ruff", []],
  ["dotnet tool run x", []],
  ["npm uninstall zod", []],
  ["cargo remove serde", []],
  ["dotnet remove package X", []],
  ['echo "npm install zod"', []],
  [
    "npm install zod; cargo add serde",
    [dep("npm", ["zod"]), dep("cargo", ["serde"])],
  ],
  // extras beyond the brief table
  ["yarn workspace web add zod", [dep("yarn", ["zod"])]],
  ["pnpm add -w zod", [dep("pnpm", ["zod"])]],
  ["npm i -w web zod", [dep("npm", ["zod"])]],
  [
    "npm i https://example.com/pkg.tgz",
    [dep("npm", [], ["https://example.com/pkg.tgz"])],
  ],
  [
    "composer global require phpstan/phpstan",
    [tool("composer", ["phpstan/phpstan"])],
  ],
  ["pnpm add file:../x link:../y workspace:*", []],
  ["npm i zod 2>&1", [dep("npm", ["zod"])]],
  ["npm i zod > /dev/null", [dep("npm", ["zod"])]],
  ["npm i zod >out.txt 2>&1", [dep("npm", ["zod"])]],
  ["npm i zod &> /dev/null", [dep("npm", ["zod"])]],
  ["npm i zod # hi", [dep("npm", ["zod"])]],
  ["npm i a & npm i b", [dep("npm", ["a"]), dep("npm", ["b"])]],
  ["npm i a && npm i b", [dep("npm", ["a"]), dep("npm", ["b"])]],
  ["sudo npm i -g x", [tool("npm", ["x"])]],
  ["sudo -E npm i -g x", [tool("npm", ["x"])]],
  ["env FOO=1 time npm i x", [dep("npm", ["x"])]],
  ["python -m pip install requests==2", [dep("pip", ["requests"])]],
  ["py -m pip install -r requirements.txt", []],
  ["python3 -m pipx install black", [tool("pipx", ["black"])]],
  // executable paths and Windows shims
  ["npm.cmd install zod", [dep("npm", ["zod"])]],
  ["/usr/bin/npm i zod", [dep("npm", ["zod"])]],
  ["./node_modules/.bin/pnpm add zod", [dep("pnpm", ["zod"])]],
  ['"C:/Program Files/nodejs/npm.cmd" install zod', [dep("npm", ["zod"])]],
  ["C:/nodejs/npm.CMD i zod", [dep("npm", ["zod"])]],
  ['"C:\\Program Files\\nodejs\\npm.cmd" install zod', [dep("npm", ["zod"])]],
  ["C:\\nodejs\\npm.cmd i zod", [dep("npm", ["zod"])]],
  ["& 'C:\\nodejs\\npm.cmd' i zod", [dep("npm", ["zod"])]],
  ["pnpm.exe add zod", [dep("pnpm", ["zod"])]],
  ["yarn.ps1 add zod", [dep("yarn", ["zod"])]],
  ["bun.bat add zod", [dep("bun", ["zod"])]],
  ["dotnet.exe add package Serilog", [dep("dotnet", ["Serilog"])]],
  ["/usr/bin/env npm i zod", [dep("npm", ["zod"])]],
  // Python launchers and interpreter flags
  ["py -3 -m pip install requests", [dep("pip", ["requests"])]],
  ["py -3.12 -m pip install requests", [dep("pip", ["requests"])]],
  ["python3.12 -m pip install requests", [dep("pip", ["requests"])]],
  ["python -I -u -m pip install requests", [dep("pip", ["requests"])]],
  ["python -X utf8 -m pip install requests", [dep("pip", ["requests"])]],
  ["python.exe -m pip install requests", [dep("pip", ["requests"])]],
  ['python -c "import pip" -m pip install x', []],
  // corepack
  ["corepack pnpm add zod", [dep("pnpm", ["zod"])]],
  ["corepack yarn add zod", [dep("yarn", ["zod"])]],
  ["corepack enable", []],
  // leading global flags
  ["npm --prefix web install zod", [dep("npm", ["zod"])]],
  ["npm --loglevel silent i zod", [dep("npm", ["zod"])]],
  ["npm i --loglevel warn zod", [dep("npm", ["zod"])]],
  ["npm -g install typescript", [tool("npm", ["typescript"])]],
  ["yarn --cwd web add zod", [dep("yarn", ["zod"])]],
  ["yarn --cwd web global add typescript", [tool("yarn", ["typescript"])]],
  ["bun --cwd web add hono", [dep("bun", ["hono"])]],
  // value flags
  [
    "go install -o bin/ golang.org/x/tools/gopls@latest",
    [tool("go", ["golang.org/x/tools/gopls"])],
  ],
  [
    'go install -ldflags "-s -w" -tags netgo example.com/tool@v1',
    [tool("go", ["example.com/tool"])],
  ],
  [
    "dotnet tool install --tool-path tools dotnet-ef",
    [tool("dotnet", ["dotnet-ef"])],
  ],
];

for (const [command, expected] of cases) {
  test(`parseInstall: ${command}`, () => {
    assert.deepStrictEqual(parseInstall(command), expected);
  });
}

test("splitCommand: splits outside quotes only", () => {
  assert.deepStrictEqual(splitCommand('a && "b && c" ; d'), [
    "a",
    '"b && c"',
    "d",
  ]);
});

test("splitCommand: handles ||, |, newlines and drops empties", () => {
  assert.deepStrictEqual(splitCommand("a || b | c\n\n d ;; e"), [
    "a",
    "b",
    "c",
    "d",
    "e",
  ]);
});

test("splitCommand: single quotes protect separators", () => {
  assert.deepStrictEqual(splitCommand("echo 'a; b' && c"), [
    "echo 'a; b'",
    "c",
  ]);
});
