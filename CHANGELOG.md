# Changelog — system-task-mcp

## 1.3.0

- ✨ **6 tools novas de lista** (`src/tools/lists.ts`, migration 035 no system-api): `list_create`,
  `list_rename` (também recolore — reusa o mesmo `PATCH`), `list_delete` (manda para a lixeira,
  reversível), `list_trash` (o que está lá), `list_restore` e `list_purge`. Antes o MCP não
  conseguia criar lista nem mudar o nome de uma — só as 8 tools mais antigas de tarefa existiam.
- As tools novas falam **"lista"** (`list_*`); as 8 antigas continuam chamando a mesma entidade de
  "projeto". Inconsistência de nome ACEITA de propósito — bate com o rótulo que o app mostra
  ("Listas"), e renomear as antigas está fora do escopo desta mudança.
- **`list_purge` é a única tool irreversível do plugin.** O schema exige `confirmRequest` (o pedido
  da pessoa, nas palavras dela) — não é um argumento opcional, é obrigatório, e a `description` diz
  explicitamente que a tool só serve para quando alguém pede a remoção definitiva. O smoke testa que
  o campo é `required`, não só que existe.
- `SystemTaskClient` ganhou `resolveProjectAnyState`: como `resolveProject`, mas cai para a lixeira
  quando a lista não está entre as ativas — é o que deixa restaurar/purgar pelo NOME, já que a lista
  some de `GET /api/categories` assim que é apagada. Toda escrita de lista invalida o cache de
  categorias (senão criar uma lista e se referir a ela pelo nome na sequência falhava até o processo
  reiniciar).
- Allow-list liberada na API só para as rotas que isto precisa (ver CHANGELOG do system-api).
- **Verificado:** `npm run check` (tsc + build + smoke) — 86 checks, contador de tools 15 → 21.

## 1.2.0

- ✨ **`task_create` aceita `assignee`.** Antes a tool era "cria uma tarefa SUA, sem responsável" e
  mandava usar `demand_create` para qualquer coisa de outra pessoa — só que demanda exige objetivo,
  entrega e critério de pronto, e nem todo trabalho atribuído é uma demanda formal. Pôr alguém como
  responsável virava dois passos (criar e depois `task_assign`). O nome é resolvido dentro do
  projeto ANTES de criar: um username errado agora falha sem deixar tarefa órfã para trás. Sem
  `project`, a tool explica que precisa dele em vez de ignorar o campo calado.

- 🐛 **A hora da tarefa era escrita-cega.** A API sempre teve `time` (`HH:MM`, aceito no
  `POST /api/tasks` e no `PATCH /api/tasks/:id`) e o `task_get` já imprimia "às HH:MM" — mas
  `task_create`, `task_update` e `demand_create` nunca mandavam o campo, e nem o expunham no
  schema. Resultado: pedir "Duolingo às 10h" ao agente só dava para virar gambiarra no título.
  Agora os três aceitam `time`; no `task_update`, `time: null` tira a hora.
- **A hora aparece nas listas.** Nova coluna "Hora" em `tasks_search` e no `day_brief` — sem isso
  a hora podia ser gravada e nunca mais ser vista pelo agente. A coluna some sozinha quando
  nenhuma tarefa do conjunto tem hora (regra antiga do `table`).
- Verificado com `npm run check` (tsc + build + smoke, 61 checks) e com escrita real na conta:
  criar com hora, mudar a hora, limpar com `null`, e reler pelo `task_get`.

## 1.1.1

- 🐛 **`/tasks` virou `/system-task`.** `/tasks` já é um comando EMBUTIDO do Claude Code (lista o
  trabalho em segundo plano da sessão) — um plugin não pode tomar esse nome. `/daily` continua,
  esse não colide com nada.

## 1.1.0

- **`/daily` e `/tasks`** — dois comandos que vêm com o plugin, para todo mundo que instalar.
  `/daily` responde o dia numa chamada só (`day_brief`, já somado no servidor). `/tasks` aceita
  `#projeto` e palavras de filtro ("atrasadas", "sem dono", "de ana"), e escolhe entre buscar
  linhas ou pedir os números do relatório conforme a pergunta.
- 🐛 **`systemtask_task_get` — a saída que faltava para o título cortado.** As tabelas cortam o
  título em ~45 caracteres de propósito (é o que mantém o custo de contexto baixo), mas não havia
  NENHUMA forma de ler o texto inteiro depois: economia que perde informação de vez não é
  economia. Agora devolve título e descrição sem corte, mais as subtarefas. Exigiu a rota
  `GET /api/tasks/:id` na API, liberada na allow-list do token.
- 15 tools no total.

## 1.0.1

- **The configure panel now asks for ONE thing: the token.** `apiUrl` was a user option with a
  working default, so on a fresh install the panel showed only *that* field and the plugin looked
  like it wanted something other than the code. Self-hosters set `SYSTEM_TASK_API_URL` as a plain
  environment variable instead.
- The token field now says where to get it, in the field's own description.

## 1.0.0

- First release. Stdio MCP server with 14 tools: 8 read (day brief, projects, project report,
  risks, team workload, members, search, whoami) and 6 write (demand, task, update, assign, move,
  comment).
- **Built so a remote transport is a new entry point, not a rewrite**: `client.ts` is the only file
  that knows HTTP exists and `stdio.ts` is the only one that reads the environment. No tool touches
  `process.env`.
- **`systemtask_demand_create` requires objective, deliverable and done-when** in the schema, not as
  a suggestion in prose. The criterion has to be verifiable by another person without asking
  anyone; the *how* is never prescribed. Subtasks only for genuinely independent deliverables.
- **Names, not ids.** `project` and `assignee` accept what people actually say ("in The City", "to
  ana"). An ambiguous name returns the options instead of guessing; an unknown one lists what
  exists.
- **Context has a ceiling.** Report tools return numbers aggregated server-side, search caps at 50
  rows, risk samples at 25, and a global 6,000-character truncator means not even a bug can blow the
  client's context window.
- Errors become error TEXT rather than protocol exceptions, so the model can correct itself. A 401
  says exactly what to do: generate another token in Settings → Agent access. The token never
  appears in an error message or a log.
- **Verified:** `scripts/smoke.mjs` — 57 protocol checks (handshake, 14 tools, schemas, the demand
  tool's required fields, and that nothing but JSON-RPC reaches `stdout`) plus 65 checks with a real
  token against the live API.
