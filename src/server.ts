// Builds the McpServer from the registry. No I/O here: where the token comes from is decided by
// the entry point (stdio.ts), not by this file nor by any tool.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ApiError } from './client.js';
import { truncate } from './format.js';
import { TOOLS } from './registry.js';
import type { Ctx } from './types.js';

export const SERVER_NAME = 'system-task';
export const SERVER_VERSION = '1.0.0';

export function buildServer(ctx: Ctx): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      instructions:
        'System Task — gestão de tarefas, projetos e equipe. Comece por systemtask_day_brief (o seu ' +
        'dia) ou systemtask_projects_list (como estão os projetos). Para saber COMO um projeto está, ' +
        'use os relatórios: eles devolvem números já somados no servidor, e não gastam contexto ' +
        'listando tarefa por tarefa. Ao registrar trabalho para outra pessoa, use ' +
        'systemtask_demand_create — ele exige objetivo, entrega e um critério de pronto verificável.',
    },
  );

  for (const tool of TOOLS) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: {
          title: tool.title,
          readOnlyHint: tool.readOnly,
          // Nothing here deletes: the agent token has no DELETE permission at all.
          destructiveHint: false,
          openWorldHint: true,
        },
      },
      async (args: any) => {
        try {
          return { content: [{ type: 'text' as const, text: truncate(await tool.run(ctx, args ?? {})) }] };
        } catch (e) {
          // Errors become error TEXT, not a protocol exception: the model has to READ what happened
          // to fix it (ambiguous project name, person not on the list, revoked token).
          const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e);
          return { content: [{ type: 'text' as const, text: `Não deu: ${msg}` }], isError: true };
        }
      },
    );
  }

  return server;
}
