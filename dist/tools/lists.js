// lists.ts — as LISTAS (migration 035 no system-api). O app rotula isto "Listas" (app_pt.arb:
// navLists); as 8 tools mais antigas continuam chamando a mesma entidade de "projeto" — a
// inconsistência de nome entre as tools novas e as antigas foi aceita conscientemente, não é bug.
//
// `list_delete` NUNCA apaga de fato: manda para a lixeira, reversível com `list_restore`. A remoção
// sem volta é só `list_purge`, uma tool à parte que exige o pedido literal da pessoa.
import { z } from 'zod';
import { fmtDate, table } from '../format.js';
export const listCreate = {
    name: 'systemtask_list_create',
    title: 'Criar uma lista',
    description: 'Cria uma lista nova (o app chama isto de "Lista"; as tools de tarefa mais antigas chamam a ' +
        'mesma coisa de "projeto" — é a mesma entidade). Depois de criada, use o nome dela em ' +
        'systemtask_task_create, systemtask_demand_create etc.',
    inputSchema: {
        name: z.string().min(1).max(80).describe('Nome da lista.'),
        color: z.string().max(20).optional().describe('Cor em hex, ex.: "#3B82F6". Opcional.'),
        icon: z.string().max(40).optional().describe('Um emoji para representar a lista. Opcional.'),
        grocery: z
            .boolean()
            .optional()
            .describe('true = lista de compras (a tela agrupa os itens por corredor em vez de por dia).'),
    },
    readOnly: false,
    async run({ api }, a) {
        const c = await api.createCategory({
            name: a.name,
            color: a.color ?? null,
            icon: a.icon ?? null,
            type: a.grocery ? 'grocery' : null,
        });
        return `Lista **"${c.name}"** criada (**#${c.id}**).`;
    },
};
export const listRename = {
    name: 'systemtask_list_rename',
    title: 'Renomear (ou recolorir) uma lista',
    description: 'Muda o nome, a cor ou o emoji de uma lista já existente — as três coisas passam pela mesma ' +
        'chamada. Só o DONO da lista pode; quem só tem acesso compartilhado não. Só manda o que muda.',
    inputSchema: {
        list: z.string().describe('Nome ou id da lista.'),
        name: z.string().min(1).max(80).optional().describe('Novo nome.'),
        color: z.string().max(20).optional().describe('Nova cor em hex.'),
        icon: z.string().max(40).optional().describe('Novo emoji.'),
    },
    readOnly: false,
    async run({ api }, a) {
        const body = {};
        if (a.name !== undefined)
            body.name = a.name;
        if (a.color !== undefined)
            body.color = a.color;
        if (a.icon !== undefined)
            body.icon = a.icon;
        if (Object.keys(body).length === 0)
            return 'Você não disse o que mudar na lista (nome, cor ou emoji).';
        const project = await api.resolveProject(a.list);
        const c = await api.renameCategory(project.id, body);
        return `Lista **#${c.id}** atualizada — agora é **"${c.name}"**.`;
    },
};
export const listDelete = {
    name: 'systemtask_list_delete',
    title: 'Apagar uma lista (vai para a lixeira, reversível)',
    description: 'Manda a lista para a LIXEIRA — não apaga nada de fato. As tarefas dela vão junto e ficam ' +
        'fora de busca/relatório até alguém restaurar. Para desfazer, use systemtask_list_restore. Para ' +
        'apagar sem volta (só quando a pessoa pedir isso explicitamente), use systemtask_list_purge. ' +
        'Só o DONO da lista pode.',
    inputSchema: {
        list: z.string().describe('Nome ou id da lista.'),
    },
    readOnly: false,
    async run({ api }, a) {
        const project = await api.resolveProject(a.list);
        await api.trashCategory(project.id);
        return `Lista **"${project.name}"** (#${project.id}) foi para a lixeira, com as tarefas dela. Restaura com systemtask_list_restore.`;
    },
};
export const listTrash = {
    name: 'systemtask_list_trash',
    title: 'O que está na lixeira de listas',
    description: 'Lista as listas apagadas (na lixeira), prontas para restaurar ou apagar de vez. Use antes de ' +
        'systemtask_list_restore ou systemtask_list_purge quando não souber o id exato.',
    inputSchema: {},
    readOnly: true,
    async run({ api }) {
        const items = await api.trash();
        if (items.length === 0)
            return 'A lixeira está vazia.';
        const rows = items.map((c) => [`#${c.id}`, c.name, c.deletedAt ? fmtDate(new Date(c.deletedAt).toISOString().slice(0, 10)) : '—']);
        return `${items.length} lista(s) na lixeira:\n\n${table(['#', 'Lista', 'Apagada em'], rows)}`;
    },
};
export const listRestore = {
    name: 'systemtask_list_restore',
    title: 'Restaurar uma lista da lixeira',
    description: 'Tira a lista da lixeira e devolve as tarefas dela junto — o vínculo nunca se perdeu. Use ' +
        'systemtask_list_trash antes se não souber o nome/id exato.',
    inputSchema: {
        list: z.string().describe('Nome ou id da lista apagada (veja systemtask_list_trash).'),
    },
    readOnly: false,
    async run({ api }, a) {
        const project = await api.resolveProjectAnyState(a.list);
        const c = await api.restoreCategory(project.id);
        return `Lista **"${c.name}"** (#${c.id}) restaurada, com as tarefas dela.`;
    },
};
export const listPurge = {
    name: 'systemtask_list_purge',
    title: 'Apagar uma lista PARA SEMPRE (sem lixeira, sem volta)',
    description: 'Remove a lista de vez — sem passar pela lixeira, sem systemtask_list_restore depois. Use isto ' +
        'SOMENTE quando a pessoa pedir a remoção definitiva de forma explícita (algo como "apague de ' +
        'vez", "para sempre", "sem poder desfazer"). Para o pedido comum de "apagar uma lista", use ' +
        'systemtask_list_delete, que é reversível — é o padrão certo quase sempre. As tarefas da lista ' +
        'sobrevivem, soltas, sem lista nenhuma (o vínculo é perdido, ao contrário do delete reversível).',
    inputSchema: {
        list: z.string().describe('Nome ou id da lista a apagar para sempre.'),
        confirmRequest: z
            .string()
            .min(1)
            .max(500)
            .describe('O pedido da PESSOA, nas palavras dela, pedindo a remoção definitiva — não uma frase sua. ' +
            'Fica registrado na resposta como o que autorizou a ação.'),
    },
    readOnly: false,
    async run({ api }, a) {
        const project = await api.resolveProjectAnyState(a.list);
        await api.purgeCategory(project.id);
        return [
            `Lista **"${project.name}"** (#${project.id}) apagada PARA SEMPRE — não há como desfazer.`,
            `Pedido que autorizou: "${a.confirmRequest}"`,
        ].join('\n');
    },
};
