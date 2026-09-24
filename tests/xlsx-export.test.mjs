import test from 'node:test';
import assert from 'node:assert/strict';
import { exportLedgerXlsx } from '../lib/xlsx-export.mjs';

test('spreadsheet includes monthly, model and editable record views with safe text', async () => {
    const records = [
        { id: 'a', timestamp: '2026-09-01T04:00:00Z', provider: 'openrouter', model: '=HYPERLINK("bad")', cost: .01212,
            character: 'A&B', chat_name: 'Test', input_tokens: 100, output_tokens: 20 },
        { id: 'b', timestamp: '2026-08-01T04:00:00Z', provider: 'openrouter', model: 'other', cost: null },
        { id: 'c', timestamp: '2026-09-01T04:00:00Z', provider: 'other', model: 'ignored', cost: 10 },
        { id: 'd', timestamp: '2026-09-02T04:00:00Z', provider: 'openrouter', model: 'test-model', cost: null, kind: 'connectionTest', status: 'failed' },
    ];
    const bytes = new Uint8Array(await exportLedgerXlsx(records).arrayBuffer());
    const view = new DataView(bytes.buffer);
    const files = new Map();
    for (let offset = 0; offset < bytes.length && view.getUint32(offset, true) === 0x04034b50;) {
        const length = view.getUint32(offset + 18, true), nameLength = view.getUint16(offset + 26, true);
        const name = new TextDecoder().decode(bytes.subarray(offset + 30, offset + 30 + nameLength));
        const start = offset + 30 + nameLength;
        files.set(name, new TextDecoder().decode(bytes.subarray(start, start + length)));
        offset = start + length;
    }
    assert.equal(files.size, 8);
    assert.match(files.get('xl/workbook.xml'), /模型統計/);
    assert.match(files.get('xl/worksheets/sheet1.xml'), /2026-08/);
    assert.match(files.get('xl/worksheets/sheet2.xml'), /HYPERLINK/);
    assert.doesNotMatch(files.get('xl/worksheets/sheet2.xml'), /ignored/);
    assert.match(files.get('xl/worksheets/sheet3.xml'), /A&amp;B/);
    assert.match(files.get('xl/worksheets/sheet3.xml'), /連線測試/);
    assert.match(files.get('xl/worksheets/sheet3.xml'), /測試失敗；可能未收費/);
    assert.match(files.get('xl/worksheets/sheet3.xml'), /<v>0\.01212<\/v>/);
    assert.doesNotMatch(files.get('xl/worksheets/sheet3.xml'), /<f>/);
});
