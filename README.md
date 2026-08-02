# System Task — MCP plugin for Claude Code

Run your projects and your team from a conversation: see how each project is doing, who is
overloaded, **who has nothing assigned**, and register work in a shape people can actually execute
and verify.

**[System Task](https://system-task.defaltm.com)** is a task and project app for small teams —
web, Android and Windows. This plugin connects it to Claude Code.

---

## Install

In Claude Code:

```
/plugin marketplace add luis1amaral/system-task-mcp
```

```
/plugin install system-task
```

Claude will ask for an **access token**. Generate one in the System Task app under
**Settings → Agent access**, tap *Connect Claude Code*, and paste it. The token is stored in your
system keychain — never in a project file, never in your shell history.

Don't have an account yet? Create one at **[system-task.defaltm.com](https://system-task.defaltm.com)**.

---

## What the token can and cannot do

The agent token is **not a second login**. The server only accepts it on a closed list of routes:
read reports, search, create and edit tasks, comment, move. It **deletes nothing**, cannot touch
your account, cannot see billing and cannot mint another token.

If it ever leaks, you revoke it in two taps on the same screen — and the "last used" column tells
you whether it is still plugged into some machine.

---

## Tools

**Read**

| Tool | Answers |
|---|---|
| `systemtask_day_brief` | What is yours today, what is late, how much time that adds up to |
| `systemtask_projects_list` | Every project, with progress, overdue and unassigned counts |
| `systemtask_project_report` | One project: totals, board columns, created vs. completed |
| `systemtask_project_risks` | Overdue, undated, unassigned — oldest first |
| `systemtask_team_load` | Workload per person and **who has nothing assigned** |
| `systemtask_team_list` | Who is on the project |
| `systemtask_tasks_search` | Search by project, assignee, status, period |
| `systemtask_whoami` | Which account the token opens |

**Write**

| Tool | Does |
|---|---|
| `systemtask_demand_create` | Registers a **demand** (objective + deliverable + done-when) |
| `systemtask_task_create` | Creates a simple task of your own |
| `systemtask_task_update` | Complete, reschedule, reprioritise, estimate |
| `systemtask_task_assign` | Set or clear the assignee (one, or nobody) |
| `systemtask_task_move` | Move between projects (a recurring task moves its whole series) |
| `systemtask_task_comment` | Comment on a task (an `@user` notifies that person) |

---

## The demand format

`systemtask_demand_create` requires three things, and that is the point of the plugin:

- **objective** — what needs to exist (becomes the title);
- **deliverable** — what is concretely handed over;
- **doneWhen** — a criterion **another person can verify without asking anyone**.

The *how* is never prescribed: the method belongs to whoever does the work. Subtasks only when the
demand has genuinely independent deliverables — the default is not to split.

That discipline is what stops a task from sitting open for two months because nobody can assert it
is finished.

---

## Example prompts

> "How are my projects doing?"
> "In The City, who has nothing assigned?"
> "Create a demand for João: ship the pricing page, done when /pricing returns 200 with the 3 plans, due Friday"
> "What do I have today?"
> "Show me what's overdue in the Vendas project"

---

## Development

```bash
npm install
npm run build
node scripts/smoke.mjs                              # protocol only (no token)
SYSTEM_TASK_TOKEN=stk_... node scripts/smoke.mjs    # + read tools against the API
```

`scripts/smoke.mjs` speaks JSON-RPC to the built binary over stdin/stdout, exactly like an MCP
client — including a check that **nothing but the protocol** is written to `stdout` (the number one
failure in stdio servers: one `console.log` corrupts the channel).

`dist/` is committed on purpose: installing a plugin copies the folder and does not run
`npm install`. When releasing, run `npm run build` and bump `version` in
`.claude-plugin/plugin.json` — without the bump, nobody receives the update.

## License

MIT.
