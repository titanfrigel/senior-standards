#!/usr/bin/env bash
set -euo pipefail
git init -q -b main
git -c user.name=eval -c user.email=eval@example.com commit -q --allow-empty -m "chore: init"
