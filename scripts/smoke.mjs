/**
 * Talks JSON-RPC to the real server over stdin/stdout, exactly like an MCP client would.
 * "It compiles" proves nothing about a protocol, and the most common failure in a stdio server —
 * something writing to stdout and corrupting the channel — only shows up here.
 *
 * Without SYSTEM_TASK_TOKEN it runs in PROTOCOL mode: handshake, tool list, schema checks.
 * With a token it also exercises the READ tools against the API (never the write ones — a smoke
 * test must not create work in somebody's account).
 *
 *   node scripts/smoke.mjs
 *   SYSTEM_TASK_TOKEN=stk_... node scripts/smoke.mjs
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const entry = join(root, 'dist', 'stdio.js');
const token = process.env.SYSTEM_TASK_TOKEN ?? '';
const apiUrl = process.env.SYSTEM_TASK_API_URL ?? 'https://system-api.defaltm.com';

let pass = 0;
const ok = (cond, label) => {
  if (!cond) {
    console.error(`x ${label}`);
    child.kill();
    process.exit(1);
  }
  console.log(`ok ${label}`);
  pass++;
};

// With no token the server exits 1 on purpose, so protocol mode feeds a well-formed dummy.
const child = spawn(process.execPath, [entry], {
  env: { ...process.env, SYSTEM_TASK_TOKEN: token || `stk_${'0'.repeat(64)}`, SYSTEM_TASK_API_URL: apiUrl },
  stdio: ['pipe', 'pipe', 'pipe'],
});

let buffer = '';
const pending = new Map();
child.stdout.on('data', (chunk) => {
  buffer += chunk.toString();
  let i;
  while ((i = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, i).trim();
    buffer = buffer.slice(i + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      // This is the test for failure #1: anything non-JSON on stdout breaks the channel.
      console.error(`x stdout emitted something that is NOT JSON-RPC: ${line.slice(0, 120)}`);
      child.kill();
      process.exit(1);
    }
    const p = pending.get(msg.id);
    if (p) {
      pending.delete(msg.id);
      p(msg);
    }
  }
});
child.stderr.on('data', (c) => process.env.VERBOSE && process.stderr.write(`[srv] ${c}`));

let nextId = 1;
function call(method, params) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout on ${method}`)), 20000);
    pending.set(id, (m) => {
      clearTimeout(timer);
      resolve(m);
    });
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
  });
}
function notify(method, params) {
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method, params })}\n`);
}

const init = await call('initialize', {
  protocolVersion: '2025-06-18',
  capabilities: {},
  clientInfo: { name: 'smoke', version: '1.0.0' },
});
ok(init.result?.serverInfo?.name === 'system-task', 'handshake: server identifies itself');
ok(typeof init.result?.instructions === 'string' && init.result.instructions.length > 40, 'ships usage instructions');
notify('notifications/initialized');

const listed = await call('tools/list', {});
const tools = listed.result?.tools ?? [];
ok(tools.length === 14, `lists 14 tools (got ${tools.length})`);

for (const t of tools) {
  ok(t.name.startsWith('systemtask_'), `${t.name}: product prefix`);
  ok((t.description ?? '').length > 40, `${t.name}: description a model can pick from`);
  ok(t.inputSchema?.type === 'object', `${t.name}: valid inputSchema`);
}
const names = tools.map((t) => t.name);
for (const required of [
  'systemtask_day_brief',
  'systemtask_projects_list',
  'systemtask_project_report',
  'systemtask_team_load',
  'systemtask_demand_create',
]) {
  ok(names.includes(required), `has ${required}`);
}

// The demand tool is the heart of the product: the three fields are REQUIRED by the schema, not a
// recommendation in prose that a model can ignore.
const demand = tools.find((t) => t.name === 'systemtask_demand_create');
for (const field of ['project', 'objective', 'deliverable', 'doneWhen']) {
  ok((demand.inputSchema.required ?? []).includes(field), `demand requires "${field}"`);
}

if (!token) {
  const r = await call('tools/call', { name: 'systemtask_whoami', arguments: {} });
  ok(r.result?.isError === true, 'invalid token becomes a tool error, not a crash');
  const text = r.result.content[0].text;
  ok(/revogad|expir|Configurações/i.test(text), 'the message says HOW to fix it');
  ok(!text.includes('stk_'), 'the error never echoes the token');
  console.log(`\n${pass} checks passed (protocol mode — no SYSTEM_TASK_TOKEN).`);
  child.kill();
  process.exit(0);
}

async function callTool(name, args = {}) {
  const r = await call('tools/call', { name, arguments: args });
  const text = r.result?.content?.[0]?.text ?? '';
  if (r.result?.isError) {
    console.error(`x ${name} returned an error: ${text}`);
    child.kill();
    process.exit(1);
  }
  return text;
}

ok(/Conectado como/.test(await callTool('systemtask_whoami')), 'whoami responds');
ok(/Seu dia/.test(await callTool('systemtask_day_brief')), 'day_brief responds');
const projects = await callTool('systemtask_projects_list');
ok(projects.length > 0, 'projects_list responds');
ok(projects.length <= 6000, 'the response respects the size ceiling');

const first = projects.match(/\(#(\d+)\)/);
if (first) {
  const id = first[1];
  ok(/##/.test(await callTool('systemtask_project_report', { project: id })), 'project_report responds');
  ok(/Riscos/.test(await callTool('systemtask_project_risks', { project: id })), 'project_risks responds');
  ok(/Equipe/.test(await callTool('systemtask_team_load', { project: id })), 'team_load responds');
  ok((await callTool('systemtask_team_list', { project: id })).length > 0, 'team_list responds');
  ok((await callTool('systemtask_tasks_search', { project: id, limit: 5 })).length > 0, 'tasks_search responds');

  const r = await call('tools/call', {
    name: 'systemtask_project_report',
    arguments: { project: 'projeto-que-nao-existe-xyz' },
  });
  ok(r.result?.isError === true, 'unknown project becomes a tool error');
  ok(/não achei o projeto/.test(r.result.content[0].text), 'and the error lists the projects that exist');
}

console.log(`\n${pass} checks passed against ${apiUrl}.`);
child.kill();
process.exit(0);
