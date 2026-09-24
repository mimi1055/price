# Tavern Ledger v1.0.0

English | [繁體中文](README.zh-TW.md)

An OpenRouter spending ledger for SillyTavern, with English and Traditional Chinese interfaces.

## Installation

In SillyTavern, open **Extensions → Install extension** and paste:

```text
https://github.com/mimi1055/price
```

Refresh the page after installation.

### Manual installation

If the built-in installer is unavailable, run this from the SillyTavern directory:

```bash
cd public/scripts/extensions/third-party
git clone https://github.com/mimi1055/price.git
```

Refresh SillyTavern when the clone finishes.

## Quick start

1. Configure a standard OpenRouter API key in SillyTavern. A management key is not required.
2. Select **Chat Completion → OpenRouter** and generate a reply.
3. Open **Extensions → Tavern Ledger · 酒館帳本** to view account information.
4. Select **Open ledger** to review daily, weekly, monthly and individual generation records.
5. If a cost has not appeared, wait about 15 seconds or run a manual refresh.

## Features

- Refresh the OpenRouter balance after a response, with one follow-up after 15 seconds for delayed charges. Opening extension settings or the ledger also refreshes it; manual refresh remains available.
- View recorded daily, weekly and monthly spending.
- Export an XLSX spreadsheet with monthly totals, model totals and individual records. Editing the exported copy does not change the ledger; use JSON for backup and import.
- Track chats, models, tokens, regenerations and continuation costs.
- Search details and locate replies; detected deletions are marked while keeping cost records.
- Export and import JSON: up to 10 MB and 20,000 records per import; existing duplicates are preserved.

## Compatibility and scope

| Environment or feature | Status |
| --- | --- |
| OpenRouter Chat Completion | Supported |
| Other API providers / Text Completion | Not supported |
| Cost tracking on SillyTavern 1.17.0 | Supported |
| Account balance lookup on SillyTavern 1.17.0 | Not supported |
| Group chats and batched choices | Recorded, but reply linking may be incomplete |
| Phone and desktop using the same server and user | Share one ledger |

Only confirmed compatibility results are listed. Other SillyTavern versions still require testing.

## Data storage and backups

- The ledger uses SillyTavern's per-user server file storage. It is saved as `tavern-ledger-v2.json` and does not use a browser database.
- Devices signed in to the same SillyTavern server as the same user share one ledger. Different users have separate data.
- Avoid generating or importing records simultaneously from multiple devices because concurrent writes may conflict.
- Updating or removing the extension does not actively delete the ledger file. Export a JSON backup before moving, reinstalling or clearing data.
- Hosted environments such as Railway must persist the SillyTavern user data directory, or the ledger may disappear after a redeploy.
- API keys and conversation text are not saved. Exports contain character names, chat names and usage records; review them before sharing.

## Updating and removing

- **Update:** update Tavern Ledger from SillyTavern's **Manage Extensions** screen, then refresh the page.
- **Remove:** remove it from **Manage Extensions**. The extension does not actively delete its ledger file.
- **Clear the ledger:** export any records you want to keep, then remove `tavern-ledger-v2.json` from that SillyTavern user's files directory.

## Frequently asked questions

### Why is the account balance unavailable?

Check that SillyTavern is connected to OpenRouter. A standard API key can still be used for chat and per-generation cost tracking. Account balance lookup is unavailable on SillyTavern 1.17.0.

### Why does the ledger total differ from my OpenRouter account usage?

OpenRouter account balance and total usage may include spending from other taverns, devices or applications on the same account. Ledger totals only include records captured or imported into this ledger.

### Why is a cost marked unconfirmed?

When a provider response has no official cost, the extension may try to recover it from the change in account usage. Other spending and delayed charges can prevent confirmation. Unconfirmed costs are excluded from totals.

### Why does a cost remain after I delete a chat?

The ledger represents API spending that already occurred, so deleting a chat does not erase its cost. If a linked reply is deleted, its record remains and is marked accordingly.

### Why did a new cost not appear immediately?

OpenRouter charge information can be delayed. The extension checks after the response and once again about 15 seconds later. You can also refresh manually.

### Why did my data disappear after a Railway redeploy?

Make sure the deployment persists SillyTavern's user data directory. The ledger is stored with server-side user data, and an ephemeral filesystem is cleared during redeployment.

## Reporting issues

Report problems through [GitHub Issues](https://github.com/mimi1055/price/issues) and include:

- SillyTavern version
- Browser and device
- Model used
- Error message and reproduction steps

Never publish an API key. Before attaching an export, review its character names, chat names and usage records.

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## License

This project is licensed under the [MIT License](LICENSE).
