import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeImport, readImportFile, MAX_IMPORT_BYTES, MAX_IMPORT_RECORDS } from '../lib/import.mjs';
const row = { id: 'test-1', timestamp: '2026-09-17T00:00:00Z', cost: 0.2 };
test('imports legacy and current exports while stripping arbitrary fields', () => {
    for (const version of [1, 2]) {
        const [clean] = sanitizeImport({ version, records: [{ ...row, private_note: 'private', message_deleted: true }] });
        assert.equal(clean.cost, .2);
        assert.equal(clean.message_deleted, true);
        assert.equal(Object.hasOwn(clean, 'private_note'), false);
        assert.equal(clean.schema_version, 2);
    }
});
test('rejects invalid types, dates, amounts and oversized fields before import', () => {
    for (const patch of [{ cost: -1 }, { cost: '2' }, { timestamp: 'invalid' }, { character: {} },
        { character: 'a'.repeat(1001) }, { input_tokens: 1.5 }, { message_deleted: 'true' }, { status: 'bogus' }]) {
        assert.throws(() => sanitizeImport({ version: 2, records: [row, { ...row, ...patch }] }), /importInvalid/);
    }
    assert.throws(() => sanitizeImport({ version: 2, records: Array(MAX_IMPORT_RECORDS + 1).fill(row) }), /importTooMany/);
});
test('checks file size before reading and handles malformed JSON', async () => {
    await assert.rejects(readImportFile({ size: MAX_IMPORT_BYTES + 1, text() { assert.fail('must not read'); } }), /importTooLarge/);
    await assert.rejects(readImportFile({ size: 1, async text() { return '{'; } }), /importInvalid/);
});
