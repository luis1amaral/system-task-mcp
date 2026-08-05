/**
 * The only file that knows HTTP exists. No tool reads `process.env` or builds a URL — they receive
 * this object ready. That is what lets the same tools run over stdio today and inside a Worker
 * tomorrow (a new entry point building the client from a header) without touching any tool.
 */
export const DEFAULT_API_URL = 'https://system-api.defaltm.com';
/** Carries a user-ready message — never the raw body, never the token. */
export class ApiError extends Error {
    status;
    constructor(status, message) {
        super(message);
        this.status = status;
        this.name = 'ApiError';
    }
}
export class SystemTaskClient {
    baseUrl;
    token;
    categoriesCache = null;
    membersCache = new Map();
    constructor(baseUrl, token) {
        this.baseUrl = baseUrl;
        this.token = token;
    }
    async request(method, path, body) {
        let res;
        try {
            res = await fetch(this.baseUrl + path, {
                method,
                headers: {
                    Authorization: `Bearer ${this.token}`,
                    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
                },
                body: body !== undefined ? JSON.stringify(body) : undefined,
            });
        }
        catch {
            throw new ApiError(0, `não consegui falar com o System Task em ${this.baseUrl} — verifique a conexão`);
        }
        const text = await res.text();
        const data = text ? safeJson(text) : {};
        if (!res.ok)
            throw new ApiError(res.status, messageFor(res.status, data));
        return data;
    }
    get(path) {
        return this.request('GET', path);
    }
    post(path, body) {
        return this.request('POST', path, body);
    }
    patch(path, body) {
        return this.request('PATCH', path, body);
    }
    // Name resolution. People say "in the Vendas project", never "in category 17" — resolving names
    // here (once per process) is what makes the tools usable in a conversation.
    async categories() {
        if (!this.categoriesCache) {
            const r = await this.get('/api/categories');
            this.categoriesCache = r.categories ?? [];
        }
        return this.categoriesCache;
    }
    /** Takes an id or a name. An ambiguous name returns the options rather than guessing. */
    async resolveProject(ref) {
        const all = await this.categories();
        if (all.length === 0)
            throw new ApiError(404, 'você ainda não tem nenhum projeto no System Task');
        return matchByRef(all, ref, {
            byId: (id) => `projeto ${id} não existe ou você não participa dele`,
            notFound: (r) => `não achei o projeto "${r}". Os seus são: ${all.map((c) => c.name).join(', ')}`,
            ambiguous: (r, cs) => `"${r}" combina com mais de um projeto: ${cs}. Diga qual.`,
        });
    }
    // ── listas (migration 035): criar, renomear, lixeira, restaurar, purgar ──────────────────────
    //
    // Toda escrita aqui invalida `categoriesCache`: sem isto, criar uma lista e em seguida se referir
    // a ela pelo NOME (o caminho normal numa conversa) falharia até o processo reiniciar, porque
    // `resolveProject` reusaria a lista antiga.
    invalidateCategories() {
        this.categoriesCache = null;
    }
    async createCategory(body) {
        const r = await this.post('/api/categories', body);
        this.invalidateCategories();
        return r.category;
    }
    async renameCategory(id, body) {
        const r = await this.patch(`/api/categories/${id}`, body);
        this.invalidateCategories();
        return r.category;
    }
    /** Manda para a lixeira — não apaga a linha; ver `services/api-tokens.ts` no system-api. */
    async trashCategory(id) {
        await this.request('DELETE', `/api/categories/${id}`);
        this.invalidateCategories();
    }
    async trash() {
        const r = await this.get('/api/categories/trash');
        return r.categories ?? [];
    }
    async restoreCategory(id) {
        const r = await this.post(`/api/categories/${id}/restore`, {});
        this.invalidateCategories();
        return r.category;
    }
    /** `confirm: true` é exigido pelo servidor de propósito — não dá para chamar isto sem querer. */
    async purgeCategory(id) {
        await this.request('DELETE', `/api/categories/${id}/purge`, { confirm: true });
        this.invalidateCategories();
    }
    /**
     * Como `resolveProject`, mas procura TAMBÉM na lixeira quando não acha entre as ativas — é o que
     * permite restaurar ou purgar uma lista pelo nome, já que ela some de `/api/categories` assim que
     * é apagada.
     */
    async resolveProjectAnyState(ref) {
        try {
            return await this.resolveProject(ref);
        }
        catch (e) {
            if (!(e instanceof ApiError) || e.status !== 404)
                throw e;
        }
        const trashed = await this.trash();
        if (trashed.length === 0) {
            throw new ApiError(404, `não achei "${ref}" — nem ativa, nem na lixeira (que está vazia)`);
        }
        return matchByRef(trashed, ref, {
            byId: (id) => `a lista ${id} não existe (nem ativa, nem na lixeira)`,
            notFound: (r) => `não achei "${r}" — nem ativa, nem na lixeira. Na lixeira: ${trashed.map((c) => c.name).join(', ')}`,
            ambiguous: (r, cs) => `"${r}" combina com mais de uma lista na lixeira: ${cs}. Diga qual.`,
        });
    }
    async members(categoryId) {
        const cache = this.membersCache.get(categoryId);
        if (cache)
            return cache;
        const r = await this.get(`/api/categories/${categoryId}/members`);
        const all = r.members ?? [];
        this.membersCache.set(categoryId, all);
        return all;
    }
    /** Username, display name or id → a member of that list. */
    async resolveMember(categoryId, ref) {
        const all = await this.members(categoryId);
        const asId = typeof ref === 'number' ? ref : /^\d+$/.test(String(ref).trim()) ? Number(ref) : null;
        if (asId != null) {
            const found = all.find((m) => m.userId === asId);
            if (found)
                return found;
            throw new ApiError(400, `a pessoa ${asId} não participa deste projeto`);
        }
        const target = String(ref).trim().replace(/^@/, '').toLowerCase();
        const candidates = all.filter((m) => m.username.toLowerCase() === target || (m.displayName ?? '').toLowerCase() === target);
        const partial = candidates.length > 0 ? candidates : all.filter((m) => m.username.toLowerCase().startsWith(target));
        if (partial.length === 1)
            return partial[0];
        if (partial.length === 0) {
            throw new ApiError(400, `"${ref}" não participa deste projeto. Quem participa: ${all.map((m) => m.username).join(', ')}`);
        }
        throw new ApiError(409, `"${ref}" combina com: ${partial.map((m) => m.username).join(', ')}. Diga qual.`);
    }
}
/**
 * Name-or-id lookup shared by `resolveProject` and `resolveProjectAnyState` — same three outcomes
 * (exact id, one name match, or a question back) either way; only the messages differ per caller.
 */
