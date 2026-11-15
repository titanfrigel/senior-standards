// Read-only Git queries for the project flow. Every query resolves null on any
// error, timeout or empty output, so callers never need a try/catch.

import { execFile as nodeExecFile } from "node:child_process";

/** Creates a reader; `execFile` is injectable for tests. */
export function createGitReader({
  timeoutMs = 2000,
  execFile = nodeExecFile,
} = {}) {
  function run(dir, args) {
    return new Promise((resolve) => {
      let settled = false;
      let timer;
      const done = (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      };
      timer = setTimeout(() => done(null), timeoutMs);
      try {
        execFile(
          "git",
          args,
          { cwd: dir, timeout: timeoutMs, windowsHide: true },
          (error, stdout) => {
            if (error) return done(null);
            const text = String(stdout ?? "").trim();
            done(text === "" ? null : text);
          },
        );
      } catch {
        done(null);
      }
    });
  }

  return {
    topLevel: (dir) => run(dir, ["rev-parse", "--show-toplevel"]),
    defaultBranch: (dir) => run(dir, ["config", "--get", "init.defaultBranch"]),
    currentBranch: (dir) => run(dir, ["rev-parse", "--abbrev-ref", "HEAD"]),
  };
}
