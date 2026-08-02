// `tasks_search` is the only tool returning rows, hence the only one with a row cap. The write
// tools confirm what was recorded, so the agent can say "done, it's #412" rather than "I think
// it saved".
import { z } from 'zod';
import { cut, fmtDate, fmtMin, table } from '../format.js';
import type { ToolDef } from '../types.js';

const vDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'use YYYY-MM-DD');

export const tasksSearch: ToolDef = {
  name: 'systemtask_tasks_search',
  title: 'Buscar tarefas',
  description:
    'Lista tarefas filtrando por projeto, responsável, situação e período. Para saber COMO um ' +
    'projeto está, prefira systemtask_project_report (devolve números, não linhas); use esta ' +
    'quando precisar das tarefas em si, para citar ou editar.',
  inputSchema: {
    project: z.string().optional().describe('Nome ou id do projeto. Sem isto, busca em tudo que você enxerga.'),
    assignee: z.string().optional().describe('Nome de usuário ou id de quem é responsável. Exige "project".'),
    unassigned: z.boolean().optional().describe('true = só as que não têm responsável.'),
    completed: z.boolean().optional().describe('false = só abertas, true = só concluídas. Sem isto, as duas.'),
    from: vDate.optional().describe('Só tarefas com data a partir de (YYYY-MM-DD).'),
    to: vDate.optional().describe('Só tarefas com data até (YYYY-MM-DD).'),
    limit: z.number().int().min(1).max(50).optional().describe('Quantas linhas (padrão 25, máximo 50).'),
  },
  readOnly: true,
  async run({ api }, a) {
    const params: string[] = [];
    let projectName: string | null = null;
    let categoryId: number | null = null;
    if (a.project) {
      const p = await api.resolveProject(a.project);
      categoryId = p.id;
      projectName = p.name;
      params.push(`categoryId=${p.id}`);
    }
    if (a.assignee) {
      if (categoryId == null) {
        return 'Para filtrar por responsável eu preciso do projeto — o nome de usuário é resolvido dentro da lista. Informe "project".';
      }
      const m = await api.resolveMember(categoryId, a.assignee);
      params.push(`assigneeUserId=${m.userId}`);
    }
    if (a.unassigned) params.push('unassigned=1');
    if (a.completed !== undefined) params.push(`completed=${a.completed ? 1 : 0}`);
    if (a.from) params.push(`from=${a.from}`);
    if (a.to) params.push(`to=${a.to}`);
    const limit = Math.min(a.limit ?? 25, 50);
    params.push(`limit=${limit}`);

    const r = await api.get<{ tasks: any[] }>(`/api/tasks?${params.join('&')}`);
    if (r.tasks.length === 0) return 'Nenhuma tarefa com esses filtros.';

    // Assignee names only resolve inside a list; with no project, fall back to the id.
    const names = new Map<number, string>();
    if (categoryId != null) for (const m of await api.members(categoryId)) names.set(m.userId, m.username);

    const rows = r.tasks.map((t) => [
      `#${t.id}`,
      cut(t.title, 44),
      fmtDate(t.date),
      t.assigneeUserId ? `@${names.get(t.assigneeUserId) ?? t.assigneeUserId}` : '',
      t.priority ?? '',
      fmtMin(t.durationMin),
      t.completed ? '✓' : '',
    ]);
    const header = projectName ? `**${projectName}** — ${r.tasks.length} tarefa(s)` : `${r.tasks.length} tarefa(s)`;
    const notice = r.tasks.length === limit ? `\n\n_(veio o máximo de ${limit}; refine os filtros para ver o resto)_` : '';
    return `${header}\n\n${table(['#', 'Tarefa', 'Vence', 'Responsável', 'Prior.', 'Estimado', 'OK'], rows)}${notice}`;
  },
};