function matchByRef(all, ref, msg) {
    const asId = typeof ref === 'number' ? ref : /^\d+$/.test(String(ref).trim()) ? Number(ref) : null;
    if (asId != null) {
        const found = all.find((c) => c.id === asId);
        if (found)
            return found;
        throw new ApiError(404, msg.byId(asId));
    }
    const target = String(ref).trim().toLowerCase();
    const exact = all.filter((c) => c.name.toLowerCase() === target);
    const candidates = exact.length > 0 ? exact : all.filter((c) => c.name.toLowerCase().includes(target));
    if (candidates.length === 1)
        return candidates[0];
    if (candidates.length === 0)
        throw new ApiError(404, msg.notFound(ref));
    throw new ApiError(409, msg.ambiguous(ref, candidates.map((c) => `${c.name} (#${c.id})`).join(', ')));
}
function safeJson(text) {
    try {
        return JSON.parse(text);
    }
    catch {
        return {};
    }
}
/**
 * Turns the status into something actionable. The 401 matters most: a revoked token failing with
 * "Unauthorized" sends the user debugging the network instead of opening the app.
 */
function messageFor(status, data) {
    const fromApi = typeof data?.error === 'string' ? data.error : '';
    if (status === 401) {
        return 'o token de acesso é inválido, foi revogado ou expirou — gere outro no app, em Configurações → Acesso de agentes';
    }
    if (status === 403) {
        return 'o token de agente não tem permissão para isto (ele lê relatórios, cria/edita tarefas e cria/edita/apaga listas — apagar tarefa e mexer na conta é pelo app)';
    }
    if (status === 404)
        return fromApi || 'não encontrado (ou você não participa desta all)';
    if (status === 429)
        return 'muitas requisições seguidas — espere um pouco';
    return fromApi || `a API respondeu ${status}`;
}
