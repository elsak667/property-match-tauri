/**
 * 客户列表页面
 * Customer Page — 客户管理界面（分栏布局）
 */
import { useState, useEffect, useCallback } from "react";
import type { Customer, CustomerStage } from "./types";
import { getCustomers } from "../../lib/invest/customer";
import { getVisits, createVisit, type VisitRecord } from "../../lib/invest/visit";
import CustomerForm from "./CustomerForm";

const STAGE_OPTIONS: CustomerStage[] = ["初步接触", "需求确认", "实地看房", "谈判中", "签约入驻"];

const STAGE_COLORS: Record<CustomerStage, string> = {
  "初步接触": "#94a3b8",
  "需求确认": "#3b82f6",
  "实地看房": "#f59e0b",
  "谈判中": "#f97316",
  "签约入驻": "#22c55e",
};

// 租期预警组件
function LeaseWarning({ customer }: { customer: Customer }) {
  const leaseEnd = customer.lease_end;
  if (!leaseEnd) return <span className="lease-none">-</span>;

  const end = new Date(leaseEnd);
  const now = new Date();
  const diffDays = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return <span className="lease-overdue">已到期</span>;
  } else if (diffDays <= 30) {
    return <span className="lease-warning">{diffDays}天后到期</span>;
  } else if (diffDays <= 90) {
    return <span className="lease-soon">{diffDays}天</span>;
  }
  return <span className="lease-normal">{diffDays}天</span>;
}

// Tab types
type DetailTab = "基本信息" | "跟进记录" | "进度历史";

interface DetailPanelProps {
  customer: Customer;
  onEdit: (customer: Customer) => void;
  onClose: () => void;
}

