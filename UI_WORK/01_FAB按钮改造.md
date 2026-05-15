# 01 - 首页悬浮按钮（FAB）改造

**日期：** 2026-05-14
**修改范围：** 首页右下角悬浮按钮（AI助手、意见反馈）
**状态：** ✅ 完成
** commit：** `070a402`（合并提交），`e90eafe`（文字微调），`b4173f4`（类名不一致），`ed2b6d9`（CSS重构拆分）

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
- 按钮外层新增 flex 容器 `ai-fab-wrap`，垂直排列，gap: 9px
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

#### 2026-05-14 — 修复部署后按钮定位失效（类名不一致）
- CSS 定位类名写成 `.fab-stack`，但组件实际使用 `ai-fab-wrap`，导致按钮跑到左下角默认堆叠
- 修复：将 `.fab-stack` 并入 `.ai-fab-wrap`，统一类名
- **commit：** `b4173f4`

#### 2026-05-15 — CSS 文件结构重构（宜早不宜迟）
- 原因：index.css 达3000行，全部集中不利于多人协作和后续扩展
- FAB 按钮样式（163行）→ `src/components/FAB.css`
- 浮窗面板样式（219行）→ `src/components/Panel.css`
- `AIAssistant.tsx` 和 `Feedback.tsx` 各新增 `import './FAB.css'` 和 `import './Panel.css'`
- `check-css-classes.cjs` 更新：扫描路径加入新 CSS 文件
- 验证：并排对比原始版本（http://localhost:5174/），功能正常
- **commit：** `ed2b6d9`

---

### 文件变更
| 文件 | 改动 |
|------|------|
| `src/index.css` | 删除 FAB + 面板样式（-384行），剩余2678行 |
| `src/components/FAB.css` | 新增164行，浮窗按钮专属样式 |
| `src/components/Panel.css` | 新增220行，浮窗面板共享样式 |
| `src/components/AIAssistant.tsx` | 新增 import FAB.css + Panel.css |
| `src/components/Feedback.tsx` | 新增 import FAB.css + Panel.css |
| `scripts/check-css-classes.cjs` | 新增 FAB.css 和 Panel.css 到扫描路径 |
