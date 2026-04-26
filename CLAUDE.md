# 浦东招商智能系统

## 项目架构
- **前端**：React 18 + TypeScript + Vite（Tauri WebView）
- **后端**：Tauri 2 + Rust
- **数据源**：飞书多维表格（园区/楼宇/单元三级模型）
- **构建**：`pnpm`（禁止 npm/yarn）

## 目录结构
```
src/                    # React 前端源码
  app/
    carrier/            # 物业载体匹配（CarrierPage）
    policy/             # 政策匹配（PolicyPage）
  components/           # 可复用组件（PropertyMap 等）
  lib/
    policy.ts           # 物业载体评分算法 + 飞书 API
    useFeishu.ts        # 政策数据 hook
    tauri.ts            # Rust 命令调用层
src-tauri/
  src/
    main.rs             # Tauri 命令入口
    feishu.rs           # 飞书 API（token、sheet 读写）
```

## 飞书数据结构
| Sheet | ID | 内容 |
|-------|----|------|
| 园区 | 4hdJSg | 园区基础信息 |
| 楼宇 | 4hdJSh | 楼栋信息 |
| 单元 | 4hdJSi | 楼层单元详情 |
| 产业字典 | 4hdJSj | 产业方向配置 |
| 政策主表 | 0aad30 | 政策条目 |
| 统计元数据 | 2pLPm8 | 官网政策总数等 |

## 开发命令
```bash
pnpm install          # 安装依赖
pnpm run tauri:dev   # 启动 Tauri 开发服务器
pnpm run tauri:build # 生产构建
```

## 关键约定
- **物业载体**：`policy.ts` → `loadPropertyData()` 读飞书，`matchProperties()` 评分，`loadIndustries()` 产业字典
- **政策数据**：`useFeishu.ts` → `usePolicies()` 读飞书，PolicyPage 专用
- **外部链接**：用 `tauri-plugin-opener`（`open_url`），禁止用 `shell().open()`
- **飞书凭证**：从 Rust 环境变量读取（`FEISHU_APP_ID`、`FEISHU_APP_SECRET`），前端不存凭证
- **降级策略**：飞书凭证缺失时抛 `FeishuCredentialsMissing`，调用方捕获后降级到 mock 数据
- 缩进：2空格；TypeScript 小驼峰；组件大驼峰