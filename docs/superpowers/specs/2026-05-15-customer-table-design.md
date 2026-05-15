# 客户管理表设计

## 表名
客户管理

## 字段

| 字段名 | 类型 | 说明 |
|--------|------|------|
| customer_id | 自动编号 | 主键 |
| name | 文本 | 企业名称 |
| credit_code | 文本 | 统一社会信用代码 |
| company_type | 文本 | 企业类型 |
| registered_capital | 文本 | 注册资本 |
| founded_date | 日期 | 成立日期 |
| registered_address | 文本 | 注册地址 |
| legal_representative | 文本 | 法定代表人 |
| industry | 文本 | 所属行业 |
| sub_industry | 文本 | 细分领域 |
| main_business | 文本 | 主营业务 |
| revenue_level | 文本 | 年营收规模 |
| employee_count | 数字 | 员工人数 |
| certifications | 文本 | 资质认证 |
| required_area | 数字 | 需求面积（㎡） |
| preferred_district | 文本 | 意向区域 |
| preferred_building_type | 文本 | 意向载体类型 |
| requirements | 文本 | 需求描述 |
| source | 单选 | 客户来源 |
| investment_staff | 文本 | 负责招商员 |
| stage | 单选 | 当前阶段 |
| created_at | 日期 | 创建时间 |
| updated_at | 日期 | 更新时间 |

## 客户来源（单选）
1. 主动录入
2. 载体转化

## 进度阶段（单选）
1. 初步接触
2. 需求确认
3. 实地看房
4. 谈判中
5. 签约入驻

---

## 如何在飞书中创建此表

### 步骤

1. **登录飞书**，进入多维表格应用

2. **创建多维表格**
   - 点击「新建」> 「多维表格」
   - 命名为「客户管理」

3. **配置字段**
   - 默认会有一个「名称」字段，将其改为「customer_id」，类型设为「自动编号」
   - 依次添加各字段，参考上方字段表格中的类型和说明

4. **设置字段类型**
   - `name`：文本
   - `credit_code`：文本
   - `company_type`：文本
   - `registered_capital`：文本
   - `founded_date`：日期
   - `registered_address`：文本
   - `legal_representative`：文本
   - `industry`：文本
   - `sub_industry`：文本
   - `main_business`：文本
   - `revenue_level`：文本
   - `employee_count`：数字
   - `certifications`：文本
   - `required_area`：数字（单位㎡）
   - `preferred_district`：文本
   - `preferred_building_type`：文本
   - `requirements`：文本
   - `source`：单选（选项：主动录入、载体转化）
   - `investment_staff`：文本
   - `stage`：单选（选项：初步接触、需求确认、实地看房、谈判中、签约入驻）
   - `created_at`：日期
   - `updated_at`：日期

5. **完成建表**，记录表的基本信息（URL、App ID 等），供后续 Worker API 调用

---

## 与线索表的关系

```
招商线索管理表 ──转化──> 客户管理表
```

### 转化关系说明

| 招商线索管理 | 客户管理 |
|-------------|---------|
| company_name | name |
| contact_name | legal_representative |
| contact_phone | （无对应字段） |
| source_recommender | investment_staff |
| required_area | required_area |
| preferred_district | preferred_district |
| target_property | preferred_building_type |
| status = "已转化" | source = "载体转化" |
| clue_id | original_clue_id（关联字段） |

### 设计说明

1. **customer_id** 作为客户表的唯一标识
2. 当线索状态变为「已转化」时，Worker API 自动在客户表中创建对应记录，source 设为「载体转化」
3. 两表通过 `original_clue_id` 关联，可查询某条线索的后续转化情况
4. 客户来源为「主动录入」的客户，则由招商员手动创建，不经过线索转化流程