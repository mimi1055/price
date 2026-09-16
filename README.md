# Tavern Ledger · 酒館帳本 v1.0.0
初版。支援繁體中文（台灣）／English，直接透過 SillyTavern 擴充功能安裝即可。

## 安裝
ST → 擴充功能 → 安裝擴充功能 → 貼上 https://github.com/mimi1055/price → 安裝 → 重新整理。
安裝連結：https://github.com/mimi1055/price 。專案根目錄已包含 ST 所需的 manifest.json。

在 ST 設定一般 OpenRouter API Key 即可，無須建立或提供管理 Key。
**SillyTavern 1.17.0 無法使用餘額查詢功能。**

## 操作
- 從 ST 擴充設定展開「Tavern Ledger · 酒館帳本」，即可直接查看餘額或開啟完整帳本。
- ST 擴充設定可切換繁體中文／English。
- ST 擴充設定區使用 SillyTavern 原生的圓形箭頭抽屜，可展開或收合並記住目前狀態。
- 展開擴充設定後會直接顯示自動查詢的 OpenRouter 帳戶餘額；開啟帳本才顯示完整統計與逐則明細。此版本不使用懸浮按鈕。
- 餘額會在生成完成後自動查詢，並於 15 秒後補查一次；展開設定、開啟帳本、回到分頁時也會更新，頁面使用期間每 60 秒定時更新。
- 使用 Chat Completion → OpenRouter。串流與非串流皆記錄回應中的官方 tokens／cost。
- 保留角色、聊天室、生成時 AI 回覆編號、候選識別、時間、模型、滑動與續寫明細。
- 續寫累加到同一候選，可展開看續寫 1、續寫 2 等費用；重抽候選分別計算。
- 偵測到回覆刪除時標示「已刪除」，保留費用紀錄。先前或其他裝置的刪除不保證能辨識。分支／複製聊天歷史不會新增費用。
- 查看回覆會定位原訊息，不會自動切換候選。聊天／角色改名、訊息刪除或未載入畫面時可能無法定位。
- 日／週／月支出、聊天室合計、搜尋、JSON 匯出／匯入；清單顯示前 500 筆，總額與匯出包含所有已載入紀錄。

## 手機與電腦：同一網址就是同一份帳本嗎？
**同一 ST 伺服器、同一個使用者，讀取同一份已保存的帳本。**
帳本位於 ST 使用者目錄的 files/tavern-ledger-v2.json，不在瀏覽器 localStorage 或 IndexedDB。
例如手機生成並存檔後，電腦開啟帳本／按重新整理就會看到。無須另外註冊同步服務。
畫面在開啟帳本、回到分頁、切換聊天室時重新讀取，帳本展開時每 15 秒更新。

本版支援日常交替使用裝置。**兩台裝置同時生成或匯入帳本，仍可能發生寫入覆蓋**：ST 原生檔案介面沒有跨裝置交易鎖。本版會在寫入前重新讀取合併，並序列化同分頁的更新，但不宣稱能保證兩台同時寫入。這和「換裝置讀不到資料」是兩件事。

Railway 需持久化 ST 實際使用的資料目錄（Volume）；帳本跟其他 ST 資料一起保存。單一網址不代表重部署時會自動保留未掛載的磁碟。這版不用額外安裝後端。

## OpenRouter 費用統計範圍
- 帳戶餘額與帳戶累計用量：呼叫 ST 內建 /api/openrouter/credits，由 ST 處理 Key。依 ST 版本與 OR 權限可能無法查詢。
- 每次生成費用：從原回應的 usage.cost 取得，不需要另查。
- **個別 Key 剩餘額度、官方日／週／月用量、缺失生成費用補查：目前不提供。** ST 沒有現成介面；畫面會說明限制。帳本日／週／月數字只代表本帳本記錄的支出，不能當作 Key 全部用量。
- 未收到官方費用時，會嘗試以生成前後的帳戶用量差額補算；其他地方同時消費或扣款延遲可能影響結果。仍無法取得時顯示「待確認」，不計入合計。
- 不要求輸入第二把 Key、不讀取完整 Key、不保存提示詞或聊天全文。
- 帳戶餘額與帳戶累計用量可能包含其他酒館、裝置及同帳戶其他 Key 的使用。聊天明細顯示本酒館記錄或使用者匯入的請求。

## 匯出、匯入與隱私
在帳本按「匯出 JSON」備份；在擴充設定按「匯入帳本 JSON」匯入。
每次匯入上限 10 MB、20,000 筆。會驗證日期、金額及欄位型別與長度，忽略額外欄位；重複 ID 保留既有紀錄，完成後顯示新增／略過筆數。格式不符時不匯入任何紀錄。
帳本與匯出檔包含角色名、聊天室名、使用時間、模型與費用，分享前請確認隱私。刪除聊天不會自動刪除帳本歷史資料。

## 測試與已知範圍
- 單一 ST 使用者、直接 OpenRouter Chat Completion。群组／多候選批次／工具背景請求不保證可靠回覆關聯；Text Completion、圖片、自訂代理不支援。
- 無歷史費用回填。帳本全量讀寫，適合個人小型使用，尚未針對大型資料最佳化。
- 網路或儲存失敗時會提示；保持分頁開啟並重新整理以重試。關閉分頁可能失去未保存更新。

## English
Version 1.0.0 — initial release. A SillyTavern extension with Traditional Chinese (Taiwan) and English.
Install https://github.com/mimi1055/price using ST's Install Extension dialog and refresh. Use a standard OpenRouter API key; no management key or additional backend is required. **Account balance lookup is unavailable on SillyTavern 1.17.0.**

Records live in the current ST user's files/tavern-ledger-v2.json using ST's existing file API. Phone and desktop connecting to the same ST server/user read the same saved data. Open/refresh the ledger to see updates; no separate cloud-sync service. Persist ST's actual data directory on Railway using a Volume.

Designed for alternating devices, not simultaneous writers: same-page writes are serialized and updates merge the latest file, but ST's file API provides no cross-device transaction lock. Concurrent generation/import on two devices can overwrite updates.

Features: streamed/non-streamed OpenRouter costs/tokens, character/chat/reply/candidate links, continuation details, all-candidate totals, reply navigation, period totals, search, JSON export/import. Deleting a message retains its cost; copied history is not billed again. Reply navigation does not change the selected candidate. Renaming/deleting/unrendered messages may prevent navigation.

The current release intentionally supports OpenRouter only. Records retain a provider field and usage parsing has a provider boundary so future providers can be added without changing the ledger file format.

Account balance and total usage may include other taverns, devices and keys on the same account. **Individual-key allowance, official key usage periods and generation-cost rechecks are currently unavailable.** Ledger totals summarize recorded or imported requests. Missing provider costs may be recovered from account usage differences; overlapping activity or delayed charges may affect accuracy. Costs that remain unconfirmed are excluded. No raw keys or conversation content are stored.

Imports accept up to 10 MB and 20,000 records, validate fields and discard unknown fields. Duplicate IDs preserve existing records; results report added and skipped counts. Invalid files are rejected before import. Exports contain character/chat names, timestamps, models and costs; review privacy before sharing. Observed message deletions are marked while retaining costs; earlier deletions or deletions on another device may not be detected. Direct OpenRouter Chat Completion only; group and multi-choice links are unsupported.

