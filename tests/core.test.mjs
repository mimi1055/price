import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { costFromSnapshots, monthlySpend, pageOf, readUsage, summarize, usageFrom } from '../lib/core.mjs';
import { LedgerStore } from '../server/store.mjs';
import { OpenRouterProvider } from '../server/openrouter.mjs';
import { locales } from '../locales.mjs';

test('SSE split at every byte retains Unicode and final cost, including CRLF', async () => {
    const input = 'data: {"id":"gen-1","choices":[{"delta":{"content":"酒館"}}]}\r\n\r\ndata: {"usage":{"cost":0.012,"prompt_tokens":80,"completion_tokens":12}}\r\n\r\ndata: [DONE]\r\n\r\n';
    const bytes = new TextEncoder().encode(input);
    const stream = new ReadableStream({ start(c) { for (const byte of bytes) c.enqueue(new Uint8Array([byte])); c.close(); } });
    const frames = [];
    await readUsage(new Response(stream, { headers: { 'content-type': 'text/event-stream' } }), x => frames.push(x));
    assert.equal(frames[0].choices[0].delta.content, '酒館');
    assert.deepEqual(usageFrom(frames[1]), { cost: .012, input_tokens: 80, output_tokens: 12, cache_tokens: null, reasoning_tokens: null, cost_source: 'provider' });
});
test('non-stream JSON and zero-cost generations remain official; unknown never becomes zero', async () => {
    let data;
    await readUsage(Response.json({ usage: { cost: 0 } }), x => { data = x; });
    assert.equal(usageFrom(data).cost_source, 'provider');
    assert.equal(usageFrom({ usage: {} }).cost, null);
});
test('account usage snapshots recover charges without accepting invalid differences', () => {
    assert.ok(Math.abs(costFromSnapshots({ total_used: 10 }, { total_used: 10.025 }) - .025) < 1e-12);
    assert.equal(costFromSnapshots({ total_used: 10 }, { total_used: 9 }), null);
    assert.equal(costFromSnapshots({}, { total_used: 10 }), null);
});

test('unsupported providers are ignored behind the provider adapter boundary', () => {
    assert.deepEqual(usageFrom({ usageMetadata: { promptTokenCount: 1000 } }, 'vertexai'), {});
});
test('summary counts continuations and discarded candidates, excludes unknown', () => {
    const now = new Date(2026, 8, 12, 12);
    const records = [{ cost: .03, kind: 'normal' }, { cost: .01, kind: 'continue' }, { cost: .02, kind: 'swipe' }, { cost: null }]
        .map(r => ({ ...r, timestamp: now.toISOString() }));
    const s = summarize(records, now);
    assert.equal(s.total, .06); assert.equal(s.today, .06); assert.equal(s.unknown, 1);
});
test('monthly spending separates years and months, including local month boundaries', () => {
    const records = [
        { timestamp: new Date(2026, 7, 31, 23, 59).toISOString(), cost: .2 },
        { timestamp: new Date(2026, 8, 1).toISOString(), cost: .3 },
        { timestamp: new Date(2025, 7, 31).toISOString(), cost: .4 },
        { timestamp: new Date(2026, 7, 15).toISOString(), cost: null },
    ];
    assert.equal(monthlySpend(records, 2026, 7), .2);
    assert.equal(monthlySpend(records, 2026, 8), .3);
    assert.equal(monthlySpend(records, 2025, 7), .4);
});
test('record pages show ten each and keep older records accessible', () => {
    const records = Array.from({ length: 501 }, (_, i) => i);
    assert.deepEqual(pageOf(records, 0).rows, records.slice(0, 10));
    assert.deepEqual(pageOf(records, 1).rows, records.slice(10, 20));
    assert.deepEqual(pageOf(records, 50).rows, [500]);
    assert.equal(pageOf(records, 500).page, 50);
    assert.equal(pageOf([], 4).page, 0);
});
test('concurrent writers preserve links and usage; independent records survive reload', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'tl-test-'));
    try {
        const a = new LedgerStore(dir), b = new LedgerStore(dir);
        await a.update('abc', () => ({ id: 'abc', timestamp: '2026-09-12' }));
        await Promise.all([a.update('abc', old => ({ ...old, cost: .1 })), b.update('abc', old => ({ ...old, message_id: 'm' })),
            b.update('def', () => ({ id: 'def', timestamp: '2026-09-13', cost: null }))]);
        assert.equal((await a.get('abc')).message_id, 'm'); assert.equal((await a.get('abc')).cost, .1);
        assert.equal((await new LedgerStore(dir).list()).length, 2);
        assert.throws(() => a.file('../outside'), /Invalid/);
        await writeFile(a.file('broken'), '{invalid');
        await assert.rejects(a.list()); // Do not silently discard corrupt financial records.
    } finally { await rm(dir, { recursive: true, force: true }); }
});
test('OR key-only snapshot tolerates credits permission failure without exposing secret', async () => {
    const p = new OpenRouterProvider('test-secret');
    p.request = async route => {
        if (route === 'credits') throw Object.assign(new Error(), { status: 403 });
        return { limit_remaining: 4, usage: 2, usage_daily: .1 };
    };
    const s = await p.snapshot();
    assert.equal(s.balance, null); assert.equal(s.remaining, 4); assert.equal(s.balance_status, 'permission');
    assert.ok(!JSON.stringify(s).includes('test-secret'));
});
test('locale dictionaries have complete parity', () => {
    assert.deepEqual(Object.keys(locales['zh-TW']).sort(), Object.keys(locales.en).sort());
});
