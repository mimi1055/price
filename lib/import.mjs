export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
export const MAX_IMPORT_RECORDS = 20000;
const strings = {
    id: 100, timestamp: 64, model: 512, character: 1000, character_id: 1000,
    chat_name: 2000, chat_id: 4096, request_id: 512, message_id: 100,
    candidate_id: 100, account_id: 128, secret_id: 128,
};
const enums = {
    provider: ['openrouter'], currency: ['USD'],
    kind: ['continue', 'swipe', 'normal', 'quiet'],
    status: ['pending', 'complete', 'interrupted', 'failed'],
    cost_source: ['unknown', 'provider', 'accountDelta'],
};
const counts = ['input_tokens', 'output_tokens', 'cache_tokens', 'reasoning_tokens', 'reply_number', 'swipe_index'];
function invalid() { throw new Error('importInvalid'); }
export function sanitizeImport(data) {
    if (!data || ![1, 2].includes(data.version) || !Array.isArray(data.records)) invalid();
    if (data.records.length > MAX_IMPORT_RECORDS) throw new Error('importTooMany');
    return data.records.map(source => {
        if (!source || typeof source !== 'object' || Array.isArray(source)) invalid();
        const row = {};
        for (const [key, max] of Object.entries(strings)) {
            if (!Object.hasOwn(source, key)) continue;
            const value = source[key];
            if (value === null && key !== 'id' && key !== 'timestamp') { row[key] = null; continue; }
            if (typeof value !== 'string' || value.length > max) invalid();
            row[key] = value;
        }
        if (!row.id || !/^[a-zA-Z0-9-]+$/.test(row.id) || !row.timestamp
            || !Number.isFinite(Date.parse(row.timestamp))) invalid();
        row.timestamp = new Date(row.timestamp).toISOString();
        for (const [key, values] of Object.entries(enums)) {
            if (!Object.hasOwn(source, key)) continue;
            if (!values.includes(source[key])) invalid();
            row[key] = source[key];
        }
        row.cost = source.cost ?? null;
        if (row.cost !== null && (typeof row.cost !== 'number' || !Number.isFinite(row.cost) || row.cost < 0)) invalid();
        for (const key of counts) {
            if (!Object.hasOwn(source, key)) continue;
            if (source[key] !== null && (!Number.isSafeInteger(source[key]) || source[key] < 0)) invalid();
            row[key] = source[key];
        }
        if (Object.hasOwn(source, 'message_deleted')) {
            if (typeof source.message_deleted !== 'boolean') invalid();
            row.message_deleted = source.message_deleted;
        }
        row.schema_version = 2;
        return row;
    });
}
export async function readImportFile(file) {
    if (file.size > MAX_IMPORT_BYTES) throw new Error('importTooLarge');
    let data;
    try { data = JSON.parse(await file.text()); } catch { invalid(); }
    return sanitizeImport(data);
}
