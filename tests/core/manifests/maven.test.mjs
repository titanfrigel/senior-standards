import assert from "node:assert/strict";
import { test } from "node:test";
import * as maven from "../../../core/manifests/maven.mjs";

const names = (text) => [...maven.extract(text).names].sort();

test("matches only pom.xml", () => {
  assert.equal(maven.matches("pom.xml"), true);
  assert.equal(maven.matches("pom.xml.bak"), false);
});

test("reads dependencies as groupId:artifactId, ignoring parent and plugins", () => {
  const pom = `<project>
  <parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.2.0</version>
  </parent>
  <dependencyManagement>
    <dependencies>
      <dependency>
        <groupId>org.managed</groupId>
        <artifactId>managed</artifactId>
      </dependency>
    </dependencies>
  </dependencyManagement>
  <dependencies>
    <dependency>
      <groupId>com.google.guava</groupId>
      <artifactId>guava</artifactId>
      <version>33.0.0-jre</version>
      <exclusions>
        <exclusion>
          <groupId>excluded</groupId>
          <artifactId>excluded</artifactId>
        </exclusion>
      </exclusions>
    </dependency>
  </dependencies>
  <build>
    <plugins>
      <plugin>
        <groupId>org.apache.maven.plugins</groupId>
        <artifactId>maven-compiler-plugin</artifactId>
      </plugin>
    </plugins>
  </build>
</project>`;
  assert.deepEqual(names(pom), [
    "com.google.guava:guava",
    "org.managed:managed",
  ]);
});

test("skips sibling modules and system-scoped jars", () => {
  const pom = `<dependencies>
    <dependency><groupId>\${project.groupId}</groupId><artifactId>core</artifactId></dependency>
    <dependency><groupId>x</groupId><artifactId>y</artifactId><scope>system</scope></dependency>
    <dependency><groupId>a</groupId><artifactId>b</artifactId></dependency>
  </dependencies>`;
  assert.deepEqual(names(pom), ["a:b"]);
});

test("ignores commented-out dependencies", () => {
  const pom =
    "<dependencies><!-- <dependency><groupId>a</groupId><artifactId>b</artifactId></dependency> --></dependencies>";
  assert.deepEqual(names(pom), []);
});

test("accepts CRLF input", () => {
  const pom =
    "<dependencies>\r\n<dependency>\r\n<groupId>a</groupId>\r\n<artifactId>b</artifactId>\r\n</dependency>\r\n</dependencies>\r\n";
  assert.deepEqual(names(pom), ["a:b"]);
});

test("throws on an unclosed dependency element", () => {
  assert.throws(
    () => maven.extract("<dependencies><dependency><groupId>a</groupId>"),
    { message: "could not parse pom.xml" },
  );
});
