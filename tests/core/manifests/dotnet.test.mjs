import assert from "node:assert/strict";
import { test } from "node:test";
import * as dotnet from "../../../core/manifests/dotnet.mjs";

const names = (text, fileName) =>
  [...dotnet.extract(text, fileName).names].sort();

test("matches project files, Directory.Packages.props and dotnet-tools.json", () => {
  for (const f of [
    "Api.csproj",
    "Lib.fsproj",
    "Old.vbproj",
    "Directory.Packages.props",
    "dotnet-tools.json",
  ]) {
    assert.equal(dotnet.matches(f), true, f);
  }
  assert.equal(dotnet.matches("Directory.Build.props"), false);
  assert.equal(dotnet.matches("Api.csproj.user"), false);
});

test("reads PackageReference in either attribute order, ignoring Update", () => {
  const xml = `<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <PackageReference Include="Serilog" Version="3.0.0" />
    <PackageReference Version="1.0" Include="Dapper"/>
    <PackageReference Update="Ignored" Version="2.0" />
    <PackageReference Include='Quoted'>
      <PrivateAssets>all</PrivateAssets>
    </PackageReference>
    <ProjectReference Include="..\\Other\\Other.csproj" />
  </ItemGroup>
</Project>`;
  assert.deepEqual(names(xml, "Api.csproj"), ["Dapper", "Quoted", "Serilog"]);
});

test("reads PackageVersion from Directory.Packages.props", () => {
  const xml = `<Project><ItemGroup>
    <PackageVersion Include="Polly" Version="8.0.0" />
  </ItemGroup></Project>`;
  assert.deepEqual(names(xml, "Directory.Packages.props"), ["Polly"]);
});

test("ignores commented-out references", () => {
  const xml = '<Project><!-- <PackageReference Include="Old" /> --></Project>';
  assert.deepEqual(names(xml, "Api.csproj"), []);
});

test("reads tools keys from dotnet-tools.json", () => {
  const json = JSON.stringify({
    version: 1,
    tools: { "dotnet-ef": { version: "8.0.0" }, csharpier: { version: "1" } },
  });
  assert.deepEqual(names(json, "dotnet-tools.json"), [
    "csharpier",
    "dotnet-ef",
  ]);
});

test("accepts CRLF input", () => {
  const xml =
    '<Project>\r\n<ItemGroup>\r\n<PackageReference\r\n  Include="A"\r\n  Version="1" />\r\n</ItemGroup>\r\n</Project>\r\n';
  assert.deepEqual(names(xml, "Api.csproj"), ["A"]);
});

test("throws on an unterminated PackageReference tag", () => {
  assert.throws(
    () =>
      dotnet.extract('<Project><PackageReference Include="A"', "Api.csproj"),
    { message: "could not parse Api.csproj" },
  );
});

test("throws on invalid dotnet-tools.json", () => {
  assert.throws(() => dotnet.extract("{", "dotnet-tools.json"), {
    message: "could not parse dotnet-tools.json",
  });
});
