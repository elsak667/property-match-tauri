/**
 * 客户列表页面
 * Customer Page — 客户管理界面
 */
import { useState, useEffect, useCallback } from "react";
import type { Customer, CustomerStage } from "./types";
import { getCustomers } from "../../lib/invest/customer";
import CustomerForm from "./CustomerForm";

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
  onEdit: (customer: Customer) => void;
}

function EditModal({ customer, onClose, onEdit }: EditModalProps) {
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
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>关闭</button>
          <button className="btn btn-primary" onClick={() => onEdit(customer)}>编辑</button>
        </div>
      </div>
    </div>
  );
}

export default function CustomerPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [filterStage, setFilterStage] = useState<CustomerStage | "全部">("全部");
  const [searchName, setSearchName] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const loadCustomers = useCallback(async () => {
    try {
      const data = await getCustomers();
      setCustomers(data);
    } catch {
      // silent fail, keep empty list
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCustomers(); }, [loadCustomers]);

  const handleCreated = () => {
    setShowForm(false);
    setEditingCustomer(null);
    loadCustomers();
  };

  const handleEdit = (customer: Customer) => {
    setSelectedCustomer(null);
    setEditingCustomer(customer);
    setShowForm(true);
  };

  
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const handleCopyCompanyNames = () => {
    const names = filteredCustomers.map(c => c.name).filter(Boolean);
    if (names.length === 0) return;
    const text = names.join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopyMessage(`已复制 ${names.length} 个公司名`);
      setTimeout(() => setCopyMessage(null), 3000);
    });
  };

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
          {copyMessage && <div className="alert alert-success">{copyMessage}</div>}
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
            <button className="btn-primary" onClick={() => { setShowForm(true); setEditingCustomer(null); }}>新建客户</button>
            {filterStage === "全部" && filteredCustomers.length > 0 && (
              <button className="btn-secondary" onClick={handleCopyCompanyNames}>复制公司名</button>
            )}
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
              {loading ? (
                <tr><td colSpan={6} className="empty-cell">加载中...</td></tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty-cell">暂无客户数据</td>
                </tr>
              ) : null}
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
        <EditModal
          customer={selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
          onEdit={handleEdit}
        />
      )}
      {showForm && (
        <CustomerForm
          customerId={editingCustomer?.customer_id}
          initialData={editingCustomer ? {
            name: editingCustomer.name,
            credit_code: editingCustomer.credit_code,
            company_type: editingCustomer.company_type,
            registered_capital: editingCustomer.registered_capital,
            founded_date: editingCustomer.founded_date,
            registered_address: editingCustomer.registered_address,
            legal_representative: editingCustomer.legal_representative,
            industry: editingCustomer.industry,
            sub_industry: editingCustomer.sub_industry,
            main_business: editingCustomer.main_business,
            revenue_level: editingCustomer.revenue_level,
            employee_count: editingCustomer.employee_count,
            certifications: editingCustomer.certifications,
            required_area: editingCustomer.required_area,
            preferred_district: editingCustomer.preferred_district,
            preferred_building_type: editingCustomer.preferred_building_type,
            requirements: editingCustomer.requirements,
            source: editingCustomer.source,
            investment_staff: editingCustomer.investment_staff,
            stage: editingCustomer.stage,
          } : undefined}
          onSave={handleCreated}
          onCancel={() => { setShowForm(false); setEditingCustomer(null); }}
        />
      )}
    </div>
  );
}