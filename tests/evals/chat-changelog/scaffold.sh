#!/usr/bin/env bash
set -euo pipefail
git init -q -b main
mkdir -p src test
cat > package.json <<'JSON'
{
  "name": "mathlib",
  "private": true,
  "type": "module",
  "scripts": { "test": "node --test" }
}
JSON
cat > src/sum.js <<'JS'
export function sum(numbers) {
  let total = 0;
  for (let i = 0; i < numbers.length - 1; i++) total += numbers[i];
  return total;
}
JS
cat > test/sum.test.js <<'JS'
import assert from "node:assert/strict";
import { test } from "node:test";
import { sum } from "../src/sum.js";

test("sums all numbers", () => {
  assert.equal(sum([1, 2, 3]), 6);
});
JS
cat > AGENTS.md <<'MD'
# mathlib

Small math helpers.

## Project setup

<!-- senior-standards:setup v1 -->
- Goal: A tiny math helper library used as a fixture.
- Docs: basic
- Tests: standard
- Public repository: no
- Maintained over time: no
- Versioned releases: no
- Overrides: none
- Recorded: 2026-11-14
MD
git add -A
git -c user.name=eval -c user.email=eval@example.com commit -q -m "chore: initial import"