export const taskCreate: ToolDef = {
  name: 'systemtask_task_create',
  title: 'Criar uma tarefa simples (sua)',
  description:
    'Cria uma tarefa SUA, sem responsável — um lembrete, uma anotação, algo que você mesmo vai ' +
    'fazer. Para trabalho que vai para OUTRA PESSOA, use systemtask_demand_create: demanda precisa ' +
    'de objetivo, entrega e critério de pronto, e esta tool não registra nada disso.',
  inputSchema: {
    title: z.string().min(1).max(200).describe('O que é, em uma linha.'),
    project: z.string().optional().describe('Nome ou id do projeto. Sem isto, a tarefa fica solta.'),
    due: vDate.optional().describe('Quando vence, YYYY-MM-DD. Sem data, vira backlog.'),
    priority: z.enum(['low', 'med', 'high']).optional(),
    estimateMin: z.number().int().min(0).max(1440).optional().describe('Estimativa em minutos.'),
    description: z.string().max(2000).optional(),
  },
  readOnly: false,
  async run({ api }, a) {
    const body: Record<string, unknown> = {
      title: a.title,
      date: a.due ?? null,
      priority: a.priority ?? null,
      durationMin: a.estimateMin ?? null,
      description: a.description ?? null,
    };
    let where = 'sem projeto';
    if (a.project) {
      const p = await api.resolveProject(a.project);
      body.categoryId = p.id;
      where = p.name;
    }
    const r = await api.post<{ task: any }>('/api/tasks', body);
    return `Criada a tarefa **#${r.task.id}** — "${r.task.title}" (${where}${a.due ? `, vence ${fmtDate(a.due)}` : ', sem data'}).`;
  },
};

export const taskUpdate: ToolDef = {
  name: 'systemtask_task_update',
  title: 'Concluir, adiar ou repriorizar uma tarefa',
  description:
    'Muda o que já existe: marcar concluída, mudar a data, a prioridade, a estimativa ou o título. ' +
    'Só manda o que muda. Para APAGAR uma tarefa, não dá por aqui — é pelo app (o token de agente ' +
    'não apaga nada, de propósito).',
  inputSchema: {
    task: z.number().int().min(1).describe('O id da tarefa (o número que aparece como #123).'),
    completed: z.boolean().optional().describe('true marca como feita; false reabre.'),
    due: vDate.optional().describe('Nova data, YYYY-MM-DD.'),
    title: z.string().min(1).max(200).optional(),
    priority: z.enum(['low', 'med', 'high']).optional(),
    estimateMin: z.number().int().min(0).max(1440).optional(),
    description: z.string().max(2000).optional(),
  },
  readOnly: false,
  async run({ api }, a) {
    const body: Record<string, unknown> = {};
    if (a.completed !== undefined) body.completed = a.completed;
    if (a.due !== undefined) body.date = a.due;
    if (a.title !== undefined) body.title = a.title;
    if (a.priority !== undefined) body.priority = a.priority;
    if (a.estimateMin !== undefined) body.durationMin = a.estimateMin;
    if (a.description !== undefined) body.description = a.description;
    if (Object.keys(body).length === 0) return 'Você não disse o que mudar na tarefa.';

    const r = await api.patch<{ task: any }>(`/api/tasks/${a.task}`, body);
    const t = r.task;
    const changed = Object.keys(body).join(', ');
    return `Tarefa **#${t.id}** atualizada (${changed}). Agora: "${cut(t.title, 60)}", ${t.completed ? 'concluída' : `aberta, vence ${fmtDate(t.date)}`}.`;
  },
};

export const taskAssign: ToolDef = {
  name: 'systemtask_task_assign',
  title: 'Definir (ou tirar) o responsável de uma tarefa',
  description:
    'UMA pessoa é responsável por uma tarefa, ou nenhuma — não existem dois. Marcar outra TROCA: ' +
    'a anterior sai. Para deixar sem responsável, mande assignee = null. A pessoa precisa ' +
    'participar do projeto da tarefa.',
  inputSchema: {
    task: z.number().int().min(1).describe('O id da tarefa.'),
    project: z.string().describe('Nome ou id do projeto da tarefa — é dentro dele que o nome de usuário é resolvido.'),
    assignee: z
      .string()
      .nullable()
      .describe('Nome de usuário ou id de quem assume. null (ou "ninguem") deixa a tarefa sem responsável.'),
  },
  readOnly: false,
  async run({ api }, a) {
    const project = await api.resolveProject(a.project);
    const clear = a.assignee == null || ['ninguem', 'ninguém', 'null', ''].includes(String(a.assignee).toLowerCase());
    if (clear) {
      await api.patch(`/api/tasks/${a.task}`, { assigneeUserId: null });
      return `Tarefa **#${a.task}** ficou SEM responsável.`;
    }
    const m = await api.resolveMember(project.id, a.assignee!);
    await api.patch(`/api/tasks/${a.task}`, { assigneeUserId: m.userId });
    return `Tarefa **#${a.task}** agora é responsabilidade de **@${m.username}** (quem estava antes saiu).`;
  },
};