function DetailPanel({ customer, onEdit, onClose }: DetailPanelProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>("基本信息");

  // Visit records state
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [visitsLoading, setVisitsLoading] = useState(false);

  // New visit form state
  const [showVisitForm, setShowVisitForm] = useState(false);
  const [visitForm, setVisitForm] = useState({
    visit_date: "",
    visit_purpose: "",
    visit_content: "",
    next_step: "",
    investment_staff: customer.investment_staff || "",
  });
  const [visitMsg, setVisitMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const placeholderHistory = [
    { date: "2026-05-01", from: "初步接触", to: "需求确认", by: customer.investment_staff },
    { date: "2026-05-10", from: "需求确认", to: "实地看房", by: customer.investment_staff },
  ];

  // Fetch visits when "跟进记录" tab becomes active
  useEffect(() => {
    if (activeTab !== "跟进记录") return;
    let cancelled = false;
    setVisitsLoading(true);
    getVisits(customer.customer_id)
      .then(data => { if (!cancelled) setVisits(data); })
      .catch(() => { if (!cancelled) setVisits([]); })
      .finally(() => { if (!cancelled) setVisitsLoading(false); });
    return () => { cancelled = true; };
  }, [activeTab, customer.customer_id]);

  const handleVisitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createVisit(customer.customer_id, {
        customer_name: customer.name,
        ...visitForm,
      });
      setVisitMsg({ type: "success", text: "跟进记录已创建" });
      setShowVisitForm(false);
      setVisitForm({ visit_date: "", visit_purpose: "", visit_content: "", next_step: "", investment_staff: customer.investment_staff || "" });
      // Refresh list
      const data = await getVisits(customer.customer_id);
      setVisits(data);
    } catch (err) {
      setVisitMsg({ type: "error", text: `创建失败: ${err}` });
    }
  };

  return (
    <div className="detail-panel">
      <div className="detail-panel-header">
        <div className="detail-panel-title">
          <span className="detail-panel-name">{customer.name}</span>
          <span
            className="stage-badge"
            style={{ background: STAGE_COLORS[customer.stage] }}
          >
            {customer.stage}
          </span>
        </div>
        <button className="detail-panel-close" onClick={onClose}>x</button>
      </div>

      <div className="detail-panel-tabs">
        <button
          className={`detail-tab ${activeTab === "基本信息" ? "active" : ""}`}
          onClick={() => setActiveTab("基本信息")}
        >
          基本信息
        </button>
        <button
          className={`detail-tab ${activeTab === "跟进记录" ? "active" : ""}`}
          onClick={() => setActiveTab("跟进记录")}
        >
          跟进记录
        </button>
        <button
          className={`detail-tab ${activeTab === "进度历史" ? "active" : ""}`}
          onClick={() => setActiveTab("进度历史")}
        >
          进度历史
        </button>
      </div>

      <div className="detail-panel-body">
        {activeTab === "基本信息" && (
          <div className="tab-content">
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
                <span className="detail-label">统一社会信用代码</span>
                <span className="detail-value">{customer.credit_code || "-"}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">企业类型</span>
                <span className="detail-value">{customer.company_type || "-"}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">注册资本</span>
                <span className="detail-value">{customer.registered_capital || "-"}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">成立日期</span>
                <span className="detail-value">{customer.founded_date || "-"}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">注册地址</span>
                <span className="detail-value">{customer.registered_address || "-"}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">法定代表人</span>
                <span className="detail-value">{customer.legal_representative || "-"}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">行业</span>
                <span className="detail-value">{customer.industry || "-"}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">子行业</span>
                <span className="detail-value">{customer.sub_industry || "-"}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">主营业务</span>
                <span className="detail-value">{customer.main_business || "-"}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">营收规模</span>
                <span className="detail-value">{customer.revenue_level || "-"}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">员工人数</span>
                <span className="detail-value">{customer.employee_count ?? "-"}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">资质认证</span>
                <span className="detail-value">{customer.certifications || "-"}</span>
              </div>
            </div>

            <div className="detail-section-title">选址需求</div>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">需求面积</span>
                <span className="detail-value">
                  {customer.required_area ? `${customer.required_area} ㎡` : "-"}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">意向区域</span>
                <span className="detail-value">{customer.preferred_district || "-"}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">意向楼宇类型</span>
                <span className="detail-value">{customer.preferred_building_type || "-"}</span>
              </div>
              <div className="detail-item full-width">
                <span className="detail-label">其他需求</span>
                <span className="detail-value">{customer.requirements || "-"}</span>
              </div>
            </div>

            <div className="detail-section-title">承租信息</div>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">当前承租载体</span>
                <span className="detail-value">{customer.current_location || "-"}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">承租面积</span>
                <span className="detail-value">
                  {customer.rental_area ? `${customer.rental_area} ㎡` : "-"}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">租期开始</span>
                <span className="detail-value">{customer.lease_start || "-"}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">租期结束</span>
                <span className="detail-value">{customer.lease_end || "-"}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">租金状态</span>
                <span className="detail-value">{customer.rental_status || "-"}</span>
              </div>
            </div>

            <div className="detail-section-title">联系人</div>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">联系人姓名</span>
                <span className="detail-value">{customer.contact_name || "-"}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">职务</span>
                <span className="detail-value">{customer.contact_title || "-"}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">联系电话</span>
                <span className="detail-value">{customer.contact_phone || "-"}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">微信</span>
                <span className="detail-value">{customer.contact_wechat || "-"}</span>
              </div>
            </div>

            <div className="detail-section-title">招商信息</div>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">客户来源</span>
                <span className="detail-value">{customer.source}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">招商人员</span>
                <span className="detail-value">{customer.investment_staff || "-"}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">创建时间</span>
                <span className="detail-value">{customer.created_at || "-"}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">更新时间</span>
                <span className="detail-value">{customer.updated_at || "-"}</span>
              </div>
            </div>

            <div className="detail-panel-actions">
              <button className="btn btn-primary" onClick={() => onEdit(customer)}>
                编辑
              </button>
            </div>
          </div>
        )}

        {activeTab === "跟进记录" && (
          <div className="tab-content">
            <div className="tab-actions">
              <button className="btn-primary" onClick={() => setShowVisitForm(true)}>+ 新增跟进</button>
            </div>

            {showVisitForm && (
              <div className="visit-form-overlay">
                <form className="visit-form" onSubmit={handleVisitSubmit}>
                  <h3 className="visit-form-title">新增跟进记录</h3>
                  <div className="form-field">
                    <label>跟进日期</label>
                    <input type="date" value={visitForm.visit_date}
                      onChange={e => setVisitForm(f => ({ ...f, visit_date: e.target.value }))} required />
                  </div>
                  <div className="form-field">
                    <label>跟进目的</label>
                    <input type="text" placeholder="如：需求沟通、带看载体" value={visitForm.visit_purpose}
                      onChange={e => setVisitForm(f => ({ ...f, visit_purpose: e.target.value }))} required />
                  </div>
                  <div className="form-field">
                    <label>跟进内容</label>
                    <textarea placeholder="详细记录跟进内容..." value={visitForm.visit_content}
                      onChange={e => setVisitForm(f => ({ ...f, visit_content: e.target.value }))} required />
                  </div>
                  <div className="form-field">
                    <label>下一步计划</label>
                    <input type="text" placeholder="下一步跟进计划" value={visitForm.next_step}
                      onChange={e => setVisitForm(f => ({ ...f, next_step: e.target.value }))} />
                  </div>
                  <div className="form-field">
                    <label>招商人员</label>
                    <input type="text" value={visitForm.investment_staff}
                      onChange={e => setVisitForm(f => ({ ...f, investment_staff: e.target.value }))} />
                  </div>
                  <div className="form-actions">
                    <button type="submit" className="btn-primary">保存</button>
                    <button type="button" className="btn-secondary" onClick={() => { setShowVisitForm(false); setVisitMsg(null); }}>取消</button>
                  </div>
                </form>
              </div>
            )}

            {visitMsg && (
              <div className={`alert alert-${visitMsg.type}`}>{visitMsg.text}</div>
            )}

            <div className="visit-list">
              {visitsLoading ? (
                <div className="empty-cell">加载中...</div>
              ) : visits.length === 0 ? (
                <div className="empty-cell">暂无跟进记录</div>
              ) : (
                visits.map(visit => (
                  <div key={visit.visit_id} className="visit-item">
                    <div className="visit-header">
                      <span className="visit-date">{visit.visit_date}</span>
                      <span className="visit-purpose">{visit.visit_purpose}</span>
                    </div>
                    <div className="visit-content">{visit.visit_content}</div>
                    {visit.next_step && (
                      <div className="visit-next-step">下一步: {visit.next_step}</div>
                    )}
                    <div className="visit-footer">
                      <span className="visit-staff">{visit.investment_staff || "-"}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === "进度历史" && (
          <div className="tab-content">
            <div className="history-list">
              {placeholderHistory.map((item, idx) => (
                <div key={idx} className="history-item">
                  <span className="history-date">{item.date}</span>
                  <span className="history-transition">
                    {item.from} → {item.to}
                  </span>
                  <span className="history-by">by {item.by || "-"}</span>
                </div>
              ))}
            </div>
          </div>
        )}
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
            <button
              className="btn-primary"
              onClick={() => { setShowForm(true); setEditingCustomer(null); }}
            >
              新建客户
            </button>
            {filterStage === "全部" && filteredCustomers.length > 0 && (
              <button className="btn-secondary" onClick={handleCopyCompanyNames}>
                复制公司名
              </button>
            )}
          </div>
        </div>

        <div className="split-panel">
          <div className="split-panel-left">
            <div className="clue-admin-table-wrap">
              <table className="clue-admin-table">
                <thead>
                  <tr>
                    <th>客户名称</th>
                    <th>行业</th>
                    <th>招商人员</th>
                    <th>阶段</th>
                    <th>承租载体</th>
                    <th>租期预警</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map(customer => (
                    <tr
                      key={customer.customer_id}
                      className={`clickable-row ${selectedCustomer?.customer_id === customer.customer_id ? "row-selected" : ""}`}
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
                      <td>{customer.current_location || "-"}</td>
                      <td>
                        <LeaseWarning customer={customer} />
                      </td>
                    </tr>
                  ))}
                  {loading ? (
                    <tr><td colSpan={7} className="empty-cell">加载中...</td></tr>
                  ) : filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="empty-cell">暂无客户数据</td>
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

          <div className="split-panel-right">
            {selectedCustomer ? (
              <DetailPanel
                customer={selectedCustomer}
                onEdit={handleEdit}
                onClose={() => setSelectedCustomer(null)}
              />
            ) : (
              <div className="detail-empty-state">
                <div className="detail-empty-icon">📋</div>
                <p>选择客户查看详情</p>
              </div>
            )}
          </div>
        </div>
      </div>

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
            current_location: editingCustomer.current_location,
            rental_area: editingCustomer.rental_area,
            lease_start: editingCustomer.lease_start,
            lease_end: editingCustomer.lease_end,
            rental_status: editingCustomer.rental_status,
            contact_name: editingCustomer.contact_name,
            contact_title: editingCustomer.contact_title,
            contact_phone: editingCustomer.contact_phone,
            contact_wechat: editingCustomer.contact_wechat,
          } : undefined}
          onSave={handleCreated}
          onCancel={() => { setShowForm(false); setEditingCustomer(null); }}
        />
      )}
    </div>
  );
}