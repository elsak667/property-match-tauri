/**
 * 楼栋详情面板（地图 + 楼栋信息 + 楼层明细）
 * 被 CarrierPage 和 AIAssistant 共用
 */
import { useState, useEffect, useRef } from "react";
import L from "leaflet";
import { fetchBuildingDetail, type BuildingDetail } from "../lib/workers";
import { Icon } from "./Icons";

// 园区中心坐标（与 PropertyMap.ts 保持一致）
const PARK_COORDS: Record<string, [number, number]> = {
  PARK001: [31.2437, 121.6107],
  PARK002: [31.2405, 121.6080],
};
const MAP_CENTER: [number, number] = [31.242, 121.609];
const OFFSET_SCALE = 0.003;

function getFloorColor(floors: number | null | undefined): string {
  if (!floors) return "#94a3b8";
  if (floors >= 10) return "#c0392b";
  if (floors >= 5) return "#e67e22";
  return "#27ae60";
}

function getBldCoord(lat: number | null | undefined, lng: number | null | undefined, parkId: string): [number, number] | null {
  if (lat == null || lng == null) {
    const pc = PARK_COORDS[parkId];
    return pc ? pc : null;
  }
  const pc = PARK_COORDS[parkId] || MAP_CENTER;
  return [
    pc[0] - ((lat - 0.5) * OFFSET_SCALE),
    pc[1] + ((lng - 0.5) * OFFSET_SCALE),
  ];
}

interface Props {
  buildingId: string;
  onClose: () => void;
}

export default function BuildingDetailPanel({ buildingId, onClose }: Props) {
  const [detail, setDetail] = useState<BuildingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstRef = useRef<L.Map | null>(null);

  useEffect(() => {
    fetchBuildingDetail(buildingId)
      .then(d => { setDetail(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [buildingId]);

  // 地图
  useEffect(() => {
    if (!detail || !mapRef.current || mapInstRef.current) return;

    const coord = getBldCoord(detail.building.lat, detail.building.lng, detail.building.park_id);
    const map = L.map(mapRef.current, {
      center: coord || MAP_CENTER,
      zoom: 17,
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer("https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}", {
      maxZoom: 19, minZoom: 14,
      subdomains: "1234",
    }).addTo(map);

    if (coord) {
      const floors = detail.units.length || null;
      const color = getFloorColor(floors ?? null);
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:18px;height:18px;background:${color};border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.35);"></div>`,
        iconSize: [20, 20], iconAnchor: [10, 10],
      });
      L.marker(coord, { icon }).addTo(map);
    }

    mapInstRef.current = map;
    return () => {
      map.remove();
      mapInstRef.current = null;
    };
  }, [detail]);

  const b = detail?.building;
  const units = detail?.units || [];

  return (
    <div className="bdp-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bdp-drawer">
        {/* 头部 */}
        <div className="bdp-header">
          <div className="bdp-header-info">
            <div className="bdp-title"><Icon.buildingAccent /> {b?.name || buildingId}</div>
            <div className="bdp-subtitle">
              {b?.park_name} · {b?.district}
              {b?.industry && ` · ${b.industry}`}
            </div>
          </div>
          <button className="bdp-close" onClick={onClose}><Icon.closeSm /></button>
        </div>

        {loading && <div className="bdp-loading"><div className="spinner" />加载中…</div>}
        {error && <div className="bdp-error"><Icon.alertAccent /> {error}</div>}

        {detail && (
          <div className="bdp-body">
            {/* 地图 */}
            <div className="bdp-map-container">
              <div ref={mapRef} style={{ width: "100%", height: 200 }} />
            </div>

            {/* 统计摘要 */}
            <div className="bdp-stats">
              <div className="bdp-stat">
                <div className="bdp-stat-num">{units.length}</div>
                <div className="bdp-stat-label">楼层数</div>
              </div>
              <div className="bdp-stat">
                <div className="bdp-stat-num">{units.reduce((s, u) => s + (u.area_total ?? 0), 0).toLocaleString()}</div>
                <div className="bdp-stat-label">总面积（㎡）</div>
              </div>
              <div className="bdp-stat">
                <div className="bdp-stat-num" style={{ color: "#059669" }}>{units.reduce((s, u) => s + (u.area_vacant ?? 0), 0).toLocaleString()}</div>
                <div className="bdp-stat-label">空置（㎡）</div>
              </div>
              <div className="bdp-stat">
                <div className="bdp-stat-num" style={{ color: "#d97706" }}>
                  {units[0]?.price != null ? `${units[0].price}` : "—"}
                </div>
                <div className="bdp-stat-label">元/㎡/天</div>
              </div>
            </div>

            {/* 楼层明细 */}
            <div className="bdp-section-title">🚪 楼层详情</div>
            <div className="bdp-floor-table">
              <div className="bdp-floor-header">
                <span>楼层</span>
                <span>面积（㎡）</span>
                <span>空置（㎡）</span>
                <span>层高（m）</span>
                <span>租金</span>
              </div>
              {units.map(u => (
                <div key={u.unit_id} className="bdp-floor-row">
                  <span>{u.unit_no || `第${u.floor}层`}</span>
                  <span>{u.area_total?.toLocaleString() ?? "—"}</span>
                  <span>{u.area_vacant?.toLocaleString() ?? "—"}</span>
                  <span>{u.floor_height ?? "—"}</span>
                  <span>{u.price != null ? `${u.price}元/㎡·天` : "—"}</span>
                </div>
              ))}
            </div>

            {/* 备注 */}
            {b?.has_crane_beam && (
              <div className="bdp-tag">🚜 行车梁</div>
            )}
            {units.some(u => u.remark) && (
              <div className="bdp-remark">
                {units.find(u => u.remark)?.remark}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}