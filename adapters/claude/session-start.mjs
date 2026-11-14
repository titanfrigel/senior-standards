import { FALLBACK, loadStandards } from "../../core/load-standards.mjs";

let context;
try {
  context = loadStandards();
} catch {
  context = FALLBACK;
}

try {
  // Stdin and the reminder are best effort: any failure leaves the standards alone.
  const [{ setupReminder }, { readStdinJson }] = await Promise.all([
    import("../../core/setup-record.mjs"),
    import("./io.mjs"),
  ]);
  const input = await readStdinJson();
  const dir = process.env.CLAUDE_PROJECT_DIR || input?.cwd;
  const reminder = dir ? await setupReminder(dir) : null;
  if (reminder) context = `${context}\n\n${reminder}`;
} catch {
  // no reminder
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
