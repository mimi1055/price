import test from 'node:test';
import assert from 'node:assert/strict';
import { STFileLedger, FILE_PATH, FILE_URL } from '../lib/st-storage.mjs';

function host() {
    let file = null;
    const calls = [];
    return { calls, corrupt() { file = '{}'; }, async fetch(url, options = {}) {
        calls.push(url);
        if (url === FILE_URL) return file === null ? new Response('', { status: 404 }) : new Response(file);
        const b = JSON.parse(options.body);
        if (url === '/api/files/verify') return Response.json({ [FILE_PATH]: file !== null });
        if (url === '/api/files/upload') {
            file = Buffer.from(b.data, 'base64').toString('utf8');
            return Response.json({ path: FILE_URL });
        }
        throw new Error(`Unexpected endpoint ${url}`);
    } };
}
const record = id => ({ id, timestamp: '2026-09-12T12:00:00Z', cost: .03, character: '酒館角色', kind: 'normal' });
test('phone writes, fresh desktop reads same ST file without browser storage or plugin routes', async () => {
    const h = host();
    const phone = new STFileLedger(h.fetch.bind(h), () => ({}));
    const desktop = new STFileLedger(h.fetch.bind(h), () => ({}));
    assert.deepEqual(await desktop.read(), []);
    await phone.update([record('one')]);
    assert.equal((await desktop.read())[0].character, '酒館角色');
    await desktop.update([record('two')]);
    assert.equal((await phone.read()).length, 2);
    assert.ok(h.calls.every(p => !p.includes('/api/plugins/')));
});
test('same-page concurrent updates are queued; repeated IDs are merged, not charged twice', async () => {
    const h = host(), storage = new STFileLedger(h.fetch.bind(h), () => ({}));
    await Promise.all([storage.update([record('a')]), storage.update([record('b')]), storage.update([{ ...record('a'), message_id: 'm' }])]);
    const rows = await storage.read();
    assert.equal(rows.length, 2); assert.equal(rows.find(r => r.id === 'a').message_id, 'm');
});
test('corrupt existing data is not overwritten with a new empty ledger', async () => {
    const h = host(), storage = new STFileLedger(h.fetch.bind(h), () => ({}));
    h.corrupt();
    await assert.rejects(storage.update([record('a')]));
    assert.ok(!h.calls.includes('/api/files/upload'));
});
test('unknown costs survive file roundtrip and failed HTTP never looks like an empty ledger', async () => {
    const h = host(), storage = new STFileLedger(h.fetch.bind(h), () => ({}));
    await storage.update([{ ...record('a'), cost: null }]);
    assert.equal((await storage.read())[0].cost, null);
    const broken = new STFileLedger(async () => new Response('', { status: 500 }), () => ({}));
    await assert.rejects(broken.read());
});
