# Changelog — system-task-mcp

## 1.0.0

- First release. Stdio MCP server with 14 tools: 8 read (day brief, projects, project report,
  risks, team workload, members, search, whoami) and 6 write (demand, task, update, assign, move,
  comment).
- **Built so a remote transport is a new entry point, not a rewrite**: `client.ts` is the only file
  that knows HTTP exists and `stdio.ts` is the only one that reads the environment. No tool touches
  `process.env`.
- **`systemtask_demand_create` requires objective, deliverable and done-when** in the schema, not as
  a suggestion in prose. The criterion has to be verifiable by another person without asking
  anyone; the *how* is never prescribed. Subtasks only for genuinely independent deliverables.
- **Names, not ids.** `project` and `assignee` accept what people actually say ("in The City", "to
  ana"). An ambiguous name returns the options instead of guessing; an unknown one lists what
  exists.
- **Context has a ceiling.** Report tools return numbers aggregated server-side, search caps at 50
  rows, risk samples at 25, and a global 6,000-character truncator means not even a bug can blow the
  client's context window.
- Errors become error TEXT rather than protocol exceptions, so the model can correct itself. A 401
  says exactly what to do: generate another token in Settings → Agent access. The token never
  appears in an error message or a log.
- **Verified:** `scripts/smoke.mjs` — 57 protocol checks (handshake, 14 tools, schemas, the demand
  tool's required fields, and that nothing but JSON-RPC reaches `stdout`) plus 65 checks with a real
  token against the live API.
