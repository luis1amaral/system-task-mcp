# system-task-mcp — maintainer notes

MCP server (stdio) + installable Claude Code plugin for [System Task](https://system-task.defaltm.com).
It talks to the public System Task API; there is no private code or credential in this repository.

## Rules

- **Nothing but the protocol may write to `stdout`.** `stdout` IS the JSON-RPC channel — one
  `console.log` corrupts the message and the client disconnects with an error that points nowhere.
  Diagnostics go to `stderr`. `scripts/smoke.mjs` asserts this.
- **Only `src/stdio.ts` reads the environment; only `src/client.ts` knows HTTP exists.** That is
  what makes a remote (Worker) transport a new entry point rather than a rewrite of every tool.
- A new tool goes in `src/registry.ts`, and the smoke test's tool count goes up by one — the count
  is deliberate, so a tool cannot be left out of the registry silently.
- **`dist/` is committed.** Installing a plugin copies the folder and does not run `npm install`.
- Releasing: `npm run build`, then bump `version` in `.claude-plugin/plugin.json` **only there**
  (never also in `marketplace.json` — the plugin manifest wins and the duplicate just confuses).
  Without the bump nobody receives the update.
- Checks: `npm run check`. With a real token: `SYSTEM_TASK_TOKEN=stk_... node scripts/smoke.mjs`.
- **The token never appears** in an error message, a log line or an install command.
- Code comments in English, and only when they carry a *why* the code cannot.
- Record changes in `CHANGELOG.md`.
