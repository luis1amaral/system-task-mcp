---
name: daily
description: >
  Show the user's day in System Task: what is due today, what is overdue, how much estimated time
  that adds up to. Use when the user asks "what do I have today", "meu dia", "o que preciso fazer",
  runs /daily, or starts the day and wants a plan.
argument-hint: "[nada, ou o nome de um projeto]"
allowed-tools: mcp__system-task__systemtask_day_brief, mcp__system-task__systemtask_tasks_search, mcp__system-task__systemtask_task_get
---

# Meu dia

Chame **`systemtask_day_brief`** — uma chamada só. Ela já devolve tudo somado no servidor: o que
vence hoje, o que atrasou, o backlog sem data e o tempo estimado.

Se `$ARGUMENTS` trouxer um projeto (com ou sem `#`), use `systemtask_tasks_search` com esse
`project`, `completed: false` e `to` = hoje, em vez do resumo geral.

## Como responder

Curto. A tabela que a tool devolve já está pronta — repasse-a e acrescente **no máximo duas
linhas** de leitura, e só quando houver algo a dizer:

- se houver atrasada, comece por ela;
- se o tempo estimado passar de ~6 h, diga que o dia está cheio e sugira o que adiar;
- se não houver nada, diga isso e pare.

Não invente prioridade que a tarefa não tem, não reordene inventando critério, e **não chame outras
tools** para "enriquecer" a resposta — o valor aqui é ser barato e imediato.

Se algum título vier cortado com `…` e o usuário quiser o texto inteiro, aí sim use
`systemtask_task_get` com o id.

Ofereça no fim, em uma linha, o que dá para fazer em seguida: concluir, adiar ou detalhar uma
tarefa pelo número.
