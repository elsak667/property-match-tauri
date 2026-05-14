# 01 - 首页悬浮按钮（FAB）改造

**日期：** 2026-05-14
**修改范围：** 首页右下角悬浮按钮（AI助手、意见反馈）
**状态：** ✅ 完成
** commit：** `070a402`（合并提交），`e90eafe`（文字微调）

---

### 改动内容

#### 1. 按钮形状
- 圆形（52px × 52px，border-radius: 50%）→ 胶囊形（120px × 36px，border-radius: 18px）

#### 2. 图标和文字关系
- **原来：** 图标和文字混在一个 `<button>` 内，图标通过 inline style 绝对定位
- **现在：** 按钮外层包 `ai-fab-wrap`，图标和文字标签拆分为独立的子元素，通过 CSS 控制位置

#### 3. 图标样式（CSS 迁移）
- 颜色：原来随主题变量 → 现在 rgba(255,255,255,0.5) 固定白色，50% 透明度
- 位置：left: 8px, top: 5px，通过 `!important` 强制覆盖
- 字号：18px

#### 4. 文字样式（新增）
- 字体：Syne（新增 Google Fonts）
- 字号：13px
- 字重：500
- 颜色：rgba(255, 255, 255, 0.6)，60% 白色透明度
- 位置：right: 16px，垂直居中偏上 1px
- 字间距：0.5px

#### 5. 布局调整
- 按钮外层新增 flex 容器 `.fab-stack`，垂直排列，gap: 9px
- 反馈按钮移除原有的 `right: 88px` 定位，由 CSS flex gap 接管

#### 6. 悬浮效果
- 缩放比例：1.1 → 1.05，位移：translateY(-2px)
- 悬停阴影增强

#### 7. 移动端适配
- 宽度：100px，高度：32px
- 文字字号：12px，图标：16px

---

### 后续迭代

#### 2026-05-14（晚）— 文字微调
- 文字透明度：75% → 60%
- 文字位置：right 14px → 16px（左移2px），top 上移0.5px
- **commit：** `e90eafe`

---

### 文件变更
| 文件 | 改动 |
|------|------|
| `src/index.css` | 全部 FAB 样式从 inline 迁移至 CSS，新增 Syne 字体引入 |
| `src/components/AIAssistant.tsx` | HTML 结构：新增 `ai-fab-wrap`、`ai-fab-label` |
| `src/components/Feedback.tsx` | 同上 |
