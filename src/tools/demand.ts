// The three required fields (objective, deliverable, done-when) are enforced by the SCHEMA, not by
// a recommendation in the description a model can skip. Without a criterion someone else can
// verify, a demand stays open for months because nobody can assert it is finished.
import { z } from 'zod';
import { fmtDate } from '../format.js';
import type { ToolDef } from '../types.js';

export const demandCreate: ToolDef = {
  name: 'systemtask_demand_create',
  title: 'Criar uma demanda (trabalho para alguém)',
  description: [
    'Registra uma DEMANDA num projeto, no formato que a equipe consegue executar e conferir.',
    '',
    'Diga o que precisa EXISTIR, não COMO fazer — o método é de quem executa. Nunca prescreva',
    'passo a passo técnico.',
    '',
    '"doneWhen" é obrigatório e precisa ser verificável por OUTRA pessoa sem perguntar nada a',
    'ninguém: um número, um arquivo, um link, um estado observável. "Ficar bom" e "estar revisado"',
    'não servem. Se o pedido vier vago demais para escrever esse critério, PERGUNTE ao usuário em',
    'vez de inventar um.',
    '',
    'Use "subtasks" APENAS quando a demanda tiver entregas independentes, que poderiam ser feitas',
    'por pessoas diferentes. O padrão é não quebrar — subtarefa desnecessária é ruído.',
  ].join('\n'),
  inputSchema: {
    project: z.string().describe('Nome ou id do projeto onde a demanda entra.'),
    objective: z
      .string()
      .min(1)
      .max(180)
      .describe('O que precisa existir, em uma linha. Vira o título da tarefa.'),
    deliverable: z.string().min(1).max(600).describe('O que é entregue concretamente (artefato, mudança, resultado).'),
    doneWhen: z
      .string()
      .min(1)
      .max(600)
      .describe('Critério MENSURÁVEL de conclusão, verificável por outra pessoa sem perguntar nada.'),
    assignee: z.string().optional().describe('Nome de usuário ou id de quem assume. Sem isto, a demanda nasce sem dono.'),
    due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Quando vence, YYYY-MM-DD.'),
    priority: z.enum(['low', 'med', 'high']).optional(),
    estimateMin: z.number().int().min(0).max(1440).optional().describe('Estimativa em minutos.'),
    context: z.string().max(800).optional().describe('Por que isto existe / de onde veio. Opcional.'),
    subtasks: z
      .array(z.string().min(1).max(300))
      .max(10)
      .optional()
      .describe('Só se houver entregas INDEPENDENTES. O padrão é omitir.'),
  },
  readOnly: false,
  async run({ api }, a) {
    const project = await api.resolveProject(a.project);

    let assigneeUserId: number | null = null;
    let who = 'ninguém ainda';
    if (a.assignee) {
      const m = await api.resolveMember(project.id, a.assignee);
      assigneeUserId = m.userId;
      who = `@${m.username}`;
    }

    const description = [
      `Objetivo: ${a.objective}`,
      `Entrega: ${a.deliverable}`,
      `Pronto quando: ${a.doneWhen}`,
      ...(a.context ? ['', `Contexto: ${a.context}`] : []),
    ].join('\n');

    const r = await api.post<{ task: any }>('/api/tasks', {
      title: a.objective,
      description: description.slice(0, 2000),
      categoryId: project.id,
      date: a.due ?? null,
      priority: a.priority ?? null,
      durationMin: a.estimateMin ?? null,
      assigneeUserId,
    });
    const id = r.task.id as number;

    let steps = 0;
    for (const s of a.subtasks ?? []) {
      await api.post(`/api/tasks/${id}/steps`, { description: s, orderIndex: steps });
      steps++;
    }

    return [
      `Demanda **#${id}** registrada em **${project.name}**.`,
      '',
      `- Objetivo: ${a.objective}`,
      `- Entrega: ${a.deliverable}`,
      `- Pronto quando: ${a.doneWhen}`,
      `- Responsável: ${who}`,
      `- Prazo: ${a.due ? fmtDate(a.due) : 'sem data'}${a.priority ? ` · prioridade ${a.priority}` : ''}`,
      ...(steps > 0 ? [`- ${steps} subtarefa(s) criadas`] : []),
    ].join('\n');
  },
};
