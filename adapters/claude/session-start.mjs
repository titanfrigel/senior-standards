import { FALLBACK, loadStandards } from "../../core/load-standards.mjs";

let context;
try {
  context = loadStandards();
} catch {
  context = FALLBACK;
}

try {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: context,
      },
    }),
  );
} catch {
  // nothing sensible left to do; never escape into the host
}
