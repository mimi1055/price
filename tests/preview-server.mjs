// Local-only integration fixture. All costs and responses are simulated.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve('.');
const records = new Map();
let ledgerFile = null;
http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
        if (url.pathname === '/files/tavern-ledger-v2.json') {
            res.setHeader('content-type', 'application/json');
            if (!ledgerFile) { res.statusCode = 404; return res.end('{}'); }
            return res.end(ledgerFile);
        }
        if (url.pathname.startsWith('/api/')) {
            let body = ''; for await (const chunk of req) body += chunk;
            const b = body ? JSON.parse(body) : {};
            res.setHeader('content-type', 'application/json');
            if (url.pathname.startsWith('/api/plugins/')) { res.statusCode = 404; return res.end('{}'); }
            if (url.pathname === '/api/files/verify') return res.end(JSON.stringify({ 'files/tavern-ledger-v2.json': !!ledgerFile }));
            if (url.pathname === '/api/files/upload') {
                ledgerFile = Buffer.from(b.data, 'base64').toString('utf8');
                return res.end(JSON.stringify({ path: '/files/tavern-ledger-v2.json' }));
            }
            if (url.pathname === '/api/openrouter/credits') return res.end(JSON.stringify({ remaining: 18.72, total_usage: 11.28 }));
            if (url.pathname.endsWith('/records')) return res.end(JSON.stringify([...records.values()].sort((a,b) => b.timestamp.localeCompare(a.timestamp))));
            if (url.pathname.endsWith('/begin')) {
                const r = { ...b, timestamp: new Date().toISOString(), cost: null, cost_source: 'unknown', status: 'pending' };
                records.set(b.id, r); return res.end(JSON.stringify(r));
            }
            if (url.pathname.endsWith('/record')) { records.set(b.id, { ...records.get(b.id), ...b }); return res.end(JSON.stringify(records.get(b.id))); }
            if (url.pathname.endsWith('/snapshot')) return res.end(JSON.stringify({ account_id: 'demo-key', balance: 18.72, remaining: 8.72, used: 11.28, daily: .42, weekly: 1.2, monthly: 4.8, timestamp: new Date().toISOString() }));
            if (url.pathname.endsWith('/generate')) {
                const data = { id: crypto.randomUUID(), usage: { cost: .0372, prompt_tokens: 8432, completion_tokens: 1054 } };
                if (!b.stream) return res.end(JSON.stringify(data));
                res.setHeader('content-type', 'text/event-stream');
                res.write(`data: ${JSON.stringify({ id: data.id, choices: [{ delta: { content: '你好，旅人。' } }] })}\n\n`);
                setTimeout(() => res.end(`data: ${JSON.stringify(data)}\n\ndata: [DONE]\n\n`), 80); return;
            }
            res.statusCode = 404; return res.end('{}');
        }
        const requested = url.pathname === '/' ? 'tests/preview.html' : decodeURIComponent(url.pathname.slice(1));
        const file = path.resolve(root, requested);
        if (!file.startsWith(root + path.sep)) { res.statusCode = 403; return res.end(); }
        res.setHeader('content-type', file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.css') ? 'text/css' : 'text/javascript');
        res.end(await readFile(file));
    } catch { res.statusCode = 500; res.end('Fixture error'); }
}).listen(8787, '127.0.0.1', () => console.log('Simulated ST fixture: http://127.0.0.1:8787'));
