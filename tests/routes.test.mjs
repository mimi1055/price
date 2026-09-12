import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { registerRoutes } from '../server/index.mjs';

test('routes isolate user stores, merge cost/link races and reject reconciliation with a different key', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'tl-routes-'));
    try {
        const routes = new Map(); let accountId = 'account-a';
        const provider = () => ({ accountId, generation: async () => ({ cost: .07, cost_source: 'provider' }) });
        registerRoutes({ get: (p, fn) => routes.set(`GET ${p}`, fn), post: (p, fn) => routes.set(`POST ${p}`, fn) }, provider);
        async function call(method, route, body, user = 'a') {
            const req = { body, user: user ? { directories: { root: path.join(root, user) } } : null };
            const res = { code: 200, value: null, set() {}, status(code) { this.code = code; return this; },
                sendStatus(code) { this.code = code; }, json(value) { this.value = value; } };
            await routes.get(`${method} ${route}`)(req, res); return res;
        }
        assert.equal((await call('GET', '/records', null, null)).code, 401);
        await call('POST', '/begin', { id: 'request-1', character: 'Ghost', kind: 'normal' });
        await Promise.all([call('POST', '/record', { id: 'request-1', cost: .03, input_tokens: 50, status: 'complete' }),
            call('POST', '/record', { id: 'request-1', message_id: 'message-a', request_id: 'gen-a' })]);
        let record = (await call('GET', '/records')).value[0];
        assert.equal(record.cost, .03); assert.equal(record.message_id, 'message-a');
        assert.equal((await call('GET', '/records', null, 'b')).value.length, 0);
        await call('POST', '/record', { id: 'request-1', cost: -8, api_key: 'do-not-save', status: 'invalid' });
        record = (await call('GET', '/records')).value[0];
        assert.equal(record.cost, .03); assert.equal(record.api_key, undefined); assert.equal(record.status, 'complete');
        accountId = 'account-b';
        assert.equal((await call('POST', '/reconcile', { id: 'request-1' })).code, 409);
        accountId = 'account-a';
        assert.equal((await call('POST', '/reconcile', { id: 'request-1' })).value.cost, .07);
        await call('POST', '/begin', { id: 'request-1', character: 'Other' });
        assert.equal((await call('GET', '/records')).value.length, 1);
        assert.equal((await call('POST', '/record', { id: 'nonexistent', cost: .1 })).code, 404);
    } finally { await rm(root, { recursive: true, force: true }); }
});
