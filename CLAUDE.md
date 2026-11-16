# CLAUDE.md

本專案的所有規則都寫在 [AGENTS.md](./AGENTS.md)。請先完整閱讀該檔案再開始工作。

@AGENTS.md

快速提醒（細節以 AGENTS.md 為準）：

- 先判斷使用者的要求是「收錄」「提問」還是「健檢」，再照對應流程做。
- 收錄前先確認在範圍內，並且先找有沒有既有頁面。
- 只動 `wiki/` 與 `demos/`；不要動 `raw/`、`docs/` 和系統檔。
- 改完一定要在 `wiki/log.md` 加一筆，並執行 `python build.py`。
