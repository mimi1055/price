import { createHash } from 'node:crypto';
import { money } from '../lib/core.mjs';

export class OpenRouterProvider {
    constructor(key) { this.key = key; }
    get accountId() { return createHash('sha256').update(this.key).digest('hex').slice(0, 24); }
    async request(endpoint) {
        const response = await fetch(`https://openrouter.ai/api/v1/${endpoint}`, {
            headers: { Authorization: `Bearer ${this.key}` }, signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) { const error = new Error('OpenRouter request failed'); error.status = response.status; throw error; }
        return (await response.json()).data;
    }
    async snapshot() {
        const key = await this.request('key');
        let credits = null;
        let balance_status = 'unavailable';
        try { credits = await this.request('credits'); balance_status = 'available'; }
        catch (e) { balance_status = e.status === 403 ? 'permission' : 'unavailable'; }
        return { account_id: this.accountId, timestamp: new Date().toISOString(),
            remaining: money(key.limit_remaining), limit: money(key.limit), used: money(key.usage),
            daily: money(key.usage_daily), weekly: money(key.usage_weekly), monthly: money(key.usage_monthly),
            balance: credits && typeof credits.total_credits === 'number' && typeof credits.total_usage === 'number'
                ? credits.total_credits - credits.total_usage : null, balance_status };
    }
    async generation(id) {
        const data = await this.request(`generation?id=${encodeURIComponent(id)}`);
        return { cost: money(data.total_cost), input_tokens: money(data.native_tokens_prompt),
            output_tokens: money(data.native_tokens_completion), cost_source: money(data.total_cost) === null ? 'unknown' : 'provider' };
    }
}
