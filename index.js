import { costFromSnapshots, money, readUsage, summarize, usageFrom } from './lib/core.mjs';
import { locales } from './locales.mjs';
import { STFileLedger } from './lib/st-storage.mjs';
import { readImportFile } from './lib/import.mjs';

const NAME = 'tavern_ledger';
const SUPPORTED_PROVIDERS = new Set(['openrouter']);
const context = () => SillyTavern.getContext();
const originalFetch = window.fetch.bind(window);
const storage = new STFileLedger(originalFetch, () => context().getRequestHeaders());
let rows = [], snapshot = null, connected = false, run = null, dialog = null, filter = '';
let updateSettingsBalance = () => {};
let syncInFlight = null;
let balanceFollowupTimer = null;
const unsaved = new Map();
const writes = new Map();
const expandedRows = new Set();
const liveRequests = new Set();
let lang = 'en';
const t = key => locales[lang][key] || key;
const visibleRows = () => rows.filter(r => SUPPORTED_PROVIDERS.has(r.provider || 'openrouter'));
const usd = n => money(n) === null ? t('unknown') : `US$${n.toFixed(5).replace(/0+$/, '').replace(/\.$/, '.00')}`;
const tokenSummary = r => `${t('input')} ${r.input_tokens ?? '—'} ${t('tokenUnit')} / ${t('output')} ${r.output_tokens ?? '—'} ${t('tokenUnit')}`;
function node(tag, cls, text) {
    const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n;
}
function button(text, fn) { const b = node('button', 'menu_button tl-button', text); b.type = 'button'; b.addEventListener('click', fn); return b; }
function warn(key) { globalThis.toastr?.warning(t(key), t('title')); }
async function api(route, body) {
    if (route === '/records') return storage.read();
    if (route === '/begin') {
        const row = { ...body, timestamp: new Date().toISOString(), schema_version: 2,
            cost: null, input_tokens: null, output_tokens: null, currency: 'USD', cost_source: 'unknown', status: 'pending' };
        await storage.update([row]); return row;
    }
    if (route === '/record') { await storage.update([body]); return body; }
    if (route === '/snapshot') {
        const result = await storage.post('/api/openrouter/credits', {});
        if (typeof result.remaining !== 'number' || !Number.isFinite(result.remaining)) throw new Error('Invalid balance');
        return { balance: result.remaining, total_used: money(result.total_usage), timestamp: new Date().toISOString() };
    }
    throw new Error('Unsupported operation');
}
function remember(row) { const i = rows.findIndex(x => x.id === row.id); if (i < 0) rows.unshift(row); else rows[i] = row; }
function persist(row) {
    // Serialize full snapshots per request so a late response cannot overwrite its message link.
    const data = { ...row };
    const next = (writes.get(row.id) || Promise.resolve()).catch(() => {}).then(async () => {
        try { await api('/record', data); unsaved.delete(row.id); }
        catch { unsaved.set(row.id, { ...row }); warn('saveError'); }
    });
    writes.set(row.id, next);
    void next.finally(() => { if (writes.get(row.id) === next) writes.delete(row.id); });
    remember(row);
    return next;
}
function chatIdentity(c) {
    const character = c.characters[c.characterId];
    return { character: character?.name || '', character_id: character?.avatar || '',
        chat_name: String(c.chatId || ''), chat_id: JSON.stringify([character?.avatar || '', c.groupId || '', c.chatId || '']) };
}