export const taskMove: ToolDef = {
  name: 'systemtask_task_move',
  title: 'Mover uma tarefa para outro projeto',
  description:
    'Muda a tarefa de projeto. Se ela for RECORRENTE, a série inteira vai junto por padrão — mover ' +
    'só a instância de hoje faria a tarefa voltar sozinha para o projeto antigo amanhã. Use ' +
    'onlyThis = true para forçar mover apenas esta ocorrência.',
  inputSchema: {
    task: z.number().int().min(1).describe('O id da tarefa.'),
    project: z.string().nullable().describe('Projeto de destino (nome ou id). null tira a tarefa de qualquer projeto.'),
    onlyThis: z.boolean().optional().describe('true = mesmo sendo recorrente, move só esta ocorrência.'),
  },
  readOnly: false,
  async run({ api }, a) {
    let target = 'nenhum projeto';
    let categoryId: number | null = null;
    if (a.project != null) {
      const p = await api.resolveProject(a.project);
      categoryId = p.id;
      target = p.name;
    }
    const r = await api.post<{ moved: number; series: boolean }>(`/api/tasks/${a.task}/move`, {
      categoryId,
      scope: a.onlyThis ? 'task' : 'auto',
    });
    return r.series
      ? `Movida a SÉRIE recorrente para **${target}** — ${r.moved} ocorrência(s) foram junto.`
      : `Tarefa **#${a.task}** movida para **${target}**.`;
  },
};

export const taskComment: ToolDef = {
  name: 'systemtask_task_comment',
  title: 'Comentar numa tarefa',
  description:
    'Escreve um comentário na tarefa — é como o agente devolve resultado para a equipe, e o que ' +
    'fica registrado para quem abrir depois. Um "@usuario" no texto avisa a pessoa.',
  inputSchema: {
    task: z.number().int().min(1).describe('O id da tarefa.'),
    text: z.string().min(1).max(2000).describe('O comentário. Pode citar alguém com @usuario.'),
  },
  readOnly: false,
  async run({ api }, a) {
    await api.post(`/api/tasks/${a.task}/comments`, { body: a.text });
    return `Comentário registrado na tarefa **#${a.task}**.`;
  },
};

export const taskGet: ToolDef = {
  name: 'systemtask_task_get',
  title: 'Ler uma tarefa inteira',
  description:
    'A tarefa COMPLETA: título e descrição sem corte, mais as subtarefas. Use sempre que o título ' +
    'aparecer cortado com "…" nas listas e você precisar do texto inteiro — as tabelas cortam de ' +
    'propósito para caber, esta tool é a saída.',
  inputSchema: { task: z.number().int().min(1).describe('O id da tarefa (o número que aparece como #123).') },
  readOnly: true,
  async run({ api }, a) {
    const r = await api.get<{ task: any; steps: any[] }>(`/api/tasks/${a.task}`);
    const t = r.task;
    const parts = [
      `## #${t.id} — ${t.title}`,
      `${t.completed ? '✓ concluída' : 'aberta'} · vence ${fmtDate(t.date)}${t.time ? ` às ${t.time}` : ''}` +
        `${t.priority ? ` · prioridade ${t.priority}` : ''}${t.durationMin ? ` · ${fmtMin(t.durationMin)}` : ''}`,
    ];
    if (t.description) parts.push('', t.description);
    if (r.steps?.length) {
      parts.push('', '**Subtarefas**');
      for (const s of r.steps) parts.push(`- [${s.completed ? 'x' : ' '}] ${s.description}`);
    }
    if (t.tags?.length) parts.push('', `Etiquetas: ${t.tags.join(', ')}`);
    return parts.join('\n');
  },
};
