import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface Building {
  building_id?: string;
  name?: string;
  park_id?: string;
  park_name?: string;
  floors?: number | null;
  area_vacant?: number | null;
  area_total?: number | null;
  building_type?: string;
  rel_x?: number | null;
  rel_y?: number | null;
  "纬度(lat)"?: number | null;
  "经度(lng)"?: number | null;
}

interface Park {
  park_id?: string;
  name?: string;
  lat?: number | null;
  lng?: number | null;
  "纬度(lat)"?: number | null;
  "经度(lng)"?: number | null;
}

interface Props {
  buildings: Building[];
  parks?: Park[];
  selectedId?: number | null;
  onSelect?: (id: number | null) => void;
}

// 金桥区域园区中心 GPS 坐标（硬编码，与飞书数据配套）
const PARK_COORDS: Record<string, [number, number]> = {
  PARK001: [31.2437, 121.6107],
  PARK002: [31.2405, 121.6080],
};
const MAP_CENTER: [number, number] = [31.242, 121.609];

const OFFSET_SCALE = 0.003;
const relX = (v: number | null | undefined) => ((v ?? 0.5) - 0.5) * OFFSET_SCALE;
const relY = (v: number | null | undefined) => ((v ?? 0.5) - 0.5) * OFFSET_SCALE;

function getFloorColor(floors: number | null | undefined): string {
  if (!floors) return "#94a3b8";
  if (floors >= 10) return "#c0392b";
  if (floors >= 5) return "#e67e22";
  return "#27ae60";
}

function getBldCoord(b: Building): [number, number] | null {
  const pid = b.park_id;
  if (!pid) return null;
  const parkCoord = PARK_COORDS[pid];
  if (!parkCoord) return null;
  // "纬度(lat)" / "经度(lng)" 在飞书表里是相对坐标（0-1），不是绝对 GPS
  // 它们实际上是 rel_x/rel_y 的别名，按园区中心偏移
  const lat = parkCoord[0] - relY(b["纬度(lat)"]);
  const lng = parkCoord[1] + relX(b["经度(lng)"]);
  return [lat, lng];
}

