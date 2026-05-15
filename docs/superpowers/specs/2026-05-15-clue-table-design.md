# 招商线索表设计

## 表名
招商线索管理

## 字段

| 字段名 | 类型 | 说明 |
|--------|------|------|
| clue_id | 自动编号 | 主键 |
| company_name | 文本 | 企业名称 |
| contact_name | 文本 | 联系人姓名 |
| contact_phone | 文本 | 联系电话 |
| source_recommender | 文本 | 推荐人 |
| source_recommender_phone | 文本 | 推荐人联系方式 |
| required_area | 数字 | 需求面积（㎡） |
| preferred_district | 文本 | 意向区域 |
| target_property | 文本 | 目标物业载体 |
| investment_staff | 文本 | 负责招商员 |
| status | 单选 | 线索状态 |
| reward_eligible | 复选框 | 是否有奖励资格 |
| reward_note | 文本 | 奖励备注 |
| created_at | 日期 | 提交时间 |
| updated_at | 日期 | 更新时间 |

## 线索状态（单选）
1. 待核实
2. 跟进中
3. 已转化
4. 已失效

---

## 如何在飞书中创建此表

### 步骤

1. **登录飞书**，进入多维表格应用

2. **创建多维表格**
   - 点击「新建」> 「多维表格」
   - 命名为「招商线索管理」

3. **配置字段**
   - 默认会有一个「名称」字段，将其改为「clue_id」，类型设为「自动编号」
   - 依次添加各字段，参考上方字段表格中的类型和说明

4. **设置字段类型**
   - `company_name`：文本
   - `contact_name`：文本
   - `contact_phone`：文本
   - `source_recommender`：文本
   - `source_recommender_phone`：文本
   - `required_area`：数字（单位㎡）
   - `preferred_district`：文本
   - `target_property`：文本
   - `investment_staff`：文本
   - `status`：单选（选项：待核实、跟进中、已转化、已失效）
   - `reward_eligible`：复选框
   - `reward_note`：文本
   - `created_at`：日期
   - `updated_at`：日期

5. **完成建表**，记录表的基本信息（URL、App ID 等），供后续 Worker API 调用

---

## 与客户表的关系

```
招商线索管理表 ──转化──> 客户管理表
```

### 转化关系说明

| 招商线索管理 | 客户管理 |
|-------------|---------|
| company_name | company_name |
| contact_name | contact_name |
| contact_phone | contact_phone |
| required_area | required_area |
| preferred_district | preferred_district |
| target_property | target_property |
| investment_staff | investment_staff |
| status = "已转化" | status = "正式客户" |
| clue_id | original_clue_id（关联字段） |

### 设计说明

1. **clue_id** 作为线索表的唯一标识，在转化时作为 `original_clue_id` 带入客户表，便于追溯来源
2. 当线索状态变为「已转化」时，Worker API 自动在客户表中创建对应记录
3. 两表通过 `original_clue_id` 关联，可查询某条线索的后续转化情况
4. 客户表的具体设计待后续 Task 输出