---
name: system-task
description: >
  List System Task tasks, optionally for one project. Use when the user runs /system-task, says
  "mostra as tarefas", "o que tem no projeto X", "#projeto", or wants to see or filter tasks.
argument-hint: "[#projeto] [atrasadas|abertas|concluidas|sem-dono]"
allowed-tools: mcp__system-task__systemtask_tasks_search, mcp__system-task__systemtask_projects_list, mcp__system-task__systemtask_project_report, mcp__system-task__systemtask_project_risks, mcp__system-task__systemtask_task_get
---

# Tarefas

Argumentos: `$ARGUMENTS`

## Como ler o que veio

- **`#nome` ou um nome solto** → é o projeto. Tire o `#` e passe como `project`; a tool aceita o
  nome como a pessoa fala e devolve as opções se for ambíguo.
- **sem nada** → busca em tudo que o usuário enxerga.
- Palavras de filtro que podem vir junto:
  - `atrasadas` / `atrasado` → `completed: false` e `to` = hoje
  - `abertas` → `completed: false`
  - `concluidas` / `feitas` → `completed: true`
  - `sem dono` / `sem responsavel` → `unassigned: true`
  - um nome de pessoa depois de `de` ou `@` → `assignee` (exige `project`)

## Qual tool usar

| A pergunta é | Use |
|---|---|
| "quais são as tarefas" | `systemtask_tasks_search` |
| "como está o projeto" / "quanto falta" | `systemtask_project_report` — números, não linhas |
| "o que vai dar problema" / "o que está atrasado no projeto" | `systemtask_project_risks` |
| "quais projetos eu tenho" (o nome não foi dito, ou não bateu) | `systemtask_projects_list` primeiro |

Prefira **uma** chamada. `tasks_search` já tem teto de linhas — não pagine atrás de "tudo".

## Como responder

Repasse a tabela da tool e pare. Sem resumo do que a tabela já mostra, sem reordenar, sem inventar
prioridade. Se vier o aviso de que bateu no limite, diga em uma linha como filtrar melhor.

Título cortado com `…` e o usuário quer o texto inteiro → `systemtask_task_get` com o id.

Feche com uma linha do que dá para fazer em seguida (concluir, adiar, atribuir, mover), citando o
número da tarefa.
