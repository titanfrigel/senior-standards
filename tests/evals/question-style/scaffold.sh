#!/usr/bin/env bash
set -euo pipefail
git init -q -b main
mkdir -p src
cat > package.json <<'JSON'
{
  "name": "orders-api",
  "private": true,
  "type": "module",
  "scripts": { "start": "node src/server.js", "test": "node --test" }
}
JSON
cat > src/server.js <<'JS'
import { createServer } from "node:http";
import { listOrders } from "./orders.js";

createServer(async (req, res) => {
  if (req.url === "/orders") {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(await listOrders()));
    return;
  }
  res.statusCode = 404;
  res.end();
}).listen(3000);
JS
cat > src/orders.js <<'JS'
// Reads orders from a slow upstream service on every request.
export async function listOrders() {
  const response = await fetch("https://orders.internal.example/api/orders");
  return response.json();
}
JS
cat > AGENTS.md <<'MD'
# orders-api

Read-only API in front of the internal orders service.

## Project setup

<!-- senior-standards:setup v1 -->
- Goal: Serve the internal orders list to the web front end.
- Docs: basic
- Tests: standard
- Public repository: no
- Maintained over time: yes
- Versioned releases: no
- Overrides: none
- Recorded: 2026-11-14
MD
git add -A
git -c user.name=eval -c user.email=eval@example.com commit -q -m "chore: initial import"
