# Tavern Ledger · 酒館帳本 v0.4.8
繁體中文（台灣）／English。SillyTavern 單一前端擴充，**不需要 Server Plugin，不需修改 config.yaml，也不需 npm install**。

## 安裝
ST → 擴充功能 → 安裝擴充功能 → 貼上 https://github.com/mimi1055/price → 安裝 → 重新整理。
安裝連結：https://github.com/mimi1055/price 。專案根目錄已包含 ST 所需的 manifest.json。

本機測試可將 ZIP 內容放到 ST 的 public/scripts/extensions/third-party/tavern-ledger/，manifest.json 必須直接位於該資料夾。
**不要將 v0.2 安裝到 plugins 資料夾。** 舊版 Server Plugin 已不再是執行依賴。

## 操作
- 從 ST 擴充設定展開「Tavern Ledger · 酒館帳本」，即可直接查看餘額或開啟完整帳本。
- ST 擴充設定可切換繁體中文／English。
- ST 擴充設定區使用 SillyTavern 原生的圓形箭頭抽屜，可展開或收合並記住目前狀態。
- 展開擴充設定後會直接顯示自動查詢的 OpenRouter 帳戶餘額；開啟帳本才顯示完整統計與逐則明細。此版本不使用懸浮按鈕。
- 餘額會在生成完成後自動查詢，並於 15 秒後補查一次；展開設定、開啟帳本、回到分頁時也會更新，頁面使用期間每 60 秒定時更新。
- 使用 Chat Completion → OpenRouter。串流與非串流皆記錄回應中的官方 tokens／cost。
- 保留角色、聊天室、生成時 AI 回覆編號、候選識別、時間、模型、滑動與續寫明細。
- 續寫累加到同一候選，可展開看續寫 1、續寫 2 等費用；重抽候選分別計算。
- 刪除回覆不會刪除帳本。分支／複製聊天歷史不會新增費用。
- 查看回覆會定位原訊息，不會自動切換候選。聊天／角色改名、訊息刪除或未載入畫面時可能無法定位。
- 日／週／月支出、聊天室合計、搜尋、JSON 匯出／匯入；清單顯示前 500 筆，總額與匯出包含所有已載入紀錄。

## 手機與電腦：同一網址就是同一份帳本嗎？
**同一 ST 伺服器、同一個使用者，讀取同一份已保存的帳本。**
帳本位於 ST 使用者目錄的 files/tavern-ledger-v2.json，不在瀏覽器 localStorage 或 IndexedDB。
例如手機生成並存檔後，電腦開啟帳本／按重新整理就會看到。無須另外註冊同步服務。
畫面在開啟帳本、回到分頁、切換聊天室時重新讀取，帳本展開時每 15 秒更新。

本版支援日常交替使用裝置。**兩台裝置同時生成或匯入帳本，仍可能發生寫入覆蓋**：ST 原生檔案介面沒有跨裝置交易鎖。本版會在寫入前重新讀取合併，並序列化同分頁的更新，但不宣稱能保證兩台同時寫入。這和「換裝置讀不到資料」是兩件事。

Railway 需持久化 ST 實際使用的資料目錄（Volume）；帳本跟其他 ST 資料一起保存。單一網址不代表重部署時會自動保留未掛載的磁碟。這版不用額外安裝後端。

## OR 查詢範圍：與舊版的差異
- 帳戶餘額與帳戶累計用量：呼叫 ST 內建 /api/openrouter/credits，由 ST 處理 Key。依 ST 版本與 OR 權限可能無法查詢。
- 每次生成費用：從原回應的 usage.cost 取得，不需要另查。
- **個別 Key 剩餘額度、官方日／週／月用量、缺失生成費用補查：目前不提供。** ST 沒有現成介面；畫面會說明限制。帳本日／週／月數字只代表本帳本記錄的支出，不能當作 Key 全部用量。
- 沒取得費用就顯示「待確認」，不當作零、不用餘額差推算每則費用。
- 不要求輸入第二把 Key、不讀取完整 Key、不保存提示詞或聊天全文。
- 本版不是 0.1 所有查詢能力的等價替代；單一連結安裝已完成架構調整，完整官方 Key 查詢仍有能力缺口。

## 舊版資料
已使用 0.1 者，先用舊版匯出 JSON，再於新版擴充設定按「匯入帳本 JSON」。相同紀錄 ID 合併，不重複記帳。
原本伺服器的 tavern-ledger/v1/ 紀錄及 0.1 ZIP 不會被自動刪除或改寫。
匯入功能接受本專案匯出的 version 1／2 格式。

## 測試與已知範圍
- 單一 ST 使用者、直接 OpenRouter Chat Completion。群组／多候選批次／工具背景請求不保證可靠回覆關聯；Text Completion、圖片、自訂代理不支援。
- 無歷史費用回填，無自動估算。帳本全量讀寫，適合個人小型使用，尚未針對大型資料最佳化。
- 網路或儲存失敗時會提示；保持分頁開啟並重新整理以重試。關閉分頁可能失去未保存更新。
- 尚未在真實 ST／Railway／OR 付費 API 驗收。
- 開發：npm test、npm run check、node tests/preview-server.mjs。預覽 http://127.0.0.1:8787 為模擬資料。
- repository 的 server/ 與部分測試保留供舊版參考，新版 index.js 不呼叫它們，發布 ZIP 不包含後端。

## English
A single SillyTavern UI extension with Traditional Chinese (Taiwan) and English.
Install https://github.com/mimi1055/price using ST's Install Extension dialog and refresh. **No Server Plugin, config edit, or npm install is required.**

Records live in the current ST user's files/tavern-ledger-v2.json using ST's existing file API. Phone and desktop connecting to the same ST server/user read the same saved data. Open/refresh the ledger to see updates; no separate cloud-sync service. Persist ST's actual data directory on Railway using a Volume.

Designed for alternating devices, not simultaneous writers: same-page writes are serialized and updates merge the latest file, but ST's file API provides no cross-device transaction lock. Concurrent generation/import on two devices can overwrite updates.

Features: streamed/non-streamed OpenRouter costs/tokens, character/chat/reply/candidate links, continuation details, all-candidate totals, reply navigation, period totals, search, JSON export/import. Deleting a message retains its cost; copied history is not billed again. Reply navigation does not change the selected candidate. Renaming/deleting/unrendered messages may prevent navigation.

The current release intentionally supports OpenRouter only. Records retain a provider field and usage parsing has a provider boundary so future providers can be added without changing the ledger file format.

Account balance uses ST's built-in credits endpoint and may fail due to version/permissions. **Individual-key allowance, official key usage periods and generation-cost rechecks are currently unavailable.** The interface explains these gaps. Ledger totals are local recorded spend, not all key activity. Missing cost remains unconfirmed. No raw keys or conversation content are stored.

Import v0.1 exports through extension settings; old files are not modified. Direct OpenRouter Chat Completion only; group and multi-choice links are unsupported. Live ST/Railway/OR acceptance testing is still outstanding.

