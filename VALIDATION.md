# v0.2 validation — 2026-09-12
npm test: 11 passing tests; npm run check passes.
Seven tests retain coverage of common logic and legacy v0.1 server code.
Four new storage tests verify:
- fresh phone/desktop adapters read the same ST file through native routes;
- same-page updates queue and identical record IDs merge;
- corrupt files are not overwritten;
- unknown cost survives roundtrip and HTTP errors are not empty ledgers.

Browser fixture rejects all /api/plugins/* requests.
Confirmed a streamed generation (US$0.0372), continuation (US$0.0744 total), floating-button open, native account balance and explicit unavailable-query notice.
A second fresh browser tab read both existing records and US$0.0744 without data copied from the first tab.
These are simulated ST endpoints, not a real ST installation.

Still outstanding: real ST/Railway persistence and permissions, actual OR credits/cost matching, cancellation, branch/rename behavior, other extension compatibility.
Cross-device simultaneous writes are explicitly unsupported, not a passing concurrency guarantee.

