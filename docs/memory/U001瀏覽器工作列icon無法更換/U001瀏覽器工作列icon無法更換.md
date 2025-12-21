# U001: 瀏覽器工具列 Icon 無法更換

## 問題描述
更新了 Chrome 擴充功能的圖示檔案後，瀏覽器工具列上的圖示仍然顯示舊圖示，即使重新載入擴充功能也沒有改變。

## 發生時間
2025-12-21

## 根本原因
**圖示檔案的實際尺寸與 `manifest.json` 中宣告的尺寸不符。**

具體來說：
- 所有圖示檔案（`icon-48x48.png`、`icon-128x128.png` 等）實際上都是 **1024x1024 像素的 JPEG 圖片**
- 但 `manifest.json` 中宣告它們分別是 48x48、72x72、96x96、128x128 等不同尺寸
- Chrome 瀏覽器會**拒絕載入尺寸不符的圖示**，導致工具列顯示預設圖示或舊圖示

## 為什麼會發生
1. 使用圖片生成工具（如 AI 圖片生成器）產生的圖示通常是高解析度的大尺寸圖片
2. 直接複製這些圖片並重新命名為 `icon-48x48.png` 等檔名，但**沒有實際調整圖片尺寸**
3. Chrome 擴充功能要求圖示的**檔名、manifest 宣告、實際像素尺寸**三者必須一致

## 解決方法

### 方法一：使用 macOS 內建的 `sips` 指令（推薦）
在終端機執行以下指令來調整圖片尺寸：

```bash
cd /path/to/your/extension/public/icon

# 調整各個尺寸的圖示
sips -s format png -z 16 16 icon-16x16.png --out icon-16x16.png
sips -s format png -z 32 32 icon-32x32.png --out icon-32x32.png
sips -s format png -z 48 48 icon-48x48.png --out icon-48x48.png
sips -s format png -z 72 72 icon-72x72.png --out icon-72x72.png
sips -s format png -z 96 96 icon-96x96.png --out icon-96x96.png
sips -s format png -z 128 128 icon-128x128.png --out icon-128x128.png
```

### 方法二：使用線上工具或圖片編輯軟體
1. 使用 [TinyPNG](https://tinypng.com/) 或 [Squoosh](https://squoosh.app/) 等線上工具
2. 或使用 Photoshop、GIMP 等圖片編輯軟體
3. 將原始圖片分別調整為 16x16、32x32、48x48、72x72、96x96、128x128 像素
4. 儲存為 PNG 格式（推薦）

### 方法三：使用 ImageMagick（需要安裝）
```bash
# 安裝 ImageMagick
brew install imagemagick

# 批次調整尺寸
convert source.png -resize 48x48 icon-48x48.png
convert source.png -resize 128x128 icon-128x128.png
# ... 其他尺寸
```

## 驗證方法
調整完圖片後，使用以下指令確認圖片尺寸是否正確：

```bash
file public/icon/icon-48x48.png
```

應該看到類似輸出：
```
icon-48x48.png: PNG image data, 48 x 48, ...
```

## 預防措施
1. **建立圖示時就產生多個尺寸**：使用設計工具時直接匯出多個尺寸的版本
2. **使用自動化腳本**：在專案中加入圖示處理腳本，確保每次更新圖示時自動調整尺寸
3. **檢查清單**：更新圖示後，在 `package.json` 的 `build` 腳本中加入圖示驗證步驟

## 相關資源
- [Chrome Extension Icons 官方文件](https://developer.chrome.com/docs/extensions/mv3/manifest/icons/)
- [sips 指令說明](https://ss64.com/osx/sips.html)

## 標籤
`#chrome-extension` `#icon` `#troubleshooting` `#image-resize`
