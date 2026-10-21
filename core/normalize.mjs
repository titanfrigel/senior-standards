// Maps tool calls from each harness onto one shape that core/evaluate.mjs reads.
// Adding a harness or a tool is one row in a table below.

// OpenCode v2 field names, observed on a real v2.1.2 build (ADR 0003); this is
// the only place they are spelled out.
export const OPENCODE_FIELDS = {
  shell: { command: "command" },
  write: { filePath: "path", content: "content" },
  edit: {
    filePath: "path",
    oldString: "oldString",
    newString: "newString",
    replaceAll: "replaceAll",
  },
  patch: { patchText: "patchText" },
};

const OPENCODE_KINDS = {
  shell: "shell",
  write: "write",
  edit: "edit",
  patch: "patch",
};

const CLAUDE_FIELDS = {
  Bash: { command: "command" },
  PowerShell: { command: "command" },
  Write: { filePath: "file_path", content: "content" },
  Edit: {
    filePath: "file_path",
    oldString: "old_string",
    newString: "new_string",
    replaceAll: "replace_all",
  },
};

const CLAUDE_KINDS = {
  Bash: "shell",
  PowerShell: "shell",
  Write: "write",
  Edit: "edit",
};

// Target fields that are booleans, mapped to their default when absent.
const BOOLEAN_DEFAULTS = { replaceAll: false };

const HARNESSES = {
  claude: { fields: CLAUDE_FIELDS, kinds: CLAUDE_KINDS },
  opencode: { fields: OPENCODE_FIELDS, kinds: OPENCODE_KINDS },
};

/**
 * Normalises a tool call from a harness. Returns null for unknown tools,
 * unknown harnesses, non-object input, or missing or mistyped fields.
 * Never throws.
 */
export function normalize(harness, tool, input) {
  if (!Object.hasOwn(HARNESSES, harness)) return null;
  const { fields, kinds } = HARNESSES[harness];
  if (!Object.hasOwn(fields, tool)) return null;
  if (input === null || typeof input !== "object") return null;

  const result = { kind: kinds[tool] };
  for (const [target, source] of Object.entries(fields[tool])) {
    const value = input[source];
    if (Object.hasOwn(BOOLEAN_DEFAULTS, target)) {
      if (value === undefined) {
        result[target] = BOOLEAN_DEFAULTS[target];
      } else if (typeof value === "boolean") {
        result[target] = value;
      } else {
        return null;
      }
      continue;
    }
    if (typeof value !== "string") return null;
    result[target] = value;
  }
  return result;
}