function installCollector() {
    const c = context(), on = (name, fn) => { if (c.eventTypes[name]) c.eventSource.on(c.eventTypes[name], fn); };
    let observedChatId = null, observedMessageIds = new Set();
    function observeMessages(deleted = false) {
        const current = context(), chatId = chatIdentity(current).chat_id;
        const ids = new Set(current.chat.map(m => m.tavern_ledger_id).filter(Boolean));
        // Only mark IDs actually observed before a deletion in this same chat.
        // Switching chats or failing to locate a reply is not evidence of deletion.
        if (deleted && observedChatId === chatId) {
            for (const row of rows) {
                if (row.chat_id === chatId && observedMessageIds.has(row.message_id)
                    && !ids.has(row.message_id) && !row.message_deleted) {
                    row.message_deleted = true;
                    void persist(row);
                }
            }
        }
        observedChatId = chatId;
        observedMessageIds = ids;
    }
    observeMessages();
    on('GENERATION_STARTED', (type, _options, dryRun) => {
        if (dryRun) return;
        run = { kind: type === 'continue' ? 'continue' : type === 'swipe' ? 'swipe' : type === 'quiet' ? 'quiet' : 'normal',
            chat: context().chat, identity: chatIdentity(context()), records: [] };
    });
    on('GENERATION_ENDED', () => { run = null; });
    on('MESSAGE_RECEIVED', async (index, type) => {
        const active = run, c = context();
        if (!active || active.chat !== c.chat || active.kind === 'quiet' || type === 'first_message') return;
        const records = active.records.filter(r => !r.message_id);
        const message = c.chat[index];
        if (!message || message.is_user || !records.length) return;
        message.tavern_ledger_id ||= crypto.randomUUID();
        message.extra ||= {};
        const previous = message.extra[NAME];
        const candidateId = active.kind === 'continue' && previous?.candidate_id ? previous.candidate_id : crypto.randomUUID();
        message.extra[NAME] = { candidate_id: candidateId };
        if (message.swipe_info?.[message.swipe_id]) {
            message.swipe_info[message.swipe_id].extra ||= {};
            message.swipe_info[message.swipe_id].extra[NAME] = { candidate_id: candidateId };
        }
        for (const row of records) {
            Object.assign(row, { message_id: message.tavern_ledger_id, candidate_id: candidateId,
                reply_number: c.chat.slice(0, Number(index) + 1).filter(m => !m.is_user && !m.is_system).length,
                swipe_index: message.swipe_id || 0 });
            void persist(row);
        }
        observeMessages();
        try { await c.saveChat(); } catch { warn('saveError'); }
        paintBadges(); render();
    });
    for (const event of ['CHARACTER_MESSAGE_RENDERED', 'MESSAGE_SWIPED', 'MESSAGE_DELETED', 'CHAT_CHANGED']) {
        on(event, () => {
            observeMessages(event === 'MESSAGE_DELETED');
            paintBadges(); render();
            if (event === 'CHAT_CHANGED') void refresh();
        });
    }
    // ST discards the raw usage object before its message events. Observe a clone only:
    // preserve the original request, response, status, stream and abort behavior.
    window.fetch = async function (input, options) {
        let body;
        const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
        try { body = typeof options?.body === 'string' ? JSON.parse(options.body) : null; } catch { /* Not JSON */ }
        const endpoint = new URL(url, location.href);
        const provider = body?.chat_completion_source;
        if (endpoint.origin !== location.origin || endpoint.pathname !== '/api/backends/chat-completions/generate'
            || !SUPPORTED_PROVIDERS.has(provider)) return originalFetch(input, options);
        // Group chats and multi-choice batches need a separate association strategy.
        const active = run?.chat === context().chat && !context().groupId ? run : null;
        const isolated = liveRequests.size === 0;
        const before = isolated ? await api('/snapshot', {}).catch(() => null) : null;
        const row = { id: crypto.randomUUID(), provider, model: body.model, secret_id: typeof body.secret_id === 'string' ? body.secret_id : null,
            ...(active?.identity || chatIdentity(context())), kind: active?.kind || 'quiet', timestamp: new Date().toISOString(), schema_version: 2,
            cost: null, input_tokens: null, output_tokens: null, currency: 'USD', cost_source: 'unknown', status: 'pending', isolated };
        void persist(row);
        if (active && !(body.n > 1)) active.records.push(row);
        liveRequests.add(row.id);
        remember(row);
        try {
            const response = await originalFetch(input, options);
            const observed = response.clone();
            void (async () => {
                try {
                    if (response.ok) {
                        await readUsage(observed, data => {
                            if (typeof data.id === 'string') row.request_id = data.id;
                            const usage = usageFrom(data, provider);
                            for (const [key, value] of Object.entries(usage)) {
                                if (value !== null && !(key === 'cost_source' && value === 'unknown' && row.cost_source === 'provider')) row[key] = value;
                            }
                            // Save generation ID early, including interrupted streams.
                            if (row.request_id && !row.id_saved) { row.id_saved = true; void persist(row); }
                        });
                        row.status = 'complete';
                    } else { row.status = 'failed'; await observed.body?.cancel(); }
                } catch { row.status = 'interrupted'; }
                void refreshBalanceAfterGeneration();
                paintBadges(); render(); await recoverCost(row, before);
                delete row.isolated; liveRequests.delete(row.id); paintBadges(); render(); await persist(row);
            })();
            return response;
        } catch (e) {
            row.status = e.name === 'AbortError' ? 'interrupted' : 'failed';
            liveRequests.delete(row.id);
            void refreshBalanceAfterGeneration();
            void persist(row); throw e;
        }
    };
}

