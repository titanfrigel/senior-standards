#!/usr/bin/env bash
set -euo pipefail
mkdir -p app
cat > package.json <<'JSON'
{
  "name": "demo-web",
  "private": true,
  "scripts": { "dev": "next dev", "build": "next build" },
  "dependencies": { "next": "^16.0.0", "react": "^19.0.0", "react-dom": "^19.0.0" }
}
JSON
cat > app/page.tsx <<'TSX'
export default function Home() {
  return <main>Hello</main>;
}
TSX
mkdir -p docs/adr
cat > docs/adr/0001-use-better-auth.md <<'MD'
---
status: accepted
date: 2026-10-21
packages: [better-auth]
---

# Use Better Auth for authentication

## Context and problem

The app needs email and password authentication with sessions.

## Decision outcome

Chosen: better-auth. It is framework-agnostic, TypeScript-first and self-hosted.

## Consequences

Session and user tables live in our own database.
MD
cat > .mcp.json <<'JSON'
{ "mcpServers": {} }
JSON
cat > opencode.json <<'JSON'
{ "$schema": "https://opencode.ai/config.json" }
JSON
