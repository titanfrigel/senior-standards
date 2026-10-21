#!/usr/bin/env bash
set -euo pipefail
mkdir -p src
cat > Cargo.toml <<'TOML'
[package]
name = "demo-cli"
version = "0.1.0"
edition = "2024"

[dependencies]
TOML
cat > src/main.rs <<'RS'
fn main() {
    println!("hello");
}
RS
