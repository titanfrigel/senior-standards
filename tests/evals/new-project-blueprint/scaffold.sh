#!/usr/bin/env bash
set -euo pipefail
mkdir -p docs/specs
cat > docs/specs/2026-10-21-team-notes-design.md <<'MD'
# Team notes: design

Status: approved

## Goal

A web app where small teams write and share Markdown notes.

## Scope

- Users sign up and sign in with email and password; teams invite members by email.
- Notes belong to a team; members create, edit and search them.
- Next.js web app, deployed to a managed host.

## Out of scope

Real-time co-editing, mobile apps, billing.
MD