async function refresh() {
    try {
        await Promise.all([...unsaved.values()].map(persist));
        const latest = await api('/records');
        // Keep pending in-flight row objects; stream observers still hold their references.
        const local = new Map(rows.filter(r => writes.has(r.id) || unsaved.has(r.id) || liveRequests.has(r.id)).map(r => [r.id, r]));
        rows = latest.map(r => local.get(r.id) || r);
        for (const r of local.values()) if (!rows.some(x => x.id === r.id)) rows.push(r);
        connected = true;
    } catch { connected = false; }
    paintBadges(); render();
    const status = document.getElementById('tl-status'); if (status) status.textContent = t(connected ? 'ready' : 'offline');
}
async function sync() {
    if (syncInFlight) return syncInFlight;
    syncInFlight = (async () => {
        try { snapshot = await api('/snapshot', {}); }
        catch { snapshot = { unavailable: true, timestamp: new Date().toISOString() }; }
        updateSettingsBalance();
        render();
    })().finally(() => { syncInFlight = null; });
    return syncInFlight;
}
async function refreshBalanceAfterGeneration() {
    // A lookup started before completion may still contain the previous balance.
    if (syncInFlight) await syncInFlight;
    void sync();
    clearTimeout(balanceFollowupTimer);
    // One bounded follow-up allows for delayed provider accounting; no idle polling.
    balanceFollowupTimer = setTimeout(() => { void sync(); }, 15000);
}
const wait = delay => new Promise(resolve => setTimeout(resolve, delay));
async function recoverCost(row, before) {
    if (money(row.cost) !== null || !row.isolated || money(before?.total_used) === null) return;
    let after = null;
    for (const delay of [2000, 5000, 15000]) {
        await wait(delay);
        try {
            after = await api('/snapshot', {});
            const delta = costFromSnapshots(before, after);
            if (delta > 0) {
                row.cost = delta; row.cost_source = 'accountDelta';
                return;
            }
        } catch { /* Keep the record unconfirmed and retry. */ }
    }
    if (String(row.model || '').includes(':free') && costFromSnapshots(before, after) === 0) {
        row.cost = 0; row.cost_source = 'accountDelta';
    }
}
async function locate(row) {
    try {
        let c = context();
        const find = () => context().chat.findIndex(m => m.tavern_ledger_id === row.message_id);
        if (find() < 0) {
            const id = c.characters.findIndex(x => x.avatar === row.character_id);
            if (id < 0 || !row.chat_name) return warn('missing');
            if (Number(c.characterId) !== id) await c.selectCharacterById(id);
            await context().openCharacterChat(row.chat_name);
        }
        c = context();
        const index = find();
        if (index < 0) return warn('missing');
        const element = document.querySelector(`#chat .mes[mesid="${index}"]`);
        if (!element) return warn('missing');
        dialog?.close(); element.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' });
        element.classList.add('tl-highlight'); setTimeout(() => element.classList.remove('tl-highlight'), 2400);
        // Do not change the selected swipe: the ledger shows the recorded candidate number.
    } catch { warn('missing'); }
}
function paintBadges() {
    document.querySelectorAll('.tl-badge').forEach(x => x.remove());
    const c = context();
    c.chat.forEach((m, index) => {
        if (!m.tavern_ledger_id) return;
        const all = visibleRows().filter(r => r.message_id === m.tavern_ledger_id);
        const candidate = m.extra?.[NAME]?.candidate_id;
        const selected = all.filter(r => r.candidate_id === candidate);
        if (!all.length) return;
        const target = document.querySelector(`#chat .mes[mesid="${index}"] .mes_block`);
        if (!target) return;
        const details = node('details', 'tl-badge');
        const sum = summarize(selected), total = summarize(all);
        details.append(node('summary', '', `${t('candidate')}: ${usd(sum.total)}${sum.unknown ? ' + ?' : ''} · ${t('continue')} ×${selected.filter(r => r.kind === 'continue').length} · ${t('allCandidates')}: ${usd(total.total)}${total.unknown ? ' + ?' : ''}`));
        details.append(node('small', '', t('subset')));
        let continuation = 0;
        for (const r of [...selected].sort((a, b) => a.timestamp.localeCompare(b.timestamp))) {
            const label = r.kind === 'continue' ? `${t('continue')} ${++continuation}` : t(r.kind);
            details.append(node('div', '', `${label} · ${usd(r.cost)} · ${t(r.cost_source)} · ${tokenSummary(r)}`));
        }
        target.append(details);
    });
}
function render() {
    if (!dialog?.open) return;
    // Polling must not collapse details or interrupt typing in the search field.
    if (document.activeElement?.classList.contains('tl-search')) return;
    const content = dialog.querySelector('.tl-content'); content.replaceChildren();
    if (!connected) content.append(node('p', 'tl-warning', t('offline')));
    if (unsaved.size) content.append(node('p', 'tl-warning', t('saveError')));
    const shownRows = visibleRows();
    const sum = summarize(shownRows), cards = node('div', 'tl-cards');
    for (const key of ['today', 'week', 'month', 'total']) {
        const card = node('div', 'tl-card'); card.append(node('small', '', t(key)), node('strong', '', usd(sum[key]))); cards.append(card);
    }
    content.append(cards);
    const current = shownRows.filter(r => r.chat_id === chatIdentity(context()).chat_id);
    content.append(node('p', 'tl-muted', `${t('localChat')}: ${usd(summarize(current).total)} · ${sum.unknown} ${t('unknownCount')}`));
    const account = node('section', 'tl-account'); account.append(node('h3', '', t('account')), button(t('sync'), sync));
    if (snapshot) {
        for (const [key, value] of [['balance', snapshot.unavailable ? t('unavailable') : `US$${snapshot.balance.toFixed(4)}`],
            ['accountUsed', usd(snapshot.total_used)],
            ['lastSync', new Date(snapshot.timestamp).toLocaleString(lang)]]) {
            account.append(node('div', 'tl-account-row', `${t(key)}: ${value}`));
        }
    }
    account.append(node('p', 'tl-muted', t('accountScope')));
    account.append(node('p', 'tl-muted', t('queryLimit')));
    content.append(account, node('p', 'tl-muted', t('coverage')), node('p', 'tl-muted', t('tokenHelp')), node('p', 'tl-muted', t('timezone')));
    const search = node('input', 'text_pole tl-search'); search.placeholder = t('filter'); search.setAttribute('aria-label', t('filter')); search.value = filter;
    search.addEventListener('input', () => { filter = search.value; renderList(list); });
    const list = node('div', 'tl-list'); content.append(search, list); renderList(list);
}
function renderList(list) {
    list.replaceChildren();
    const filtered = visibleRows().filter(r => [r.character, r.chat_name, r.model, r.provider].join(' ').toLowerCase().includes(filter.toLowerCase()));
    if (!filtered.length) list.append(node('p', 'tl-muted', t('empty')));
    for (const r of filtered.slice(0, 500)) {
        const item = node('details', 'tl-row'), heading = node('summary', '');
        item.open = expandedRows.has(r.id);
        item.addEventListener('toggle', () => {
            if (!item.isConnected) return;
            if (item.open) expandedRows.add(r.id); else expandedRows.delete(r.id);
        });
        const identity = node('span', 'tl-identity', `${r.character || '—'} / ${r.chat_name || '—'}`);
        if (r.message_deleted) identity.append(node('small', 'tl-muted', t('deleted')));
        identity.append(node('small', 'tl-muted', `${r.message_id ? `${t('reply')} #${r.reply_number} · ${t('candidate')} ${(r.swipe_index ?? 0) + 1}` : t('unlinked')} · ${t(r.kind)}`));
        heading.append(identity, node('strong', '', usd(r.cost)));
        item.append(heading, node('div', 'tl-muted', `${new Date(r.timestamp).toLocaleString(lang)} · ${t(r.provider || 'openrouter')} · ${r.model || '—'}`),
            node('div', '', t(r.status)),
            node('div', '', `${tokenSummary(r)} · ${t(r.cost_source)}`));
        if (!r.message_id) item.append(node('small', 'tl-muted', t('unlinkedHelp')));
        if (r.status === 'interrupted') item.append(node('small', 'tl-muted', t('interruptedHelp')));
        const actions = node('div', 'tl-actions');
        if (r.message_id && !r.message_deleted) actions.append(button(t('locate'), () => locate(r)));
        if (r.cost === null) item.append(node('small', 'tl-muted', t('costLimit')));
        item.append(actions); list.append(item);
    }
    if (filtered.length > 500) list.append(node('p', 'tl-muted', `${Math.min(500, filtered.length)} / ${filtered.length}`));
}
function open() {
    if (!dialog) {
        dialog = node('dialog', 'tl-dialog'); dialog.setAttribute('aria-label', 'Tavern Ledger');
        const header = node('header', 'tl-header'); header.append(node('h2', '', 'Tavern Ledger'));
        const toolbar = node('div', 'tl-actions');
        toolbar.append(button(t('refresh'), refresh), button(t('export'), () => {
            const url = URL.createObjectURL(new Blob([JSON.stringify({ version: 2, records: rows }, null, 2)], { type: 'application/json' }));
            const a = node('a'); a.href = url; a.download = `tavern-ledger-${new Date().toISOString().slice(0, 10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
        }), button(t('close'), () => dialog.close()));
        header.append(toolbar); dialog.append(header, node('p', 'tl-muted', t('exportPrivacy')), node('main', 'tl-content')); document.body.append(dialog);
    }
    if (!dialog.open) dialog.showModal(); render(); void refresh();
    void sync();
}
function start() {
    const c = context();
    c.extensionSettings[NAME] ||= {};
    lang = c.extensionSettings[NAME].language || 'en';
    if (!locales[lang]) lang = 'en';
    const panel = node('div', 'inline-drawer tl-settings');
    // Refresh when the extension settings become visible, including a saved-open drawer.
    const settingsObserver = new IntersectionObserver(entries => {
        if (!document.hidden && entries.some(entry => entry.isIntersecting)) void sync();
    });
    settingsObserver.observe(panel);
    globalThis.$?.(panel).on('inline-drawer-toggle.tavernLedger', () => {
        const icon = panel.querySelector('.inline-drawer-icon');
        const expanded = icon?.classList.contains('up') === true;
        c.extensionSettings[NAME].settingsOpen = expanded;
        c.saveSettingsDebounced();
        if (expanded) void sync();
    });
    const label = node('label', '', t('language'));
    const select = node('select', 'text_pole'); select.setAttribute('aria-label', t('language'));
    for (const [value, text] of [['en', 'English'], ['zh-TW', '繁體中文']]) {
        const option = node('option', '', text); option.value = value; select.append(option);
    }
    select.value = lang;
    select.addEventListener('change', () => {
        lang = select.value; c.extensionSettings[NAME].language = lang; c.saveSettingsDebounced();
        panel.remove(); dialog?.remove(); dialog = null; buildPanel(); paintBadges();
    });
    function buildPanel() {
        label.firstChild.textContent = t('language');
        select.setAttribute('aria-label', t('language'));
        const expanded = c.extensionSettings[NAME].settingsOpen === true;
        const summary = node('div', 'inline-drawer-toggle inline-drawer-header');
        summary.append(node('b', '', 'Tavern Ledger · 酒館帳本'));
        const icon = node('div', `inline-drawer-icon fa-solid ${expanded ? 'fa-circle-chevron-up up' : 'fa-circle-chevron-down down'}`);
        icon.setAttribute('aria-hidden', 'true');
        summary.append(icon);
        const body = node('div', 'inline-drawer-content tl-settings-body');
        body.style.display = expanded ? 'block' : 'none';
        const quickBalance = node('div', 'tl-quick-balance');
        const balanceValue = node('strong');
        updateSettingsBalance = () => {
            balanceValue.textContent = snapshot
                ? (snapshot.unavailable ? t('unavailableShort') : `US$${snapshot.balance.toFixed(4)}`)
                : t('none');
        };
        updateSettingsBalance();
        quickBalance.append(node('span', '', t('balance')), balanceValue, button(t('sync'), sync));
        body.append(quickBalance, label, button(t('open'), open));
        panel.replaceChildren(summary, body);
        const status = node('p', 'tl-muted', t(connected ? 'ready' : 'offline')); status.id = 'tl-status'; body.append(status);
        const importInput = node('input'); importInput.type = 'file'; importInput.accept = '.json'; importInput.hidden = true;
        importInput.addEventListener('change', async () => {
            try {
                const file = importInput.files[0]; if (!file) return;
                const records = await readImportFile(file);
                const result = await storage.update(records, { preserveExisting: true });
                await refresh();
                globalThis.toastr?.success(t('importResult').replace('{added}', result.added).replace('{skipped}', result.skipped), t('title'));
            } catch (error) {
                warn(['importInvalid', 'importTooLarge', 'importTooMany'].includes(error.message) ? error.message : 'error');
            }
            importInput.value = '';
        });
        body.append(button(t('import'), () => importInput.click()), importInput);
        (document.getElementById('extensions_settings2') || document.getElementById('extensions_settings')).append(panel);
    }
    label.append(select); buildPanel(); installCollector(); void refresh();
    setInterval(() => {
        if (!document.hidden && dialog?.open) void refresh();
    }, 15000);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) void refresh();
    });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
