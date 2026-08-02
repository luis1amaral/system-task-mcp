/**
 * Response formatting. Two rules that apply to every tool:
 *
 * 1. Markdown tables, not JSON — the reader is a model, and JSON repeats the keys on every row for
 *    3-4x the tokens with nobody consuming it programmatically.
 * 2. `truncate` is a hard ceiling no tool can bypass, so even a paging bug degrades into a message
 *    saying how to narrow the query instead of blowing the client's context window.
 */
export const MAX_CHARS = 6000;
export function truncate(text, max = MAX_CHARS) {
    if (text.length <= max)
        return text;
    const cut = text.slice(0, max);
    const lastLine = cut.lastIndexOf('\n');
    const clean = lastLine > max * 0.6 ? cut.slice(0, lastLine) : cut;
    const omitted = text.slice(clean.length).split('\n').length;
    return `${clean}\n\n… (${omitted} linha(s) omitidas — filtre por projeto, responsável ou período)`;
}
export function cut(s, n = 40) {
    const t = (s ?? '').replace(/\s+/g, ' ').trim();
    return t.length <= n ? t : `${t.slice(0, n - 1)}…`;
}
/**
 * 'YYYY-MM-DD' → 'dd/mm', keeping the year whenever it is not the current one: a task from 2000
 * shown as "01/01" reads as January of this year, which is the wrong call in an overdue report.
 */
export function fmtDate(iso, currentYear = String(new Date().getFullYear())) {
    if (!iso)
        return '—';
    const [y, m, d] = iso.split('-');
    if (!y || !m || !d)
        return iso;
    return y !== currentYear ? `${d}/${m}/${y}` : `${d}/${m}`;
}
export function fmtMin(min) {
    const n = min ?? 0;
    if (n <= 0)
        return '—';
    const h = Math.floor(n / 60);
    const m = n % 60;
    return h === 0 ? `${m}min` : m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}
/** Markdown table. Columns empty on every row are dropped — not worth the context. */
export function table(headers, rows) {
    if (rows.length === 0)
        return '_(nada aqui)_';
    const keep = headers.map((_, i) => rows.some((r) => String(r[i] ?? '').trim() !== '' && r[i] !== '—'));
    const h = headers.filter((_, i) => keep[i]);
    const kept = rows.map((r) => r.filter((_, i) => keep[i]));
    const out = [`| ${h.join(' | ')} |`, `|${h.map(() => '---').join('|')}|`];
    for (const r of kept)
        out.push(`| ${r.map((x) => String(x ?? '')).join(' | ')} |`);
    return out.join('\n');
}
export function bar(pct, width = 10) {
    const filled = Math.round((Math.max(0, Math.min(100, pct)) / 100) * width);
    return `${'█'.repeat(filled)}${'░'.repeat(width - filled)} ${pct}%`;
}
