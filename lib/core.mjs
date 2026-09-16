export function money(value) {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

export function usageFrom(data, provider = 'openrouter') {
    // Keep the provider boundary explicit so another adapter can be added later
    // without changing the persisted ledger schema.
    if (provider !== 'openrouter') return {};
    const u = data?.usage;
    if (!u) return {};
    return { cost: money(u.cost), input_tokens: money(u.prompt_tokens), output_tokens: money(u.completion_tokens),
        cache_tokens: money(u.prompt_tokens_details?.cached_tokens), reasoning_tokens: money(u.completion_tokens_details?.reasoning_tokens),
        cost_source: money(u.cost) === null ? 'unknown' : 'provider' };
}

export function costFromSnapshots(before, after) {
    const start = money(before?.total_used);
    const end = money(after?.total_used);
    if (start === null || end === null || end < start) return null;
    return end - start;
}

// Incremental SSE parsing: handles CRLF, split UTF-8, multiple data lines and trailing frames.
export async function readUsage(response, receive) {
    if (!response.headers.get('content-type')?.includes('text/event-stream')) {
        receive(await response.json());
        return;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    function frame(value) {
        const data = value.split('\n').filter(x => x.startsWith('data:')).map(x => x.slice(5).trimStart()).join('\n');
        if (!data || data.trim() === '[DONE]') return;
        try { receive(JSON.parse(data)); } catch { /* Ignore non-JSON keepalive frames. */ }
    }
    try {
        while (true) {
            const { done, value } = await reader.read();
            buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
            // Normalize only complete CRLF pairs, including pairs split across chunks.
            buffer = buffer.replace(/\r\n/g, '\n');
            let i;
            while ((i = buffer.indexOf('\n\n')) >= 0) { frame(buffer.slice(0, i)); buffer = buffer.slice(i + 2); }
            if (buffer.length > 4 * 1024 * 1024) throw new Error('SSE frame too large');
            if (done) { if (buffer.trim()) frame(buffer); break; }
        }
    } finally { reader.releaseLock(); }
}

export function summarize(records, now = new Date()) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const week = new Date(day); week.setDate(week.getDate() - (week.getDay() + 6) % 7);
    const month = new Date(now.getFullYear(), now.getMonth(), 1);
    const result = { total: 0, today: 0, week: 0, month: 0, unknown: 0 };
    for (const r of records) {
        if (money(r.cost) === null) { result.unknown++; continue; }
        result.total += r.cost;
        const t = new Date(r.timestamp);
        if (t <= now && t >= day) result.today += r.cost;
        if (t <= now && t >= week) result.week += r.cost;
        if (t <= now && t >= month) result.month += r.cost;
    }
    return result;
}
