// Use ST's existing per-user file API. No additional server plugin or browser database.
export const FILE_NAME = 'tavern-ledger-v2.json';
export const FILE_PATH = `user/files/${FILE_NAME}`;
export const FILE_URL = `/${FILE_PATH}`;
export function validateLedger(data) {
    if (data?.schema_version !== 2 || !Array.isArray(data.records)) throw new Error('Unsupported ledger');
    const ids = new Set();
    for (const r of data.records) {
        if (!r || typeof r.id !== 'string' || !r.id || ids.has(r.id) || typeof r.timestamp !== 'string'
            || !Number.isFinite(Date.parse(r.timestamp)) || (r.cost != null && (typeof r.cost !== 'number' || !Number.isFinite(r.cost) || r.cost < 0))) throw new Error('Invalid ledger record');
        ids.add(r.id);
    }
    return data.records;
}
export class STFileLedger {
    constructor(fetcher, headers) { this.fetch = fetcher; this.headers = headers; this.queue = Promise.resolve(); }
    async post(url, body) {
        const res = await this.fetch(url, { method: 'POST', headers: this.headers(), body: JSON.stringify(body), signal: AbortSignal.timeout(20000) });
        if (!res.ok) throw new Error(`ST HTTP ${res.status}`);
        return res.json();
    }
    async read() {
        const res = await this.fetch(FILE_URL, { headers: this.headers(), cache: 'no-store', signal: AbortSignal.timeout(20000) });
        if (res.status === 404) {
            // Verify that the ST file API exists before treating a missing file as a new ledger.
            const verified = await this.post('/api/files/verify', { urls: [FILE_PATH] });
            if (verified[FILE_PATH] !== false) throw new Error('File unavailable');
            return [];
        }
        if (!res.ok) throw new Error(`ST HTTP ${res.status}`);
        return validateLedger(await res.json());
    }
    update(records) {
        const changes = structuredClone(records);
        const next = this.queue.catch(() => {}).then(async () => {
            const latest = await this.read();
            const merged = new Map(latest.map(r => [r.id, r]));
            for (const r of changes) merged.set(r.id, { ...merged.get(r.id), ...r });
            const data = { schema_version: 2, records: [...merged.values()].sort((a, b) => b.timestamp.localeCompare(a.timestamp)) };
            validateLedger(data);
            const bytes = new TextEncoder().encode(JSON.stringify(data));
            let binary = ''; for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
            await this.post('/api/files/upload', { name: FILE_NAME, data: btoa(binary) });
            return data.records;
        });
        this.queue = next;
        return next;
    }
}
