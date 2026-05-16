/**
 * 招商线索管理后台
 * Clue Admin Page — 内部管理界面
 */
import { useState, useEffect } from "react";
import type { Clue, ClueStatus } from "./types";
import { getClues, updateClueStatus, convertClue } from "../../lib/invest/clue";

const STATUS_OPTIONS: ClueStatus[] = ["待核实", "跟进中", "已转化", "已失效"];

const STATUS_COLORS: Record<ClueStatus, string> = {
  "待核实": "#94a3b8",
  "跟进中": "#3b82f6",
  "已转化": "#22c55e",
  "已失效": "#ef4444",
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
  const [clues, setClues] = useState<Clue[]>([]);
  const [selectedClue, setSelectedClue] = useState<Clue | null>(null);
  const [filterStatus, setFilterStatus] = useState<ClueStatus | "全部">("全部");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadClues = () => {
    setLoading(true);
    getClues()
      .then(data => setClues(data as Clue[]))
      .catch(err => console.error("加载线索失败:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadClues();
  }, []);

  const handleStatusChange = (clueId: string, newStatus: ClueStatus) => {
    // Optimistic update
    setClues(prev =>
      prev.map(c =>
        c.clue_id === clueId ? { ...c, status: newStatus } : c
      )
    );
    updateClueStatus(clueId, newStatus).catch(err => {
      console.error("更新状态失败:", err);
    });
  };

  const handleConvert = (clueId: string) => {
    if (!confirm("确认转化？将创建客户记录。")) return;
    convertClue(clueId)
      .then(() => {
        setMessage({ type: "success", text: "已转化，客户创建成功" });
        loadClues();
        setTimeout(() => setMessage(null), 3000);
      })
      .catch(err => {
        console.error("转化失败:", err);
        setMessage({ type: "error", text: `转化失败: ${err}` });
        setTimeout(() => setMessage(null), 5000);
      });
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
          {message && (
            <div className={`alert alert-${message.type}`}>{message.text}</div>
          )}
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
                    {clue.status === "跟进中" && (
                      <button
                        className="btn-convert"
                        onClick={() => handleConvert(clue.clue_id!)}
                      >
                        转化
                      </button>
                    )}
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