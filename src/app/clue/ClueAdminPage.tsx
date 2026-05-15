/**
 * 招商线索管理后台
 * Clue Admin Page — 内部管理界面
 */
import { useState } from "react";
import type { Clue, ClueStatus } from "./types";

/** Mock data — API stub 阶段使用 */
const MOCK_CLUES: Clue[] = [
  {
    clue_id: "C001",
    company_name: "上海鼎科技有限公司",
    contact_name: "张明",
    contact_phone: "13800138001",
    source_recommender: "李华",
    source_recommender_phone: "13900139001",
    required_area: 500,
    preferred_district: "浦东新区",
    target_property: "金桥园区",
    investment_staff: "王经理",
    status: "待核实",
    created_at: "2026-05-10 09:30:00",
    updated_at: "2026-05-10 09:30:00",
  },
  {
    clue_id: "C002",
    company_name: "北京创新医疗有限公司",
    contact_name: "赵雪",
    contact_phone: "13800138002",
    source_recommender: "周杰",
    source_recommender_phone: "13900139002",
    required_area: 1200,
    preferred_district: "海淀区",
    target_property: "中关村园区",
    investment_staff: "刘经理",
    status: "跟进中",
    created_at: "2026-05-08 14:20:00",
    updated_at: "2026-05-12 10:15:00",
  },
  {
    clue_id: "C003",
    company_name: "深圳智能制造股份有限公司",
    contact_name: "陈志强",
    contact_phone: "13800138003",
    source_recommender: "吴婷",
    source_recommender_phone: "13900139003",
    required_area: 3000,
    preferred_district: "南山区",
    target_property: "深圳湾科技园",
    investment_staff: "张经理",
    status: "已转化",
    created_at: "2026-04-20 11:00:00",
    updated_at: "2026-05-14 16:30:00",
  },
  {
    clue_id: "C004",
    company_name: "广州新材料有限公司",
    contact_name: "林小红",
    contact_phone: "13800138004",
    source_recommender: "黄伟",
    source_recommender_phone: "13900139004",
    required_area: 800,
    preferred_district: "黄埔区",
    investment_staff: "李经理",
    status: "已失效",
    created_at: "2026-04-15 08:45:00",
    updated_at: "2026-05-01 09:00:00",
  },
  {
    clue_id: "C005",
    company_name: "杭州数字科技有限公司",
    contact_name: "王磊",
    contact_phone: "13800138005",
    source_recommender: "马云",
    source_recommender_phone: "13900139005",
    required_area: 600,
    preferred_district: "滨江区",
    target_property: "阿里中心",
    status: "待核实",
    created_at: "2026-05-13 15:00:00",
    updated_at: "2026-05-13 15:00:00",
  },
];

const STATUS_OPTIONS: ClueStatus[] = ["待核实", "跟进中", "已转化", "已失效"];

const STATUS_COLORS: Record<ClueStatus, string> = {
  "待核实": "#f59e0b",
  "跟进中": "#3b82f6",
  "已转化": "#22c55e",
  "已失效": "#94a3b8",
};

interface DetailModalProps {
  clue: Clue;
  onClose: () => void;
}

function DetailModal({ clue, onClose }: DetailModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>线索详情</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="detail-grid">
            <div className="detail-item">
              <span className="detail-label">线索ID</span>
              <span className="detail-value">{clue.clue_id || "-"}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">企业名称</span>
              <span className="detail-value">{clue.company_name}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">联系人</span>
              <span className="detail-value">{clue.contact_name}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">联系电话</span>
              <span className="detail-value">{clue.contact_phone}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">推荐人</span>
              <span className="detail-value">{clue.source_recommender}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">推荐人电话</span>
              <span className="detail-value">{clue.source_recommender_phone}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">需求面积</span>
              <span className="detail-value">{clue.required_area} m²</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">意向区域</span>
              <span className="detail-value">{clue.preferred_district || "-"}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">目标物业</span>
              <span className="detail-value">{clue.target_property || "-"}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">招商人员</span>
              <span className="detail-value">{clue.investment_staff || "-"}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">状态</span>
              <span
                className="detail-value status-badge"
                style={{ background: STATUS_COLORS[clue.status] }}
              >
                {clue.status}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">创建时间</span>
              <span className="detail-value">{clue.created_at || "-"}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">更新时间</span>
              <span className="detail-value">{clue.updated_at || "-"}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ClueAdminPage() {
  const [clues, setClues] = useState<Clue[]>(MOCK_CLUES);
  const [selectedClue, setSelectedClue] = useState<Clue | null>(null);
  const [filterStatus, setFilterStatus] = useState<ClueStatus | "全部">("全部");

  const handleStatusChange = (clueId: string, newStatus: ClueStatus) => {
    setClues(prev =>
      prev.map(c =>
        c.clue_id === clueId
          ? { ...c, status: newStatus, updated_at: new Date().toISOString().slice(0, 19).replace("T", " ") }
          : c
      )
    );
  };

  const filteredClues = filterStatus === "全部"
    ? clues
    : clues.filter(c => c.status === filterStatus);

  return (
    <div className="container">
      <div className="clue-admin-container">
        <div className="clue-admin-header">
          <div>
            <h1 className="page-title">招商线索管理</h1>
            <p className="page-subtitle">管理所有招商线索，跟进状态，查看详情</p>
          </div>
          <div className="clue-admin-actions">
            <select
              className="filter-select"
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as ClueStatus | "全部")}
            >
              <option value="全部">全部状态</option>
              {STATUS_OPTIONS.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="clue-admin-table-wrap">
          <table className="clue-admin-table">
            <thead>
              <tr>
                <th>企业名称</th>
                <th>联系人</th>
                <th>推荐人</th>
                <th>需求面积</th>
                <th>招商人员</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredClues.map(clue => (
                <tr key={clue.clue_id}>
                  <td className="cell-company">{clue.company_name}</td>
                  <td>{clue.contact_name}</td>
                  <td>{clue.source_recommender}</td>
                  <td>{clue.required_area} m²</td>
                  <td>{clue.investment_staff || "-"}</td>
                  <td>
                    <select
                      className="status-select"
                      value={clue.status}
                      onChange={e => handleStatusChange(clue.clue_id!, e.target.value as ClueStatus)}
                      style={{ borderColor: STATUS_COLORS[clue.status] }}
                    >
                      {STATUS_OPTIONS.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button
                      className="btn-detail"
                      onClick={() => setSelectedClue(clue)}
                    >
                      详情
                    </button>
                  </td>
                </tr>
              ))}
              {filteredClues.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty-cell">暂无线索数据</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="clue-admin-summary">
          <span>共 {filteredClues.length} 条线索</span>
          <span className="summary-sep">·</span>
          <span>待核实: {clues.filter(c => c.status === "待核实").length}</span>
          <span className="summary-sep">·</span>
          <span>跟进中: {clues.filter(c => c.status === "跟进中").length}</span>
          <span className="summary-sep">·</span>
          <span>已转化: {clues.filter(c => c.status === "已转化").length}</span>
          <span className="summary-sep">·</span>
          <span>已失效: {clues.filter(c => c.status === "已失效").length}</span>
        </div>
      </div>

      {selectedClue && (
        <DetailModal clue={selectedClue} onClose={() => setSelectedClue(null)} />
      )}
    </div>
  );
}