/**
 * 载体地图页 — 无需筛选器，点击楼栋展示详情
 * 从 /api/buildings 加载楼栋数据，地图上点击楼栋打开详情面板
 */
import { useState, useEffect } from "react";
import { fetchBuildings, type BuildingSummary } from "../../lib/workers";
import BuildingDetailPanel from "../../components/BuildingDetailPanel";
import PropertyMap from "../../components/PropertyMap";

export default function CarrierPage() {
  const [buildings, setBuildings] = useState<BuildingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);

  useEffect(() => {
    fetchBuildings()
      .then(data => { setBuildings(data ?? []); setLoading(false); })
      .catch((e: Error) => { setError(e.message); setLoading(false); });
  }, []);

  const handleBuildingSelect = (buildingId: string) => {
    setSelectedBuildingId(buildingId);
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 400 }}>
        <div className="spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="load-error" style={{ margin: "24px auto", maxWidth: 480, textAlign: "center" }}>
        <strong>⚠️ 数据加载失败</strong><br />{error}
        <small>请检查网络或联系管理员</small>
      </div>
    );
  }

  return (
    <div style={{ padding: "0 0 48px" }}>
      {/* 地图 */}
      <PropertyMap
        buildings={buildings.map(b => ({
          building_id: b.building_id,
          name: b.name || b.building_id,
          industry: b.industry,
          park_id: b.park_id,
          park_name: b.park_name,
          area_vacant: b.area_vacant,
          floors: b.floors,
        }))}
        parks={[]}
        onSelect={handleBuildingSelect}
      />

      {/* 楼栋列表（辅助导航） */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 16px" }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          margin: "16px 0 12px",
          padding: "0 4px",
        }}>
          <span style={{ fontSize: 13, color: "#64748b" }}>
            共 <strong style={{ color: "#3b6db5" }}>{buildings.length}</strong> 栋楼
          </span>
          <span style={{ fontSize: 12, color: "#94a3b8" }}>点击地图标记查看详情</span>
        </div>

        {/* 按园区分组展示 */}
        {Object.entries(
          buildings.reduce<Record<string, BuildingSummary[]>>((acc, b) => {
            const key = b.park_name || b.park_id;
            if (!acc[key]) acc[key] = [];
            acc[key].push(b);
            return acc;
          }, {})
        ).map(([parkName, parkBuildings]) => (
          <div key={parkName} style={{ marginBottom: 24 }}>
            <div style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#3b6db5",
              padding: "6px 8px",
              borderBottom: "1px solid rgba(59,109,181,.15)",
              marginBottom: 6,
            }}>
              📍 {parkName}（{parkBuildings.length} 栋）
            </div>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 8,
            }}>
              {parkBuildings.map(b => (
                <div
                  key={b.building_id}
                  style={{
                    background: "#f8fafc",
                    border: "1px solid rgba(0,0,0,.07)",
                    borderRadius: 8,
                    padding: "10px 12px",
                    cursor: "pointer",
                    transition: "all .15s",
                  }}
                  onClick={() => setSelectedBuildingId(b.building_id)}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLDivElement).style.background = "#f0f4ff";
                    (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(59,109,181,.3)";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLDivElement).style.background = "#f8fafc";
                    (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(0,0,0,.07)";
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 13, color: "#1e293b", marginBottom: 4 }}>
                    🏢 {b.name}
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b", display: "flex", flexDirection: "column", gap: 2 }}>
                    {b.industry && <span>{b.industry}</span>}
                    <span>可租 <strong style={{ color: "#3b6db5" }}>{b.area_vacant.toLocaleString()}</strong> ㎡</span>
                    <span>{b.floors} 层</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 楼栋详情面板 */}
      {selectedBuildingId && (
        <BuildingDetailPanel
          buildingId={selectedBuildingId}
          onClose={() => setSelectedBuildingId(null)}
        />
      )}
    </div>
  );
}
