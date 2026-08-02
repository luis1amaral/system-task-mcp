// Read-only tools. They all return aggregated NUMBERS, not task rows — the API sums in SQL, which
// is why a quarter's report fits in half a screen instead of blowing the context window.
import { z } from 'zod';
import { bar, cut, fmtDate, fmtMin, table } from '../format.js';
const projectArg = z
    .string()
    .describe('Nome ou id do projeto (lista). Aceita o nome como a pessoa fala: "Vendas", "the city".');
const periodArgs = {
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Início do período, YYYY-MM-DD. Padrão: 14 dias atrás.'),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Fim do período, YYYY-MM-DD (inclusive). Padrão: hoje.'),
};
function query(args) {
    const parts = Object.entries(args)
        .filter(([, v]) => v !== undefined && v !== '')
        .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`);
    return parts.length ? `?${parts.join('&')}` : '';
}
export const whoami = {
    name: 'systemtask_whoami',
    title: 'Quem sou eu no System Task',
    description: 'Confirma a conta conectada e o fuso horário usado nos relatórios. Use uma vez no começo se ' +
        'houver dúvida sobre qual conta o token abre, ou se outra tool falhar por autenticação.',
    inputSchema: {},
    readOnly: true,
    async run({ api }) {
        const r = await api.get('/api/me');
        const p = r.profile;
        return [
            `Conectado como **${p.displayName || p.username}** (@${p.username}, ${p.email}).`,
            `Fuso: ${p.timezone} · idioma: ${p.locale}`,
        ].join('\n');
    },
};
export const projectsList = {
    name: 'systemtask_projects_list',
    title: 'Meus projetos e como cada um está',
    description: 'Visão geral de TODOS os projetos que você enxerga, com progresso, atrasadas, sem responsável e ' +
        'sem data. É a primeira tool a chamar quando a pergunta é "como estão as coisas?" ou quando ' +
        'você precisa descobrir o nome/id de um projeto.',
    inputSchema: {},
    readOnly: true,
    async run({ api }) {
        const r = await api.get('/api/reports/projects');
        if (r.projects.length === 0)
            return 'Você ainda não tem nenhum projeto no System Task.';
        const rows = r.projects.map((p) => [
            `${cut(p.name, 24)} (#${p.categoryId})`,
            bar(p.pct),
            p.open,
            p.overdue || '',
            p.unassigned || '',
            p.undated || '',
        ]);
        return [
            `Hoje: ${fmtDate(r.today)} (${r.tz})`,
            '',
            table(['Projeto', 'Progresso', 'Abertas', 'Atrasadas', 'Sem dono', 'Sem data'], rows),
        ].join('\n');
    },
};
export const projectReport = {
    name: 'systemtask_project_report',
    title: 'Painel de um projeto',
    description: 'Como um projeto está: total, concluídas, abertas, atrasadas, distribuição por coluna do board ' +
        'e por prioridade, e — o número que diz se o projeto está afundando — quantas tarefas ENTRARAM ' +
        'contra quantas foram CONCLUÍDAS no período. Período máximo de 92 dias.',
    inputSchema: { project: projectArg, ...periodArgs },
    readOnly: true,
    async run({ api }, a) {
        const project = await api.resolveProject(a.project);
        const r = await api.get(`/api/reports/projects/${project.id}${query({ from: a.from, to: a.to })}`);
        const rep = r.report;
        const t = rep.totals;
        const parts = [
            `## ${rep.name} (#${rep.categoryId})`,
            `${bar(t.pct)} — ${t.done} de ${t.total} concluídas, ${t.open} abertas`,
            `Atrasadas: **${t.overdue}** · sem responsável: ${t.unassigned} · sem data: ${t.undated}`,
            '',
            `Período ${fmtDate(rep.period.from)}–${fmtDate(rep.period.to)}: ` +
                `entraram ${rep.createdInPeriod}, concluídas ${rep.completedInPeriod}` +
                (rep.createdInPeriod > rep.completedInPeriod
                    ? ' → **entra mais do que sai**'
                    : rep.completedInPeriod > 0
                        ? ' → em dia'
                        : ''),
        ];
        if (rep.byColumn?.length) {
            parts.push('', '**Por coluna (abertas)**', table(['Coluna', 'Abertas'], rep.byColumn.map((c) => [c.name, c.open])));
        }
        if (rep.byPriority?.length > 1 || rep.byPriority?.some((p) => p.priority !== 'sem')) {
            parts.push('', '**Por prioridade (abertas)**', table(['Prioridade', 'Abertas'], rep.byPriority.map((p) => [p.priority, p.open])));
        }
        if (rep.throughput?.length) {
            parts.push('', `**Conclusões por dia:** ${rep.throughput.map((d) => `${fmtDate(d.date)}=${d.done}`).join(' · ')}`);
        }
        return parts.join('\n');
    },
};
export const projectRisks = {
    name: 'systemtask_project_risks',
    title: 'Onde está o risco de um projeto',
    description: 'O que vai dar problema: tarefas atrasadas, sem data e sem responsável — com as mais antigas ' +
        'em amostra, porque é onde o problema começou. A interseção (sem data E sem responsável) é a ' +
        'tarefa que ninguém vai fazer.',
    inputSchema: {
        project: projectArg,
        sample: z.number().int().min(1).max(25).optional().describe('Quantas tarefas listar (padrão 10, máximo 25).'),
    },
    readOnly: true,
    async run({ api }, a) {
        const project = await api.resolveProject(a.project);
        const r = await api.get(`/api/reports/projects/${project.id}/attention${query({ sample: a.sample })}`);
        const at = r.attention;
        const parts = [
            `## Riscos — ${project.name} (#${project.id})`,
            `Atrasadas: **${at.overdue.count}**${at.overdue.oldestDate ? ` (a mais antiga vencia ${fmtDate(at.overdue.oldestDate)})` : ''}`,
            `Sem data: ${at.undated.count} · sem responsável: ${at.unassigned.count} · **sem data E sem responsável: ${at.both.count}**`,
        ];
        if (at.sample.length) {
            parts.push('', table(['#', 'Tarefa', 'Vence', 'Atraso', 'Responsável'], at.sample.map((t) => [
                `#${t.id}`,
                cut(t.title, 40),
                fmtDate(t.date),
                t.daysLate != null ? `${t.daysLate}d` : '—',
                t.assigneeUsername ? `@${t.assigneeUsername}` : '**ninguém**',
            ])));
        }
        else {
            parts.push('', 'Nada em risco neste projeto.');
        }
        return parts.join('\n');
    },
};
export const teamList = {
    name: 'systemtask_team_list',
    title: 'Quem participa de um projeto',
    description: 'Os membros do projeto, com o nome de usuário. Use antes de atribuir uma demanda quando não ' +
        'souber quem participa — atribuir a quem não participa é recusado pela API.',
    inputSchema: { project: projectArg },
    readOnly: true,
    async run({ api }, a) {
        const project = await api.resolveProject(a.project);
        const members = await api.members(project.id);
        return table(['Pessoa', 'Usuário', 'Papel'], members.map((m) => [m.displayName || m.username, `@${m.username}`, m.role ?? 'editor']));
    },
};
export const teamLoad = {
    name: 'systemtask_team_load',
    title: 'Carga da equipe e quem está sem demanda',
    description: 'Quanto cada pessoa tem em aberto, quanto atrasou, quanto concluiu no período e quantas horas ' +
        'estimadas carrega. Quem está SEM DEMANDA aparece explicitamente — é a pergunta "quem posso ' +
        'acionar agora?". Período máximo de 92 dias.',
    inputSchema: { project: projectArg, ...periodArgs },
    readOnly: true,
    async run({ api }, a) {
        const project = await api.resolveProject(a.project);
        const r = await api.get(`/api/reports/projects/${project.id}/members${query({ from: a.from, to: a.to })}`);
        const parts = [
            `## Equipe — ${project.name} (#${project.id})`,
            `Período ${fmtDate(r.period.from)}–${fmtDate(r.period.to)}`,
            '',
            table(['Pessoa', 'Abertas', 'Atrasadas', 'Concluídas', 'Estimado'], r.members.map((m) => [
                `${m.displayName || m.username} (@${m.username})`,
                m.open,
                m.overdue || '',
                m.doneInPeriod,
                fmtMin(m.openMinutes),
            ])),
        ];
        parts.push('', r.idle.length
            ? `**Sem demanda nenhuma:** ${r.idle.map((m) => `@${m.username}`).join(', ')}`
            : 'Todo mundo tem alguma tarefa aberta.');
        return parts.join('\n');
    },
};
export const dayBrief = {
    name: 'systemtask_day_brief',
    title: 'Meu dia',
    description: 'O que EU tenho para hoje: o que vence hoje, o que já está atrasado, quanto tempo estimado ' +
        'isso soma, e o backlog sem data. Traz só o que é meu — tarefa atribuída a outra pessoa é o ' +
        'dia dela. Comece o dia por aqui.',
    inputSchema: {},
    readOnly: true,
    async run({ api }) {
        const r = await api.get('/api/reports/me/day');
        const d = r.day;
        const parts = [
            `## Seu dia — ${fmtDate(d.date)}`,
            `Vence hoje: **${d.dueToday}** · atrasadas: **${d.overdue}** · sem data: ${d.undatedOpen}`,
            `Tempo estimado do que está para hoje ou antes: ${fmtMin(d.estimatedMinutes)}`,
        ];
        if (d.tasks.length) {
            parts.push('', table(['#', 'Tarefa', 'Projeto', 'Vence', 'Atraso', 'Estimado'], d.tasks.map((t) => [
                `#${t.id}`,
                cut(t.title, 40),
                cut(t.categoryName, 18) || '—',
                fmtDate(t.date),
                t.daysLate != null ? `${t.daysLate}d` : '',
                fmtMin(t.durationMin),
            ])));
        }
        else {
            parts.push('', 'Nada marcado para hoje nem atrasado.');
        }
        return parts.join('\n');
    },
};
