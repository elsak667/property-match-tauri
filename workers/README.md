# 网页版部署指南 — Cloudflare Workers

## 架构概览

```
用户浏览器
    ↓
Cloudflare Pages（前端静态文件）
    ↓
Cloudflare Workers（飞书 API 代理）
    ↓
飞书表格
```

## 目录结构

```
workers/
├── src/index.ts          # Workers 入口（API 路由）
├── wrangler.toml         # Wrangler 配置
├── .dev.vars              # 本地开发密钥（勿提交 git）
└── README.md              # 本文档
```

## 一、本地开发

### 1. 安装依赖

```bash
npm install -g wrangler
cd workers
```

### 2. 配置本地密钥

创建 `workers/.dev.vars`：

```bash
FEISHU_APP_ID=cli_a950307a10b8dcb1
FEISHU_APP_SECRET=你的飞书应用密钥
```

### 3. 启动本地 Workers

```bash
cd workers
npx wrangler dev --port 8787
```

### 4. 启动前端（另一个终端）

```bash
cd /Users/els/property-match-tauri
VITE_USE_WORKERS=true pnpm run dev
```

访问 http://localhost:5173，前端通过 Vite proxy 调 `/api/*` → http://localhost:8787

## 二、生产部署

### 1. 部署 Workers

```bash
cd workers
npx wrangler deploy
```

成功后会返回 Workers 域名，格式如：
`pudong-invest-platform.<账号>.workers.dev`

### 2. 设置生产密钥

```bash
cd workers
npx wrangler secret put FEISHU_APP_ID
# 输入你的飞书 App ID

npx wrangler secret put FEISHU_APP_SECRET
# 输入你的飞书 App Secret
```

### 3. 配置前端 Vite proxy

生产环境需要把 `vite.config.ts` 中的 proxy target 改成你的 Workers 域名：

```typescript
proxy: {
  '/api': {
    target: 'https://pudong-invest-platform.你的账号.workers.dev',
    changeOrigin: true,
  },
},
```

然后重新构建前端：
```bash
pnpm run build
```

### 4. 部署前端静态文件

**方式 A：Cloudflare Pages（推荐）**
1. 在 Cloudflare Dashboard 创建 Pages 项目
2. 连接 GitHub 仓库
3. 构建命令：`pnpm run build`，输出目录：`dist`
4. 自定义域名绑定

**方式 B：其他静态托管（Vercel、nginx 等）**
将 `dist/` 目录部署到你的服务器即可。

## 三、Workers API 接口

| 接口 | 方法 | 说明 |
|---|---|---|
| `/api/config` | GET | 获取飞书配置状态 |
| `/api/policies` | GET | 获取政策列表（318条） |
| `/api/news` | GET | 获取新闻列表（26条） |
| `/api/properties?type=单元` | GET | 获取物业数据（园区/楼宇/单元/产业字典） |
| `/api/property-stats` | GET | 获取统计数据 |

## 四、权限说明

- **读取**：任何人打开网页即可读取飞书表格数据
- **写入**：仅特定人员有权限，不影响网页版使用

## 五、自动更新

网页版无需手动更新。每次代码 push 到 GitHub 后：
1. CI 自动构建前端 → 自动部署到 Pages
2. CI 重新部署 Workers（`wrangler deploy` 可接入 GitHub Actions）

用户下次刷新页面即为最新版本。

## 六、故障排查

### Workers 部署失败
```bash
# 检查 token 是否过期
npx wrangler whoami

# 查看详细日志
npx wrangler deploy --verbose
```

### 飞书 API 报错
```bash
# 本地测试 API
curl http://127.0.0.1:8787/api/config

# 检查密钥是否正确
npx wrangler secret list
```

### 前端报 404
确认 `VITE_USE_WORKERS=true` 已设置，且 Vite proxy 指向正确的 Workers 地址。

## 七、Tauri 桌面版（备用）

如需切换回桌面版，移除 `VITE_USE_WORKERS` 环境变量即可，代码会自动走 Tauri invoke 路径。

```bash
# 不设置 VITE_USE_WORKERS
pnpm run dev
```