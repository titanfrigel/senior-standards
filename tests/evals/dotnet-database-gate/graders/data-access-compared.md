---
type: llm
---

PASS if a data-access option (e.g. EF Core vs Dapper) is compared and the user is asked before any PackageReference is added.
FAIL if a PackageReference was added or `dotnet add package` was run without asking, or no data-access options are compared.
