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
        { id: 'e', timestamp: '2026-09-03T04:00:00Z', provider: 'openrouter', model: 'linked-model', cost: .02,
            character: 'Hero', chat_name: 'Chapter 1', message_id: 'reply-id', reply_number: 7, swipe_index: 1, kind: 'swipe', status: 'complete' },
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
    assert.match(files.get('xl/styles.xml'), /<fill><patternFill patternType="gray125"\/><\/fill>/);
    assert.match(files.get('xl/styles.xml'), /fillId="2"/);
    assert.match(files.get('xl/styles.xml'), /color rgb="FF1F2A1F"/);
    assert.match(files.get('xl/workbook.xml'), /<sheet name="逐筆明細" sheetId="1"/);
    assert.match(files.get('xl/worksheets/sheet1.xml'), /AI 回覆序號/);
    assert.match(files.get('xl/worksheets/sheet1.xml'), /A&amp;B/);
    assert.match(files.get('xl/worksheets/sheet1.xml'), /連線測試/);
    assert.match(files.get('xl/worksheets/sheet1.xml'), /測試失敗；可能未收費/);
    assert.match(files.get('xl/worksheets/sheet1.xml'), /<c r="D2" s="0"><v>7<\/v><\/c>/);
    assert.match(files.get('xl/worksheets/sheet1.xml'), /<c r="E2" s="0"><v>2<\/v><\/c>/);
    assert.match(files.get('xl/worksheets/sheet1.xml'), /<v>0\.01212<\/v>/);
    assert.doesNotMatch(files.get('xl/worksheets/sheet1.xml'), /<f>/);
    assert.match(files.get('xl/worksheets/sheet2.xml'), /2026-08/);
    assert.match(files.get('xl/worksheets/sheet3.xml'), /HYPERLINK/);
    assert.doesNotMatch(files.get('xl/worksheets/sheet3.xml'), /ignored/);
});
