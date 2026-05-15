/**
 * 客户列表页面
 * Customer Page — 客户管理界面
 */
import { useState } from "react";
import type { Customer, CustomerStage } from "./types";

/** Mock data — API stub 阶段使用 */
const mockCustomers: Customer[] = [
  {
    customer_id: "1",
    name: "测试公司A",
    industry: "人工智能",
    investment_staff: "张三",
    stage: "初步接触",
    source: "主动录入",
    created_at: "2026-05-10",
  },
  {
    customer_id: "2",
    name: "华新科技集团",
    industry: "生物医药",
    investment_staff: "李四",
    stage: "需求确认",
    source: "载体转化",
    created_at: "2026-05-08",
  },
  {
    customer_id: "3",
    name: "华东制造有限公司",
    industry: "高端装备",
    investment_staff: "王五",
    stage: "实地看房",
    source: "主动录入",
    created_at: "2026-05-05",
  },
  {
    customer_id: "4",
    name: "创新材料科技",
    industry: "新材料",
    investment_staff: "赵六",
    stage: "谈判中",
    source: "载体转化",
    created_at: "2026-05-02",
  },
  {
    customer_id: "5",
    name: "数字云服有限公司",
    industry: "软件信息",
    investment_staff: "钱七",
    stage: "签约入驻",
    source: "主动录入",
    created_at: "2026-04-28",
  },
];

const STAGE_OPTIONS: CustomerStage[] = ["初步接触", "需求确认", "实地看房", "谈判中", "签约入驻"];

const STAGE_COLORS: Record<CustomerStage, string> = {
  "初步接触": "#94a3b8",
  "需求确认": "#3b82f6",
  "实地看房": "#f59e0b",
  "谈判中": "#f97316",
  "签约入驻": "#22c55e",
};

interface EditModalProps {
  customer: Customer;
  onClose: () => void;
}

function EditModal({ customer, onClose }: EditModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>客户详情</h2>
          <button className="modal-close" onClick={onClose}>x</button>
        </div>
        <div className="modal-body">
          <div className="detail-grid">
            <div className="detail-item">
              <span className="detail-label">客户ID</span>
              <span className="detail-value">{customer.customer_id || "-"}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">客户名称</span>
              <span className="detail-value">{customer.name}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">行业</span>
              <span className="detail-value">{customer.industry || "-"}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">招商人员</span>
              <span className="detail-value">{customer.investment_staff || "-"}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">阶段</span>
              <span
                className="detail-value status-badge"
                style={{ background: STAGE_COLORS[customer.stage] }}
              >
                {customer.stage}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">来源</span>
              <span className="detail-value">{customer.source}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">创建时间</span>
              <span className="detail-value">{customer.created_at || "-"}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CustomerPage() {
  const [customers] = useState<Customer[]>(mockCustomers);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [filterStage, setFilterStage] = useState<CustomerStage | "全部">("全部");
  const [searchName, setSearchName] = useState("");

  const filteredCustomers = customers.filter(c => {
    const matchesStage = filterStage === "全部" || c.stage === filterStage;
    const matchesName = c.name.toLowerCase().includes(searchName.toLowerCase());
    return matchesStage && matchesName;
  });

  return (
    <div className="container">
      <div className="clue-admin-container">
        <div className="clue-admin-header">
          <div>
            <h1 className="page-title">客户管理</h1>
            <p className="page-subtitle">管理所有客户信息，跟进状态，查看详情</p>
          </div>
          <div className="clue-admin-actions">
            <input
              type="text"
              className="search-input"
              placeholder="搜索客户名称..."
              value={searchName}
              onChange={e => setSearchName(e.target.value)}
            />
            <select
              className="filter-select"
              value={filterStage}
              onChange={e => setFilterStage(e.target.value as CustomerStage | "全部")}
            >
              <option value="全部">全部阶段</option>
              {STAGE_OPTIONS.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <button className="btn-primary">新建客户</button>
          </div>
        </div>

        <div className="clue-admin-table-wrap">
          <table className="clue-admin-table">
            <thead>
              <tr>
                <th>客户名称</th>
                <th>行业</th>
                <th>招商人员</th>
                <th>阶段</th>
                <th>来源</th>
                <th>创建时间</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map(customer => (
                <tr
                  key={customer.customer_id}
                  className="clickable-row"
                  onClick={() => setSelectedCustomer(customer)}
                >
                  <td className="cell-company">{customer.name}</td>
                  <td>{customer.industry || "-"}</td>
                  <td>{customer.investment_staff || "-"}</td>
                  <td>
                    <span
                      className="stage-badge"
                      style={{ background: STAGE_COLORS[customer.stage] }}
                    >
                      {customer.stage}
                    </span>
                  </td>
                  <td>{customer.source}</td>
                  <td>{customer.created_at || "-"}</td>
                </tr>
              ))}
              {filteredCustomers.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty-cell">暂无客户数据</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="clue-admin-summary">
          <span>共 {filteredCustomers.length} 条客户</span>
          <span className="summary-sep">|</span>
          {STAGE_OPTIONS.map(s => (
            <span key={s}>
              {s}: {customers.filter(c => c.stage === s).length}
              <span className="summary-sep">|</span>
            </span>
          ))}
        </div>
      </div>

      {selectedCustomer && (
        <EditModal customer={selectedCustomer} onClose={() => setSelectedCustomer(null)} />
      )}
    </div>
  );
}