import type { ZodRawShape } from 'zod';
import type { SystemTaskClient } from './client.js';

/** Everything a tool gets. Note what is NOT here: env, argv, file paths. */
export interface Ctx {
  api: SystemTaskClient;
}

/**
 * `run` returns TEXT — that is what the model reads. No parallel `structuredContent`: duplicating
 * the same content as JSON doubles the context cost with nobody consuming it.
 */
export interface ToolDef {
  name: string;
  title: string;
  description: string;
  inputSchema: ZodRawShape;
  readOnly: boolean;
  run(ctx: Ctx, args: any): Promise<string>;
}
