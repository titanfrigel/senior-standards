import assert from "node:assert/strict";
import { test } from "node:test";
import * as gradle from "../../../core/manifests/gradle.mjs";

const names = (text, fileName) =>
  [...gradle.extract(text, fileName).names].sort();

test("matches build scripts and the version catalog", () => {
  for (const f of ["build.gradle", "build.gradle.kts", "libs.versions.toml"]) {
    assert.equal(gradle.matches(f), true, f);
  }
  assert.equal(gradle.matches("settings.gradle"), false);
});

test("reads coordinate strings in dependency configurations (Groovy)", () => {
  const script = `plugins { id 'java' }
dependencies {
    implementation 'com.google.guava:guava:33.0.0-jre'
    api("org.apache.commons:commons-lang3:3.14.0")
    compileOnly "org.projectlombok:lombok:1.18.30"
    runtimeOnly 'org.postgresql:postgresql:42.7.1'
    testImplementation 'junit:junit:4.13.2'
    kapt "com.google.dagger:dagger-compiler:2.50"
    ksp("com.squareup.moshi:moshi-kotlin-codegen:1.15.0")
    implementation project(':core')
    // implementation 'commented:out:1'
}
`;
  assert.deepEqual(names(script, "build.gradle"), [
    "com.google.dagger:dagger-compiler",
    "com.google.guava:guava",
    "com.squareup.moshi:moshi-kotlin-codegen",
    "junit:junit",
    "org.apache.commons:commons-lang3",
    "org.postgresql:postgresql",
    "org.projectlombok:lombok",
  ]);
});

test("reads Kotlin DSL, including platform() and ignoring project()", () => {
  const script = `dependencies {
    implementation(platform("org.springframework.boot:spring-boot-dependencies:3.2.0"))
    implementation(project(":core"))
    testImplementation("io.kotest:kotest-runner-junit5:5.8.0")
}
`;
  assert.deepEqual(names(script, "build.gradle.kts"), [
    "io.kotest:kotest-runner-junit5",
    "org.springframework.boot:spring-boot-dependencies",
  ]);
});

test("reads [libraries] in libs.versions.toml", () => {
  const toml = `[versions]
guava = "33.0.0-jre"

[libraries]
guava = { module = "com.google.guava:guava", version.ref = "guava" }
okio = { group = "com.squareup.okio", name = "okio", version = "3.7.0" }
short = "org.example:short:1.0"

[plugins]
kotlin = { id = "org.jetbrains.kotlin.jvm", version = "1.9.22" }
`;
  assert.deepEqual(names(toml, "libs.versions.toml"), [
    "com.google.guava:guava",
    "com.squareup.okio:okio",
    "org.example:short",
  ]);
});

test("accepts CRLF input", () => {
  const script = "dependencies {\r\n    implementation 'a:b:1'\r\n}\r\n";
  assert.deepEqual(names(script, "build.gradle"), ["a:b"]);
  assert.deepEqual(
    names('[libraries]\r\nx = "a:b:1"\r\n', "libs.versions.toml"),
    ["a:b"],
  );
});

test("throws on unbalanced braces in a build script", () => {
  assert.throws(
    () =>
      gradle.extract(
        "dependencies {\n  implementation 'a:b:1'\n",
        "build.gradle",
      ),
    { message: "could not parse build.gradle" },
  );
});

test("throws on an unterminated catalog header", () => {
  assert.throws(() => gradle.extract("[libraries\n", "libs.versions.toml"), {
    message: "could not parse libs.versions.toml",
  });
});
