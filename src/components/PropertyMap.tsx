import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Property } from "../app/property/types";

// 张江科学城中心
const MAP_CENTER: [number, number] = [31.206, 121.628];
const MAP_ZOOM = 14;

function getFloorColor(floors: number | null | undefined): string {
  if (!floors) return "#94a3b8";
  if (floors >= 10) return "#c0392b";
  if (floors >= 5) return "#e67e22";
  return "#27ae60";
}

interface Props {
  buildings: Property[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
}

export default function PropertyMap({ buildings, selectedId, onSelect }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);

  // 初始化地图
  useEffect(() => {
    if (!mapRef.current || mapInstRef.current) return;
    const map = L.map(mapRef.current, {
      center: MAP_CENTER, zoom: MAP_ZOOM, zoomControl: true,
      attributionControl: false,
    });
    mapInstRef.current = map;
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19, minZoom: 12,
    }).addTo(map);

    // 图例（自定义 HTML，零依赖）
    const legendDiv = document.createElement("div");
    legendDiv.style.cssText = "background:white;padding:8px 12px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.2);font-size:12px;line-height:1.8;position:absolute;bottom:20px;right:10px;z-index:1000";
    legendDiv.innerHTML = `<div style="font-weight:700;margin-bottom:4px">楼栋层数</div>
      <div><span style="display:inline-block;width:12px;height:12px;background:#27ae60;border-radius:2px;margin-right:4px;vertical-align:middle"></span>≤5层</div>
      <div><span style="display:inline-block;width:12px;height:12px;background:#e67e22;border-radius:2px;margin-right:4px;vertical-align:middle"></span>6-9层</div>
      <div><span style="display:inline-block;width:12px;height:12px;background:#c0392b;border-radius:2px;margin-right:4px;vertical-align:middle"></span>≥10层</div>`;
    mapRef.current.appendChild(legendDiv);

    return () => { map.remove(); mapInstRef.current = null; };
  }, []);

  // 更新楼栋标记
  useEffect(() => {
    const map = mapInstRef.current;
    if (!map) return;
    markersRef.current.forEach(m => map.removeLayer(m));
    markersRef.current = [];

    buildings.forEach(b => {
      if (b.lat == null || b.lng == null) return;
      const floors = b.height || 5;
      const color = getFloorColor(floors);
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:14px;height:14px;background:${color};border-radius:50%;border:2.5px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);cursor:pointer;"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      const marker = L.marker([b.lat, b.lng], { icon, zIndexOffset: floors * 100 });
      marker.on("click", () => onSelect(b.id));
      marker.bindPopup(`<div style="font-family:PingFang SC,sans-serif;min-width:150px">
        <div style="font-weight:700;font-size:14px;margin-bottom:4px;border-bottom:1px solid #eee;padding-bottom:6px">🏢 ${b.name}</div>
        <div style="color:#888;font-size:11px;margin-bottom:4px">${b.park}</div>
        <div style="font-size:12px;line-height:1.8">
          <div><span style="color:#888">层高：</span><b>${floors}m</b></div>
          <div><span style="color:#888">面积：</span><b>${b.areaMin || "?"}–${b.areaMax || "?"}㎡</b></div>
          <div><span style="color:#888">类型：</span><b>${b.type || "—"}</b></div>
        </div>
      </div>`, { maxWidth: 180 });
      marker.addTo(map);
      markersRef.current.push(marker);
    });
  }, [buildings, onSelect]);

  // 地图跟随选中
  useEffect(() => {
    const map = mapInstRef.current;
    if (!map || selectedId == null) return;
    const b = buildings.find(x => x.id === selectedId);
    if (b?.lat != null && b?.lng != null) {
      map.flyTo([b.lat, b.lng], 16, { duration: 0.8 });
    }
  }, [selectedId, buildings]);

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{
        borderRadius: 12, overflow: "hidden",
        border: "1px solid rgba(59,109,181,.15)",
        boxShadow: "0 2px 12px rgba(59,109,181,.1)",
      }}>
        <div ref={mapRef} style={{ width: "100%", height: 400 }} />
      </div>
      <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", marginTop: 6 }}>
        📍 基于 OpenStreetMap · 点击圆点标记查看详情
      </div>
    </div>
  );
}
