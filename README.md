# 浦发集团招商平台

浦东投资招商平台网页版，基于飞书表格数据，提供政策查询、物业载体检索、AI 智能匹配功能。

## 技术栈

- **前端**：React 18 + TypeScript + Vite
- **后端**：Cloudflare Workers（AI 代理 + KV 缓存）
- **数据源**：飞书表格 API
- **AI**：NVIDIA Llama 3.1 8B（基于飞书实时数据 RAG）

## 功能

- **政策查询**：实时读取飞书政策数据，按行业/区域/补贴金额筛选
- **物业载体**：楼宇/单元/园区三级结构，含面积、租金、层高、荷载、配电等参数
- **AI 智能匹配**：自然语言查询，从政策库和物业库中推荐最相关选项并说明理由
- **新闻动态**：自动从张塘社抓取行业资讯

## 本地开发

```bash
pnpm install
pnpm run dev
```

## 部署

前端部署到任意静态托管（Vercel / Cloudflare Pages），Workers 独立部署。

Workers 端点：`https://api.elsak.eu.org`
