# 時間序列白話 Wiki

用白話把時間序列的觀念和模型講一遍，再說明它在量化交易裡拿來做什麼。
這是一個 LLM Wiki：擁有者丟進知識點，AI 依照固定規則整理成頁面並維護連結。

網站：https://cheehan2388.github.io/stats-pitfalls/

## 運作方式

| 你做的事 | AI 做的事 |
|---|---|
| 在對話中貼一個知識點，或把筆記放進 `raw/` 後說「收錄」 | 確認範圍、找既有頁面、寫成固定六段的頁面、接上連結、記錄到 log、建置 |
| 問一個問題 | 以 Wiki 內容回答並指出來源頁面，再問你要不要收錄 |
| 說「健檢」 | 檢查矛盾、孤兒頁、待寫清單，只回報不擅自修改 |

規則全部寫在 **[AGENTS.md](./AGENTS.md)**，並由 `build.py` 強制檢查：
段落順序、字數上限、連結數量、來源欄位、禁用字眼，任何一項不符合，建置就會失敗。

## 結構

- `wiki/`：每個知識點一個 Markdown 檔，`log.md` 是更新紀錄
- `demos/`：互動實驗
- `raw/`：原始筆記（AI 只讀不改）
- `docs/`：建置輸出，由 GitHub Pages 發布

## 本機執行

```bash
pip install -r requirements.txt
python build.py
python -m http.server -d docs 8000
```

## 聲明

所有圖表都是固定亂數種子的模擬資料。本站僅供學習，不構成投資建議。
