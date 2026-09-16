# Tavern Ledger v1.0.0

English | [繁體中文](README.zh-TW.md)

An OpenRouter spending ledger for SillyTavern, with English and Traditional Chinese interfaces.

## Installation

In SillyTavern, open **Extensions → Install extension** and paste:

```text
https://github.com/mimi1055/price
```

Refresh after installation, connect via **Chat Completion → OpenRouter**, and expand **Tavern Ledger · 酒館帳本** in extension settings.

Use a standard API key; no management key is needed. **Balance lookup is unavailable on ST 1.17.0.**

## Features

- Refresh account balance when opening the extension settings or ledger, with a manual refresh button. View recorded daily, weekly and monthly spending.
- Track chats, models, tokens, regenerations and continuation costs.
- Search details and locate replies; detected deletions are marked while keeping cost records.
- Export/import JSON: up to 10 MB and 20,000 records per import; existing duplicates are kept.

## Notes

- Account balance and total usage include other taverns on the same account; ledger totals summarize recorded or imported entries.
- Missing provider costs may be recovered from account usage differences, which can be affected by other spending or delayed charges. Unconfirmed costs are excluded from totals.
- Devices sharing the same ST server and user share saved records. Avoid simultaneous writes and configure persistent storage on hosts such as Railway.
- No API keys or conversation text are saved. Exports include character/chat names and usage records; review privacy before sharing. Deleting chats does not erase ledger history.
- Supports OpenRouter Chat Completion; reply linking for group chats and batched choices may be incomplete.

