# property-match-tauri AI 匹配优化实施计划

**创建时间**：2026-05-03
**最后更新**：2026-05-03

---

## 一、目标

建立一套高效、精准、可自我迭代的 AI 政策匹配系统，平衡效果、效率和成本。

---

## 二、最终架构（已部署）

```
用户查询 "芯片半导体补贴政策"
         ↓
  NVIDIA LLM 意图解析（need_policy / need_property）
         ↓
  ┌─────────────────────────────────────────┐
  │ policy 路（need_policy=true 时才跑）     │
  │  extractKeywords() 分词                │
  │    → Supabase ilike 命中计数（name×2） │
  │    → Jina v3 query embedding           │
  │    → match_policies_jina RPC            │
  │    → RRF 融合（k=60）                  │
  │    → 历史反馈加权（click/export/rating）│
  │    → top-5 政策                        │
  └─────────────────────────────────────────┘
  ┌─────────────────────────────────────────┐
  │ property 路（need_property=true 时才跑） │
  │  scoreProperty() 关键词评分             │
  │    → LLM 解析 property_filters 过滤     │
  │    → district / area_min / industry     │
  │    → top-3 载体                        │
  └─────────────────────────────────────────┘
         ↓
  NVIDIA LLM 生成推荐理由（第二次调用）
         ↓
  返回 { policies: [...], properties: [...], summary }
```

**关键特性：**
- **意图路由**：NVIDIA LLM 先解析 `need_policy` / `need_property`，只跑需要的路，省 Jina API 调用
- **RRF 融合**：关键词命中（精确） + Jina 向量（语义）两路 RRF，k=60
- **反馈飞轮**：export 时写 `cooccur:${qHash}:${pid}`，下次同类搜索 boost 相关政策
- **两阶段 LLM**：意图解析（256 tokens）+ 理由生成（1024 tokens）

---

## 三、实施步骤

### 阶段 A：反馈回路

| 步骤 | 内容 | 状态 |
|---|---|---|
| A1 | Workers query 时读 KV `stat:click`/`stat:export` 加权 | ✅ |
| A2 | 👍👎 评分数据加权 | ✅ 代码已有 |
| A3 | 共现矩阵：export 时写 `cooccur:${qHash}:${pid}` | ✅ 已修复 bug |

### 阶段 B：Supabase 集成

| 步骤 | 内容 | 状态 |
|---|---|---|
| B1 | Workers 接入 Supabase 客户端 | ✅ |
| B2 | Supabase `policies` 表读取 | ✅ |
| B3 | `match_policies_jina` RPC 创建 | ✅ |

### 阶段 C：Jina v3 接入

| 步骤 | 内容 | 状态 |
|---|---|---|
| C1 | Supabase `embedding_jina` 列（1024维）| ✅ |
| C2 | Workers `callJinaEmbedding()` + `getHybridSearchScores()` + `rrfFusion()` | ✅ |
| C3 | 319 条政策 Jina 向量全部生成 | ✅ |
| C4 | RRF 融合（TF-IDF 关键词 + Jina 语义）| ✅ |

### 阶段 D：意图路由

| 步骤 | 内容 | 状态 |
|---|---|---|
| D1 | NVIDIA LLM 意图解析 | ✅ |
| D2 | 政策/载体分路执行 | ✅ |

---

## 四、Review 发现并修复的问题

| 问题 | 原因 | 修复 |
|------|------|------|
| 共现矩阵读写 key 不一致 | `getFeedbackScore` 读 `cooccur:*`，track 写 `coexport:*` | track 写时加 `cooccur:${qHash}:${pid}` |
| TF-IDF 截断 dot product 无意义 | Jina 1024维 vs TF-IDF 1536维两个语义空间截断 | 替换为 `extractKeywords()` 关键词命中计数 |
| 意图路由粗糙 | 正则 `isRecruit/isSubsidy` 无法区分政策/载体 | 加 NVIDIA LLM 解析 `need_policy/need_property` |

---

## 四、Review 发现并修复的问题

| 问题 | 原因 | 修复 |
|------|------|------|
| 共现矩阵读写 key 不一致 | `getFeedbackScore` 读 `cooccur:*`，track 写 `coexport:*` | track 写时加 `cooccur:${qHash}:${pid}` |
| TF-IDF 截断 dot product 无意义 | Jina 1024维 vs TF-IDF 1536维两个语义空间截断 | 替换为 `extractKeywords()` 关键词命中计数 |
| 意图路由粗糙 | 正则 `isRecruit/isSubsidy` 无法区分政策/载体 | 加 NVIDIA LLM 解析 `need_policy/need_property` |
| 大数值 ID 精度丢失 | `Number(id)` 精度丢失 | 用 `policyIdToIndex` name→index 映射替代 |
| RRF 融合后分数压缩 | `fusedNorm * 50 + kwRank * 0.5` 公式导致多个政策分数接近 | 改用 ranking-based 排名赋分 |
| `needProperty=false` 时 `boostedProperties` 未初始化 | 空数组导致 properties 永远为空 | 改为 `= scoredProperties` 默认全量 |

---

## 五、当前状态

**Workers 已部署：** `https://api.198857.sbs`

**API 端点：** `/api/ai/search?q=<query>`

| 组件 | 状态 |
|------|------|
| `callJinaEmbedding()` Jina v3 API | ✅ |
| `match_policies_jina` RPC | ✅ |
| 319 条政策 Jina 向量 | ✅ 全部生成 |
| `getHybridSearchScores` + RRF | ✅ |
| 意图路由 `parseIntent` | ✅ |
| 共现矩阵写 `cooccur:*` | ✅ |
| 历史反馈加权 `applyFeedbackBoost` | ✅ |
| NVIDIA LLM 理由生成 | ✅ |

**已知问题：**
- 载体数据（properties）仍为空，待飞书数据填充
- `scoreProperty` 对有些长尾 query（如"企业所得税优惠"）Jina 语义相似度排名偏低，关键词命中不占优势
- 当前 top-1 返回模式，搜索较宽泛时不利于多政策对比

**⚠️ 待补：** 载体数据尚未填充，`properties` 返回空属预期

---

## 六、调试日志

调试日志（生产环境已关闭，调试时可见）：
- `[JINA] calling RPC` — RPC 调用
- `[RRF] tfidf=N, jina=N` — 两路得分数量
- `[AI] policies=N, properties=N` — 飞书数据加载

---

## 七、下一步（可选）

| 方向 | 内容 |
|------|------|
| 载体数据 | 填充 `/api/property-filter` 对应的飞书载体数据 |
| RRF k 参数 | 当前 k=60，可 A/B 测试调参 |
| CF Workers AI | bge-large（免费）替代 Jina query embedding，对比效果 |
| 三路 embedding | TF-IDF 关键词 + Jina 语义 + CF Workers AI 三路 RRF |
| 政策返回数量 | 放宽 top-5 限制，支持更多候选政策展示 |

---

## 八、配置信息

| 配置项 | 值 |
|---|---|
| Supabase URL | `https://rgnncmgrumwjjgzyhmkt.supabase.co` |
| Jina API Key | `jina_0d535a99b1d746c9abd83f8b52816ff69...` |
| Workers API | `https://api.198857.sbs` |
| embedding | TF-IDF (1536维，char-level) + Jina v3 (1024维) |
| Supabase DB Password | 已配置 wrangler secrets |

---

*计划制定：Claude Code*
