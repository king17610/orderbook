# 使用 Node.js 16.13.0 作為基礎映像
FROM node:16.13.0

ENV HOST=0.0.0.0

# 設定工作目錄
WORKDIR /app

# 複製 package.json 和 package-lock.json
COPY package*.json ./

# 安裝 npm 8.1.0
RUN npm install -g npm@8.1.0

# 安裝專案依賴
RUN npm install

# 複製整個專案
COPY . .

# 暴露開發端口
EXPOSE 3000

# 啟動 React 應用
CMD ["npm", "start"]
