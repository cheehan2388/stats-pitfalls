# 統計方法踩雷圖鑑

一頁拆解一個常用在市場資料上的統計方法：它假設了什麼、哪裡會壞掉、可以改用什麼。
每頁都有一個可以自己拖拉參數的互動實驗。

目前收錄：z-score 離群偵測、移動平均、布林通道、皮爾森相關係數。

## 這個專案的重點

這不是一個「做完就結束」的網頁，而是一套可以持續擴充的規則：

- **[AGENTS.md](./AGENTS.md)**：寫給 AI 助理的專案規則，包含目的、結構、內容格式、命名方式與修改守則。
- **`build.py`**：把規則變成可執行的檢查。欄位缺漏、段落順序錯誤、找不到互動實驗時，建置會失敗並說明原因。
- **`content/_template.md`**：新頁面的起點。

要新增一頁，只要對 AI 說「依照 AGENTS.md 新增一篇線性迴歸」，它就會建立
`content/methods/linear-regression.md` 與 `demos/linear-regression.js`，首頁、分類與目錄會自動更新。

## 本機執行

```bash
pip install -r requirements.txt
python build.py                      # 檢查內容並產生 docs/
python -m http.server -d docs 8000   # 開啟 http://localhost:8000
```

## 發布

GitHub Pages：Settings → Pages → Source 選 **Deploy from a branch**，Branch 選 `main`、資料夾選 `/docs`。

## 聲明

所有圖表都是固定亂數種子的模擬資料。本站僅供學習統計方法，不構成投資建議。
