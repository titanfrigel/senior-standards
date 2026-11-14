import {
  FALLBACK,
  loadStandards,
  SUBAGENT_PATH,
} from "../../core/load-standards.mjs";

let context;
try {
  context = loadStandards(SUBAGENT_PATH);
} catch {
  context = FALLBACK;
}

try {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "SubagentStart",
        additionalContext: context,
      },
    }),
  );
} catch {
  // nothing sensible left to do; never escape into the host
}
