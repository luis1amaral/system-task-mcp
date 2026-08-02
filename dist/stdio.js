#!/usr/bin/env node
/**
 * Local entry point, and the only file that reads the environment.
 *
 * HARD RULE: nothing in this process may write to `stdout` other than the protocol itself.
 * `stdout` IS the JSON-RPC channel — one debug `console.log` corrupts the first message and the
 * client disconnects with an error that points nowhere. Diagnostics go to `stderr`.
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { DEFAULT_API_URL, SystemTaskClient } from './client.js';
import { buildServer } from './server.js';
const token = (process.env.SYSTEM_TASK_TOKEN ?? '').trim();
const apiUrl = (process.env.SYSTEM_TASK_API_URL ?? DEFAULT_API_URL).trim().replace(/\/+$/, '');
if (!token) {
    console.error('system-task: falta o token de acesso.\n' +
        'Gere um no app System Task em Configurações → Acesso de agentes e informe em SYSTEM_TASK_TOKEN\n' +
        '(pelo plugin, o Claude Code pergunta e guarda para você).');
    process.exit(1);
}
if (!token.startsWith('stk_')) {
    console.error('system-task: esse token não parece ser do System Task (deve começar com "stk_").');
    process.exit(1);
}
const server = buildServer({ api: new SystemTaskClient(apiUrl, token) });
await server.connect(new StdioServerTransport());
console.error(`system-task: pronto (${apiUrl})`);
