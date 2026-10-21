// Core modules are imported inside the try, so a module that fails to load
// still yields an `ask` instead of a crashed hook.

function ask(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "ask",
        permissionDecisionReason: reason,
      },
    }),
  );
}

try {
  const [{ evaluate }, { normalize }, { readStdinJson }] = await Promise.all([
    import("../../core/evaluate.mjs"),
    import("../../core/normalize.mjs"),
    import("./io.mjs"),
  ]);
  const input = await readStdinJson();
  const call = normalize("claude", input.tool_name, input.tool_input);
  const projectDir = process.env.CLAUDE_PROJECT_DIR || input.cwd;
  const result = await evaluate(call, projectDir);
  if (result.decision === "ask") ask(result.reason);
} catch (error) {
  ask(
    `senior-standards guard error: ${error?.message ?? String(error)}. Confirm this tool call manually.`,
  );
}
