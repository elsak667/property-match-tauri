interface NavBarProps {
  totalPolicies?: number;
  systemStatus: "normal" | "error";
}

export default function NavBar({ totalPolicies = 0, systemStatus }: NavBarProps) {
  return (
    <div style={{
      background: "linear-gradient(135deg, #3b6db5, #5b8fd9)",
      borderRadius: "12px",
      padding: "16px 22px",
      marginBottom: "12px",
      color: "#fff",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
        <span style={{ fontSize: "20px", fontWeight: 700 }}>📋 浦东新区政策智能匹配系统</span>
        <span style={{
          fontSize: "11px", fontWeight: 600,
          background: "rgba(255,200,0,.25)",
          color: "#fff",
          padding: "2px 8px",
          borderRadius: "10px",
          border: "1px solid rgba(255,200,0,.4)",
        }}>🚫 内部使用</span>
        <span style={{
          fontSize: "11px",
          background: "rgba(255,255,255,.2)",
          color: "#fff",
          padding: "2px 8px",
          borderRadius: "10px",
        }}>v2.0 (Tauri)</span>
        <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", color: systemStatus === "normal" ? "#93c5fd" : "#fca5a5", marginLeft: "auto" }}>
          <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: systemStatus === "normal" ? "#4ade80" : "#ef4444", display: "inline-block" }} />
          {systemStatus === "normal" ? "系统正常" : "数据异常"}
        </span>
      </div>
      <p style={{ fontSize: "12px", color: "rgba(255,255,255,.8)", margin: 0 }}>
        <span>📅 <strong>{totalPolicies}</strong> 条政策</span>
        <span style={{ marginLeft: "14px" }}>🏢 企业/个人 · 行业标签 · 金额筛选 · PDF导出</span>
      </p>
    </div>
  );
}
