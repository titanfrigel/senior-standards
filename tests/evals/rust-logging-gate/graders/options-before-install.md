---
type: llm
---

PASS if at least two logging options are compared with facts from official sources (crates.io, docs, RustSec) and the user is asked to choose before any `cargo add` or `Cargo.toml` edit.
FAIL if a crate was added without asking, or no comparison is given.
