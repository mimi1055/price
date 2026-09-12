# Tavern Ledger v0.2 — single ST extension

## Installation boundary
manifest.json loads index.js and style.css. No plugin entry point, backend dependency or enableServerPlugins setting.
server/ is retained legacy source only; no runtime reference from the frontend. The v0.1 ZIP is preserved.

## Storage
lib/st-storage.mjs uses ST native GET /files/tavern-ledger-v2.json, POST /api/files/verify, POST /api/files/upload.
The existing ST authenticated server owns file persistence and uses its current user's directories. Native upload performs atomic file replacement. The frontend queues read/merge/write updates within one page. JSON has schema_version 2 and records keyed by UUID. Unicode is encoded to UTF-8 before base64 upload.
A 404 is treated as a new ledger only after native verify confirms absence. Invalid/corrupt data aborts updates instead of replacing history.
Two different devices read the same saved file. This is server storage, not device-to-device replication.
**No cross-device compare-and-swap or lock exists. Simultaneous writes can still race.** Do not describe this implementation as transactionally safe across devices. A custom backend would be needed for stronger guarantees, but is intentionally not a dependency in v0.2.
Export/import preserves UUIDs and merges records; v0.1 exports are accepted. ST extension settings hold only UI preferences.

## Collection and UI
ST generation lifecycle captures character/chat/kind. A clone of same-origin OpenRouter Chat Completion responses yields official usage. Original request and response remain available to ST. Stable message/candidate IDs associate swipe/continuation records.
The floating button opens a native dialog. Language and button visibility live in ST settings. Opening, tab activation and chat changes reload saved records; an open ledger refreshes every 15 seconds.
Dates use the viewing device's timezone, weeks start Monday. Historical reply numbers are display labels, not identity.

## Query capabilities
Account credits use ST's existing /api/openrouter/credits route, which handles its saved Key.
Individual key allowance/usage and generation reconciliation are unavailable without additional host endpoints. UI explains the capability gap; no fabricated zero or estimated official data. secret_id (if present) is a non-secret ST selection identifier, not an account fingerprint.
No raw keys, prompts or message text are stored. Local record reports are not tamper-proof billing data.

## References verified 2026-09-12
- https://github.com/SillyTavern/SillyTavern/blob/release/src/endpoints/files.js
- https://github.com/SillyTavern/SillyTavern/blob/release/src/endpoints/openrouter.js
- https://github.com/SillyTavern/SillyTavern/blob/release/public/scripts/chats.js
- https://github.com/SillyTavern/SillyTavern/blob/release/public/scripts/openai.js
- https://github.com/SillyTavern/SillyTavern/blob/release/src/util.js
Mutable release branch inspection and fixtures do not establish live ST compatibility.

