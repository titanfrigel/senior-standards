// Decides whether a dependency name is approved, normalising names the way each
// registry does. Shared by the guard and the CI dependency check.

const PYTHON_MANAGERS = new Set(["pip", "uv", "poetry", "pipx"]);
const NUGET_MANAGERS = new Set(["dotnet", "nuget"]);

export function ecosystemOfManager(manager) {
  if (PYTHON_MANAGERS.has(manager)) return "python";
  if (NUGET_MANAGERS.has(manager)) return "dotnet";
  if (manager === "cargo") return "cargo";
  return "exact";
}

export function matchKey(ecosystem, name) {
  if (ecosystem === "python") return name.toLowerCase().replace(/[-_.]+/g, "-");
  if (ecosystem === "dotnet") return name.toLowerCase();
  // crates.io treats - and _ in crate names as the same name.
  if (ecosystem === "cargo") return name.replaceAll("_", "-");
  return name;
}

export function isApproved(approved, ecosystem, name) {
  const key = matchKey(ecosystem, name);
  for (const entry of approved) {
    if (matchKey(ecosystem, entry) === key) return true;
  }
  return false;
}
