#!/usr/bin/env bash
set -euo pipefail
git init -q -b main
cat > package.json <<'JSON'
{
  "name": "notes-app",
  "private": true,
  "scripts": { "dev": "next dev", "build": "next build" },
  "dependencies": { "next": "^16.0.0", "react": "^19.0.0", "react-dom": "^19.0.0" }
}
JSON
cat > AGENTS.md <<'MD'
# notes-app

A small notes app.
MD
git add -A
git -c user.name=eval -c user.email=eval@example.com commit -q -m "chore: initial import"