export default function PropertyMap({ buildings, parks = [], selectedId, onSelect }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const infoControlRef = useRef<L.Control | null>(null);
  const legendRef = useRef<L.Control | null>(null);
  const [selectedBld, setSelectedBld] = useState<Building | null>(null);
  const [selectedPark, setSelectedPark] = useState<string | null>(null);

  const filteredBuildings = selectedPark
    ? buildings.filter(b => b.park_id === selectedPark)
    : buildings;

  // 初始化地图
  useEffect(() => {
    if (!mapRef.current || mapInstRef.current) return;
    const map = L.map(mapRef.current, {
      center: MAP_CENTER,
      zoom: 15,
      zoomControl: true,
      attributionControl: false,
    });
    mapInstRef.current = map;

    L.tileLayer("https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}", {
      maxZoom: 19, minZoom: 12,
      subdomains: "1234",
    }).addTo(map);

    // 右下角图例（用 L.control，与 Desktop 版一致）
    const legend = (L.control as any)({ position: "bottomright" });
    legend.onAdd = () => {
      const div = L.DomUtil.create("div");
      div.style.cssText = "background:white;padding:8px 12px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.2);font-size:12px;line-height:1.8";
      div.innerHTML = `
        <div style="font-weight:700;margin-bottom:4px">楼栋层数</div>
        <div><span style="display:inline-block;width:12px;height:12px;background:#27ae60;border-radius:2px;margin-right:4px;vertical-align:middle"></span>≤5层</div>
        <div><span style="display:inline-block;width:12px;height:12px;background:#e67e22;border-radius:2px;margin-right:4px;vertical-align:middle"></span>6-9层</div>
        <div><span style="display:inline-block;width:12px;height:12px;background:#c0392b;border-radius:2px;margin-right:4px;vertical-align:middle"></span>≥10层</div>`;
      return div;
    };
    legend.addTo(map);
    legendRef.current = legend;

    return () => {
      map.remove();
      mapInstRef.current = null;
    };
  }, []);

  // 更新标记
  useEffect(() => {
    const map = mapInstRef.current;
    if (!map) return;

    markersRef.current.forEach(m => map.removeLayer(m));
    markersRef.current = [];

    if (infoControlRef.current) {
      map.removeControl(infoControlRef.current);
      infoControlRef.current = null;
    }

    // 右上角园区统计卡
    const parkStats: Record<string, { count: number; vacant: number; name: string }> = {};
    filteredBuildings.forEach(b => {
      if (!parkStats[b.park_id!]) {
        const park = parks.find(p => p.park_id === b.park_id);
        parkStats[b.park_id!] = { count: 0, vacant: 0, name: park?.name || b.park_id || "" };
      }
      parkStats[b.park_id!].count++;
      parkStats[b.park_id!].vacant += b.area_vacant || 0;
    });

    const info = (L.control as any)({ position: "topright" });
    info.onAdd = () => {
      const div = L.DomUtil.create("div");
      let html = `<div style="background:white;padding:10px 14px;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,.18);min-width:160px;font-size:12px;font-family:PingFang SC,sans-serif">`;
      html += `<div style="font-weight:700;margin-bottom:6px">🏢 园区概览</div>`;
      Object.entries(parkStats).forEach(([_pid, p]) => {
        html += `<div style="margin:3px 0;color:#333">${p.name}</div>`;
        html += `<div style="color:#888;font-size:11px;padding-left:8px">${p.count}栋 · 空置${p.vacant.toLocaleString()}㎡</div>`;
      });
      const totalBld = filteredBuildings.length;
      const totalVacant = filteredBuildings.reduce((s, b) => s + (b.area_vacant || 0), 0);
      html += `<div style="border-top:1px solid #eee;margin-top:6px;padding-top:6px;color:#3b6db5;font-weight:600">合计 ${totalBld}栋 · ${totalVacant.toLocaleString()}㎡</div>`;
      html += `</div>`;
      div.innerHTML = html;
      return div;
    };
    infoControlRef.current = info;
    info.addTo(map);

    filteredBuildings.forEach((b, idx) => {
      const coord = getBldCoord(b);
      if (!coord) return;

      const floors = b.floors ?? null;
      const color = getFloorColor(floors);
      const name = b.name || b.building_id || "";
      const vacant = (b.area_vacant || 0).toLocaleString();
      const parkName = b.park_name || parks.find(p => p.park_id === b.park_id)?.name || b.park_id || "";

      const icon = L.divIcon({
        className: "",
        html: `<div style="width:14px;height:14px;background:${color};border-radius:50%;border:2.5px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3);cursor:pointer;"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });

      const marker = L.marker(coord, { icon, zIndexOffset: (floors ?? 5) * 100 });
      marker.on("click", () => {
        setSelectedBld(b);
        if (onSelect) onSelect(idx);
      });
      marker.bindPopup(`<div style="font-family:PingFang SC,sans-serif;min-width:150px">
        <div style="font-weight:700;font-size:14px;margin-bottom:4px;border-bottom:1px solid #eee;padding-bottom:6px">🏢 ${name}</div>
        <div style="color:#888;font-size:11px;margin-bottom:4px">${parkName}</div>
        <div style="font-size:12px;line-height:1.8">
          <div><span style="color:#888">层数：</span><b>${floors != null ? `${floors}F` : "—"}</b></div>
          <div><span style="color:#888">空置：</span><b style="color:#059669">${vacant}㎡</b></div>
        </div>
      </div>`, { maxWidth: 200, className: "bld-popup" });
      marker.addTo(map);
      markersRef.current.push(marker);
    });

    return () => {
      if (infoControlRef.current) {
        map.removeControl(infoControlRef.current);
        infoControlRef.current = null;
      }
    };
  }, [filteredBuildings, selectedPark, parks, onSelect]);

  // 跟随选中
  useEffect(() => {
    const map = mapInstRef.current;
    if (!map || selectedId == null) return;
    const b = buildings[selectedId];
    if (!b) return;
    const coord = getBldCoord(b);
    if (coord) map.flyTo(coord, 16, { duration: 0.8 });
  }, [selectedId, buildings]);

  const totalVacant = filteredBuildings.reduce((s, b) => s + (b.area_vacant || 0), 0);
  const parkSummaries = Object.entries(PARK_COORDS).map(([pid, _coord]) => {
    const blds = buildings.filter(b => b.park_id === pid);
    const vacant = blds.reduce((s, b) => s + (b.area_vacant || 0), 0);
    const park = parks.find(p => p.park_id === pid);
    return { pid, name: park?.name || pid, blds, vacant };
  });

  return (
    <div style={{ marginTop: 12 }}>
      {/* 顶部园区筛选 */}
      <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
        <button
          onClick={() => setSelectedPark(null)}
          style={{
            padding: "5px 14px", borderRadius: 20, border: "none",
            fontSize: 12, fontWeight: 600, cursor: "pointer",
            background: selectedPark === null ? "#3b6db5" : "#f0f0f0",
            color: selectedPark === null ? "white" : "#555",
            transition: "all 0.15s",
          }}
        >全部园区</button>
        {parkSummaries.filter(p => p.blds.length > 0).map(({ pid, name }) => (
          <button
            key={pid}
            onClick={() => setSelectedPark(pid)}
            style={{
              padding: "5px 14px", borderRadius: 20, border: "none",
              fontSize: 12, fontWeight: 600, cursor: "pointer",
              background: selectedPark === pid ? (pid === "PARK001" ? "#3b6db5" : "#8b5cf6") : "#f0f0f0",
              color: selectedPark === pid ? "white" : "#555",
              transition: "all 0.15s",
            }}
          >{name}</button>
        ))}
      </div>

      <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid rgba(59,109,181,.15)", boxShadow: "0 2px 12px rgba(59,109,181,.1)" }}>
        <div ref={mapRef} style={{ width: "100%", height: 420 }} />
      </div>

      {selectedBld && (
        <div style={{
          marginTop: 10, background: "white", borderRadius: 10,
          padding: "12px 16px",
          border: `1px solid ${getFloorColor(selectedBld.floors)}30`,
          boxShadow: "0 2px 8px rgba(0,0,0,.08)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>
              🏢 {selectedBld.name || selectedBld.building_id}
            </div>
            <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>
              {selectedBld.park_name || selectedBld.park_id}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: getFloorColor(selectedBld.floors) }}>
              {selectedBld.floors || "?"}F
            </div>
            <div style={{ fontSize: 12, color: "#999" }}>
              空置 {(selectedBld.area_vacant || 0).toLocaleString()}㎡
            </div>
          </div>
          <button
            onClick={() => setSelectedBld(null)}
            style={{ background: "#f5f5f5", border: "none", borderRadius: 6, padding: "4px 12px", fontSize: 12, color: "#999", cursor: "pointer" }}
          >关闭</button>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94a3b8", textAlign: "center", marginTop: 6 }}>
        <span>📍 基于 OpenStreetMap · 点击圆点标记查看详情</span>
        <span>共 {filteredBuildings.length} 栋 · 空置 {totalVacant.toLocaleString()}㎡</span>
      </div>
    </div>
  );
}
