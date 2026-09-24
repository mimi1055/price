// Small, dependency-free OOXML writer. Exports a read/edit copy; the JSON file remains the backup format.
import { locales } from '../locales.mjs';
const encoder = new TextEncoder();
const xml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c])
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
const col = index => {
    let result = '';
    for (let n = index + 1; n; n = Math.floor((n - 1) / 26)) result = String.fromCharCode(65 + (n - 1) % 26) + result;
    return result;
};
const dateSerial = value => {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return null;
    const localAsUtc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds());
    return localAsUtc / 86400000 + 25569;
};
const textCell = (ref, value, style = 0) => `<c r="${ref}" s="${style}" t="inlineStr"><is><t>${xml(value)}</t></is></c>`;
const numericCell = (ref, value, style = 0) => Number.isFinite(value) ? `<c r="${ref}" s="${style}"><v>${value}</v></c>` : '';
function sheet(headers, data, widths, types = {}) {
    const rowXml = [headers.map((value, i) => textCell(`${col(i)}1`, value, 1))];
    for (const [index, values] of data.entries()) {
        const row = index + 2;
        rowXml.push(values.map((value, i) => {
            if (value == null) return '';
            const type = types[i];
            if (type === 'date') return numericCell(`${col(i)}${row}`, dateSerial(value), 3);
            if (type === 'money' || type === 'number') return numericCell(`${col(i)}${row}`, value, type === 'money' ? 2 : 0);
            return textCell(`${col(i)}${row}`, value);
        }));
    }
    const rows = rowXml.map((cells, i) => `<row r="${i + 1}">${cells.join('')}</row>`).join('');
    const columns = widths.map((width, i) => `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`).join('');
    const last = `${col(headers.length - 1)}${Math.max(1, rowXml.length)}`;
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${last}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${columns}</cols><sheetData>${rows}</sheetData><autoFilter ref="A1:${last}"/></worksheet>`;
}
const crcTable = Array.from({ length: 256 }, (_, i) => {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
});
function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
}
function zip(files) {
    const chunks = [], central = [];
    let offset = 0;
    for (const [name, content] of files) {
        const nameBytes = encoder.encode(name), data = encoder.encode(content), crc = crc32(data);
        const local = new Uint8Array(30 + nameBytes.length);
        const a = new DataView(local.buffer);
        a.setUint32(0, 0x04034b50, true); a.setUint16(4, 20, true);
        a.setUint32(14, crc, true); a.setUint32(18, data.length, true); a.setUint32(22, data.length, true);
        a.setUint16(26, nameBytes.length, true); local.set(nameBytes, 30);
        chunks.push(local, data);
        const directory = new Uint8Array(46 + nameBytes.length);
        const b = new DataView(directory.buffer);
        b.setUint32(0, 0x02014b50, true); b.setUint16(4, 20, true); b.setUint16(6, 20, true);
        b.setUint32(16, crc, true); b.setUint32(20, data.length, true); b.setUint32(24, data.length, true);
        b.setUint16(28, nameBytes.length, true); b.setUint32(42, offset, true); directory.set(nameBytes, 46);
        central.push(directory);
        offset += local.length + data.length;
    }
    const centralSize = central.reduce((n, c) => n + c.length, 0);
    const end = new Uint8Array(22), e = new DataView(end.buffer);
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
    e.setUint32(12, centralSize, true); e.setUint32(16, offset, true);
    return new Blob([...chunks, ...central, end], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
export function exportLedgerXlsx(records, language = 'zh-TW') {
    const zh = language === 'zh-TW';
    const labels = zh ? {
        monthly: '月份總覽', models: '模型統計', details: '逐筆明細', month: '月份', model: '模型', cost: '費用 (USD)', count: '筆數', unknown: '待確認筆數',
        time: '時間', provider: '服務商', character: '角色', chat: '聊天室', reply: 'AI 回覆序號', candidate: '候選序號', kind: '生成類型', status: '狀態', input: '輸入 tokens', output: '輸出 tokens', source: '費用來源', id: '紀錄 ID', note: '備註',
    } : {
        monthly: 'Monthly totals', models: 'Model totals', details: 'Records', month: 'Month', model: 'Model', cost: 'Cost (USD)', count: 'Records', unknown: 'Unconfirmed',
        time: 'Time', provider: 'Provider', character: 'Character', chat: 'Chat', reply: 'AI reply number', candidate: 'Candidate number', kind: 'Generation type', status: 'Status', input: 'Input tokens', output: 'Output tokens', source: 'Cost source', id: 'Record ID', note: 'Note',
    };
    const valid = records.filter(r => (r.provider || 'openrouter') === 'openrouter');
    const monthly = new Map(), models = new Map();
    for (const row of valid) {
        const date = new Date(row.timestamp);
        if (!Number.isFinite(date.getTime())) continue;
        const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const model = row.model || '—';
        for (const [map, key] of [[monthly, month], [models, `${month}\u0000${model}`]]) {
            const item = map.get(key) || { month, model, cost: 0, count: 0, unknown: 0 };
            item.count++;
            if (typeof row.cost === 'number' && Number.isFinite(row.cost) && row.cost >= 0) item.cost += row.cost;
            else item.unknown++;
            map.set(key, item);
        }
    }
    const monthRows = [...monthly.values()].sort((a, b) => b.month.localeCompare(a.month)).map(x => [x.month, x.cost, x.count, x.unknown]);
    const modelRows = [...models.values()].sort((a, b) => b.month.localeCompare(a.month) || b.cost - a.cost || a.model.localeCompare(b.model))
        .map(x => [x.month, x.model, x.cost, x.count, x.unknown]);
    const display = key => locales[language]?.[key] || key || '';
    const detailRows = [...valid].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).map(r => {
        const note = r.kind === 'connectionTest' ? (r.status === 'failed' && r.cost == null
            ? (zh ? '測試失敗；可能未收費，費用待確認' : 'Test failed; may not be charged, cost unconfirmed')
            : (zh ? '測試訊息，不會出現在聊天室' : 'Test message; not shown in chat'))
            : r.message_deleted ? (zh ? '原回覆已刪除，費用仍保留' : 'Reply deleted; cost retained')
                : !r.message_id ? (zh ? '未對應到聊天回覆；不代表重複扣款' : 'No linked chat reply; not a duplicate charge')
                    : '';
        return [r.timestamp, r.character || '', r.chat_name || '', r.message_id ? r.reply_number ?? null : null,
            r.message_id ? (r.swipe_index ?? 0) + 1 : null, r.model || '', display(r.kind), r.cost,
            r.input_tokens, r.output_tokens, display(r.status), display(r.cost_source), r.provider || 'openrouter', note, r.id || ''];
    });
    const sheets = [
        [labels.details, sheet([labels.time, labels.character, labels.chat, labels.reply, labels.candidate, labels.model, labels.kind,
            labels.cost, labels.input, labels.output, labels.status, labels.source, labels.provider, labels.note, labels.id],
        detailRows, [23, 22, 28, 18, 17, 42, 20, 20, 18, 18, 24, 22, 17, 48, 39],
        { 0: 'date', 3: 'number', 4: 'number', 7: 'money', 8: 'number', 9: 'number' })],
        [labels.monthly, sheet([labels.month, labels.cost, labels.count, labels.unknown], monthRows, [15, 20, 13, 18], { 1: 'money', 2: 'number', 3: 'number' })],
        [labels.models, sheet([labels.month, labels.model, labels.cost, labels.count, labels.unknown], modelRows, [15, 42, 20, 13, 18], { 2: 'money', 3: 'number', 4: 'number' })],
    ];
    const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    const main = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
    const rel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
    const files = [
        ['[Content_Types].xml', `${declaration}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`],
        ['_rels/.rels', `${declaration}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
        ['xl/workbook.xml', `${declaration}<workbook xmlns="${main}" xmlns:r="${rel}"><sheets>${sheets.map(([name], i) => `<sheet name="${xml(name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`],
        ['xl/_rels/workbook.xml.rels', `${declaration}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${rel}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="${rel}/styles" Target="styles.xml"/></Relationships>`],
        ['xl/styles.xml', `${declaration}<styleSheet xmlns="${main}"><numFmts count="2"><numFmt numFmtId="164" formatCode="&quot;US$&quot;#,##0.00000"/><numFmt numFmtId="165" formatCode="yyyy-mm-dd hh:mm:ss"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Aptos"/></font><font><b/><color rgb="FF1F2A1F"/><sz val="11"/><name val="Aptos"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE2EAD9"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`],
        ...sheets.map(([, content], i) => [`xl/worksheets/sheet${i + 1}.xml`, content]),
    ];
    return zip(files);
}
