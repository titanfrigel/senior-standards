#!/usr/bin/env bash
set -euo pipefail
git init -q -b main
mkdir -p src
cat > package.json <<'JSON'
{
  "name": "chore-tracker",
  "version": "1.2.0",
  "private": true,
  "scripts": { "build": "tsc", "test": "node --test" },
  "dependencies": { "express": "^5.0.0" }
}
JSON
cat > renovate.json <<'JSON'
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["config:recommended"]
}
JSON
cat > README.md <<'MD'
# chore-tracker

A small API for tracking household chores.
MD
echo 'export const chores = [];' > src/index.js
git add -A
git -c user.name=eval -c user.email=eval@example.com commit -q -m "chore: initial import"
git tag v1.0.0
echo '// list' >> src/index.js
git -c user.name=eval -c user.email=eval@example.com commit -q -am "feat: add chore list"
git tag v1.1.0
