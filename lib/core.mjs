export function money(value) {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

const VERTEX_PRICES = [
    { match: /gemini-2\.5-pro/i, input: 1.25, output: 10, cache: 0.125, longInput: 2.5, longOutput: 15, longCache: 0.25 },
    { match: /gemini-2\.5-flash-lite/i, input: 0.10, output: 0.40, cache: 0.01 },
    { match: /gemini-2\.5-flash/i, input: 0.30, output: 2.50, cache: 0.03 },
];

export function estimateVertexCost(model, usage) {
    const price = VERTEX_PRICES.find(x => x.match.test(String(model || '')));
    const input = money(usage?.promptTokenCount ?? usage?.prompt_token_count);
    const output = money(usage?.candidatesTokenCount ?? usage?.candidates_token_count);
    if (!price || input === null || output === null) return null;
    const cached = Math.min(input, money(usage?.cachedContentTokenCount ?? usage?.cached_content_token_count) ?? 0);
    const thoughts = money(usage?.thoughtsTokenCount ?? usage?.thoughts_token_count) ?? 0;
    const long = input > 200000;
    const inputRate = long && price.longInput ? price.longInput : price.input;
    const outputRate = long && price.longOutput ? price.longOutput : price.output;
    const cacheRate = long && price.longCache ? price.longCache : price.cache;
    return ((input - cached) * inputRate + cached * cacheRate + (output + thoughts) * outputRate) / 1_000_000;
}

export function usageFrom(data, provider = 'openrouter', model = '') {
    if (provider === 'vertexai') {
        const u = data?.usageMetadata ?? data?.usage_metadata;
        if (!u) return {};
        const cost = estimateVertexCost(model || data?.modelVersion, u);
        return { cost, input_tokens: money(u.promptTokenCount ?? u.prompt_token_count),
            output_tokens: money(u.candidatesTokenCount ?? u.candidates_token_count),
            cache_tokens: money(u.cachedContentTokenCount ?? u.cached_content_token_count),
            reasoning_tokens: money(u.thoughtsTokenCount ?? u.thoughts_token_count),
            cost_source: cost === null ? 'unknown' : 'estimate' };
    }
    const u = data?.usage;
    if (!u) return {};
    return { cost: money(u.cost), input_tokens: money(u.prompt_tokens), output_tokens: money(u.completion_tokens),
        cache_tokens: money(u.prompt_tokens_details?.cached_tokens), reasoning_tokens: money(u.completion_tokens_details?.reasoning_tokens),
        cost_source: money(u.cost) === null ? 'unknown' : 'provider' };
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
