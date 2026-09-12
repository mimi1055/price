import { mkdir, readFile, readdir, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const queues = new Map();
export class LedgerStore {
    constructor(root) { this.root = path.join(root, 'tavern-ledger', 'v1'); }
    file(id) {
        if (!/^[a-zA-Z0-9-]{1,100}$/.test(id)) throw new Error('Invalid record ID');
        return path.join(this.root, `${id}.json`);
    }
    async get(id) {
        try { return JSON.parse(await readFile(this.file(id), 'utf8')); }
        catch (e) { if (e.code === 'ENOENT') return null; throw e; }
    }
    async update(id, change) {
        const key = this.file(id);
        const previous = queues.get(key) || Promise.resolve();
        const next = previous.catch(() => {}).then(async () => {
            await mkdir(this.root, { recursive: true });
            const record = await change(await this.get(id));
            const temp = `${key}.${randomUUID()}.tmp`;
            await writeFile(temp, JSON.stringify(record), { mode: 0o600 });
            await rename(temp, key);
            return record;
        });
        queues.set(key, next);
        try { return await next; } finally { if (queues.get(key) === next) queues.delete(key); }
    }
    async list() {
        let names;
        try { names = await readdir(this.root); } catch (e) { if (e.code === 'ENOENT') return []; throw e; }
        const rows = [];
        // Sequential reads bound file descriptor use even with a large ledger.
        for (const name of names.filter(x => x.endsWith('.json'))) rows.push(await this.get(name.slice(0, -5)));
        return rows.filter(Boolean).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    }
}
