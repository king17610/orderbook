# Order Book
Order Book 是一個基於 React 的應用程式，使用 `react-scripts` 進行開發與構建。

## 環境需求

請確保您的開發環境符合以下條件：

- **Node.js**: **10.x 至 16.x**（**不建議使用 Node 17 或更高版本**，可能會遇到 Webpack 相關錯誤）
- **npm**: 版本 6 以上

或者降級至 LTS 版本（如 16.x）：

```sh
nvm use 16
```


### 建議使用
- **node: v16.13.0**
- **(npm v8.1.0)**


## 安裝依賴

在專案目錄中執行：

```sh
npm install
```

## 可用指令

在專案目錄下，您可以使用以下指令：

### `npm start`

啟動開發伺服器，打開瀏覽器進入 [http://localhost:3000](http://localhost:3000)。

### `npm run build`

打包專案至 `build` 資料夾，進行最佳化以供正式部署。

### `npm test`

執行測試。

### `npm run eject`

**警告**：此操作不可逆！

如果需要自定義 Webpack 配置，可以使用 `eject` 指令將所有配置文件與依賴分離。

## 主要技術棧

- **React**: `16.9.0`
- **React DOM**: `16.9.0`
- **React Scripts**: `3.2.0`
- **Sass**: `1.85.0`
- **Sass Loader**: `10.4.1`

## 瀏覽器支援

### 生產環境

- 市場佔有率 > 0.2%
- 不支援過時的瀏覽器（如 IE）
- 不支援 Opera Mini

### 開發環境

- 最新的 Chrome、Firefox、Safari 版本

## 其他資訊

此專案基於 [Create React App](https://github.com/facebook/create-react-app) 建立，並使用 `react-app` 的 ESLint 規範來確保代碼品質。

如果有任何問題，請參考官方文件或聯絡專案維護者。

