import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { LedgerStore } from './store.mjs';
import { OpenRouterProvider } from './openrouter.mjs';
import { money } from '../lib/core.mjs';

export const info = { id: 'tavern-ledger', name: 'Tavern Ledger', description: 'Private per-user OpenRouter usage ledger' };
export async function init(router) {
    // ST is the host. Never read secrets in the browser or log request bodies.
    const { readSecret, SECRET_KEYS } = await import(pathToFileURL(path.resolve('src/endpoints/secrets.js')).href);
    const provider = req => {
        const key = readSecret(req.user.directories, SECRET_KEYS.OPENROUTER);
        if (!key) throw Object.assign(new Error('Configure an OpenRouter key in ST'), { status: 400 });
        return new OpenRouterProvider(key);
    };
    registerRoutes(router, provider);
}

// Dependency injection keeps route tests independent of ST's host-only imports.
export function registerRoutes(router, provider) {
    const wrap = fn => async (req, res) => {
        if (!req.user?.directories?.root) return res.sendStatus(401);
        res.set('Cache-Control', 'no-store');
        try { await fn(req, res, new LedgerStore(req.user.directories.root)); }
        catch (e) { res.status([400, 401, 403, 404, 409, 429].includes(e.status) ? e.status : 500).json({ error: 'ledger_request_failed' }); }
    };
    const text = (value, max = 300) => typeof value === 'string' ? value.slice(0, max) : null;
    router.get('/health', wrap(async (_req, res) => res.json({ version: '0.1.0' })));
    router.get('/records', wrap(async (_req, res, store) => res.json(await store.list())));
    router.post('/snapshot', wrap(async (req, res) => res.json(await provider(req).snapshot())));
    router.post('/begin', wrap(async (req, res, store) => {
        const p = provider(req), b = req.body;
        const record = await store.update(b.id, old => old || {
            id: b.id, schema_version: 1, timestamp: new Date().toISOString(), provider: 'openrouter', account_id: p.accountId,
            model: text(b.model), character: text(b.character), character_id: text(b.character_id), chat_name: text(b.chat_name),
            chat_id: text(b.chat_id), kind: ['continue', 'swipe', 'normal', 'quiet'].includes(b.kind) ? b.kind : 'normal',
            cost: null, input_tokens: null, output_tokens: null, cost_source: 'unknown', status: 'pending', currency: 'USD',
        });
        res.json(record);
    }));
    router.post('/record', wrap(async (req, res, store) => {
        const b = req.body;
        res.json(await store.update(b.id, old => {
            if (!old) throw Object.assign(new Error(), { status: 404 });
            const patch = {};
            for (const key of ['cost', 'input_tokens', 'output_tokens', 'cache_tokens', 'reasoning_tokens']) {
                if (money(b[key]) !== null) patch[key] = b[key];
            }
            for (const key of ['request_id', 'message_id', 'candidate_id']) if (text(b[key])) patch[key] = text(b[key]);
            for (const key of ['reply_number', 'swipe_index']) if (Number.isInteger(b[key]) && b[key] >= 0) patch[key] = b[key];
            if (['complete', 'interrupted', 'failed'].includes(b.status)) patch.status = b.status;
            if (money(patch.cost) !== null) patch.cost_source = 'provider';
            return { ...old, ...patch };
        }));
    }));
    router.post('/reconcile', wrap(async (req, res, store) => {
        const old = await store.get(req.body.id), p = provider(req);
        if (!old?.request_id) return res.sendStatus(404);
        // A changed ST key must never be used to attribute a different account's generation.
        if (old.account_id !== p.accountId) return res.sendStatus(409);
        const usage = await p.generation(old.request_id);
        res.json(await store.update(old.id, current => ({ ...current, ...usage })));
    }));
}
