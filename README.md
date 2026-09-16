# Tavern Ledger · 酒館帳本 v1.0.0

SillyTavern 的 OpenRouter 費用帳本，支援繁體中文與 English。

## 安裝

酒館 → 擴充功能 → 安裝擴充功能，貼上：

```text
https://github.com/mimi1055/price
```

安裝後重新整理，使用 **Chat Completion → OpenRouter**，再展開「Tavern Ledger · 酒館帳本」。

只需一般 API Key，無須管理 Key。**ST 1.17.0 無法使用餘額查詢。**

## 功能

- 自動更新帳戶餘額，查看今日／本週／本月支出。
- 記錄聊天室、模型、tokens、重抽與續寫費用。
- 搜尋明細、定位回覆；偵測到回覆刪除時保留費用並標記。
- JSON 匯出／匯入；匯入上限 10 MB、20,000 筆，重複紀錄保留原資料。

## 注意事項

- 帳戶餘額與累計用量包含同帳戶其他酒館的使用；帳本統計則加總已記錄或匯入的明細。
- 缺少官方費用時會嘗試以帳戶扣款差額補算，可能受其他消費或扣款延遲影響；待確認費用不計入合計。
- 手機與電腦使用同一 ST 伺服器、同一使用者即可共用帳本，避免同時寫入。Railway 等部署需保存 ST 資料目錄。
- 不保存 API Key 或聊天全文；匯出檔含角色名、聊天室名與使用紀錄，分享前請確認隱私。刪除聊天不會清除帳本。
- 支援 OpenRouter Chat Completion；群組及批次候選的回覆關聯不保證完整。

## English

Install using the repository URL above in SillyTavern’s **Extensions → Install extension**, then refresh. Use **Chat Completion → OpenRouter** with a standard API key; no management key is needed. Balance lookup is unavailable on ST 1.17.0.

Track account balance, recorded spending, tokens, regenerations and continuations. Search chat details and export/import JSON (up to 10 MB / 20,000 records; existing duplicates are kept).

Account totals include other taverns; ledger totals cover recorded/imported entries. Missing costs may use account usage differences, which can be affected by other spending or delayed charges. Devices sharing one ST server/user share saved records; avoid simultaneous writes and use persistent storage. Exports contain private chat metadata, but no API keys or conversation text. Deleting chats retains ledger history.

