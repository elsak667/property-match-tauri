"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface Building {
  building_id: string;
  name?: string;
  park_id: string;
  floors: number | null;
  area_vacant: number | null;
  rel_x: number | null;
  rel_y: number | null;
}

interface Park {
  park_id: string;
  name?: string;
  lat: number | null;
  lng: number | null;
}

interface Props {
  buildings: Building[];
  parks?: Park[];
}

function getFloorColor(floors: number | null): string {
  if (!floors) return "#94a3b8";
  if (floors >= 10) return "#c0392b";
  if (floors >= 5) return "#e67e22";
  return "#27ae60";
}

const PARK_COORDS: Record<string, [number, number]> = {
  PARK001: [31.2437, 121.6107],
  PARK002: [31.2405, 121.6080],
};
const MAP_CENTER: [number, number] = [31.242, 121.609];
const MAP_ZOOM = 15;
const OFFSET_SCALE = 0.003;

export default function PropertyMap({ buildings, parks = [] }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const infoControlRef = useRef<L.Control | null>(null);
  const [selectedBld, setSelectedBld] = useState<Building | null>(null);
  const [selectedPark, setSelectedPark] = useState<string | null>(null);

  const filteredBuildings = selectedPark
    ? buildings.filter(b => b.park_id === selectedPark)
    : buildings;

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: MAP_CENTER,
      zoom: MAP_ZOOM,
      zoomControl: true,
      attributionControl: false,
    });
    mapInstanceRef.current = map;

    L.tileLayer(
      "https://tile.thunderforest.com/cycle/{z}/{x}/{y}.png",
      { maxZoom: 19, minZoom: 12 }
    ).addTo(map);

    const legend = (L.control as any)({ position: "bottomright" });
    legend.onAdd = () => {
      const div = L.DomUtil.create("div", "leaflet-legend");
      div.style.cssText = "background:white;padding:8px 12px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.2);font-size:12px;line-height:1.8";
      div.innerHTML = `
        <div style="font-weight:700;margin-bottom:4px">楼栋层数</div>
        <div><span style="display:inline-block;width:12px;height:12px;background:#27ae60;border-radius:2px;margin-right:4px;vertical-align:middle"></span>≤5层</div>
        <div><span style="display:inline-block;width:12px;height:12px;background:#e67e22;border-radius:2px;margin-right:4px;vertical-align:middle"></span>6-9层</div>
        <div><span style="display:inline-block;width:12px;height:12px;background:#c0392b;border-radius:2px;margin-right:4px;vertical-align:middle"></span>≥10层</div>
      `;
      return div;
    };
    legend.addTo(map);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    markersRef.current.forEach(m => map.removeLayer(m));
    markersRef.current = [];

    if (infoControlRef.current) {
      map.removeControl(infoControlRef.current);
      infoControlRef.current = null;
    }

    const parkStats: Record<string, { count: number; vacant: number; name: string }> = {};
    filteredBuildings.forEach(b => {
      if (!parkStats[b.park_id]) {
        const park = parks.find(p => p.park_id === b.park_id);
        parkStats[b.park_id] = { count: 0, vacant: 0, name: park?.name || b.park_id };
      }
      parkStats[b.park_id].count++;
      parkStats[b.park_id].vacant += b.area_vacant || 0;
    });

    const info = (L.control as any)({ position: "topright" });
    info.onAdd = () => {
      const div = L.DomUtil.create("div");
      let html = `<div style="background:white;padding:10px 14px;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,0.18);min-width:160px;font-size:12px;font-family:PingFang SC,sans-serif">`;
      html += `<div style="font-weight:700;margin-bottom:6px">🏢 园区概览</div>`;
      Object.entries(parkStats).forEach(([_pid, p]) => {
        html += `<div style="margin:3px 0;color:#333">${p.name}</div>`;
        html += `<div style="color:#888;font-size:11px;padding-left:8px">${p.count}栋 · 空置${p.vacant.toLocaleString()}㎡</div>`;
      });
      const totalBld = filteredBuildings.length;
      const totalVacant = filteredBuildings.reduce((s, b) => s + (b.area_vacant || 0), 0);
      html += `<div style="border-top:1px solid #eee;margin-top:6px;padding-top:6px;color:#059669;font-weight:600">合计 ${totalBld}栋 · ${totalVacant.toLocaleString()}㎡</div>`;
      html += `</div>`;
      div.innerHTML = html;
      return div;
    };
    infoControlRef.current = info;
    info.addTo(map);

    const relX = (v: number | null) => ((v ?? 0.5) - 0.5) * OFFSET_SCALE;
    const relY = (v: number | null) => ((v ?? 0.5) - 0.5) * OFFSET_SCALE;
    let markerIndex = 0;
    const jitter = () => (Math.random() - 0.5) * 0.0008;

    filteredBuildings.forEach(b => {
      const parkCoord = PARK_COORDS[b.park_id];
      if (!parkCoord) return;

      const floors = b.floors || 5;
      const color = getFloorColor(floors);
      const name = b.name || b.building_id;
      const vacant = ((b.area_vacant || 0)).toLocaleString();

      const j = jitter();
      const lng = parkCoord[1] + relX(b.rel_x) + j;
      const lat = parkCoord[0] - relY(b.rel_y) + j;
      markerIndex++;

      const icon = L.divIcon({
        className: "",
        html: `<div style="width:14px;height:14px;background:${color};border-radius:50%;border:2.5px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);cursor:pointer"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });

      const marker = L.marker([lat, lng], { icon, zIndexOffset: floors * 100 });
      marker.on("click", () => setSelectedBld(b));
      marker.bindPopup(
        `<div style="font-family:PingFang SC,sans-serif;min-width:150px;padding:2px 0">
          <div style="font-weight:700;font-size:14px;margin-bottom:4px;border-bottom:1px solid #eee;padding-bottom:6px">🏢 ${name}</div>
          <div style="color:#888;font-size:11px;margin-bottom:4px">${parkStats[b.park_id]?.name || b.park_id}</div>
          <div style="font-size:12px;line-height:1.8">
            <div><span style="color:#888">层数：</span><b>${floors}F</b></div>
            <div><span style="color:#888">空置：</span><b>${vacant}㎡</b></div>
          </div>
        </div>`,
        { maxWidth: 180, className: "bld-popup" }
      );
      marker.addTo(map);
      markersRef.current.push(marker);
    });

    return () => {
      if (infoControlRef.current) {
        map.removeControl(infoControlRef.current);
        infoControlRef.current = null;
      }
    };
  }, [buildings, selectedPark, parks]);

  const parkSummaries = Object.entries(PARK_COORDS).map(([pid, _coords]) => {
    const blds = buildings.filter(b => b.park_id === pid);
    const vacant = blds.reduce((s, b) => s + (b.area_vacant || 0), 0);
    const park = parks.find(p => p.park_id === pid);
    return { pid, name: park?.name || pid, blds, vacant };
  });

  return (
    <div style={{ marginTop: 0 }}>
      {/* 园区筛选按钮 */}
      <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
        <button
          onClick={() => setSelectedPark(null)}
          style={{
            padding: "5px 14px", borderRadius: 20, border: "none",
            fontSize: 12, fontWeight: 600, cursor: "pointer",
            background: selectedPark === null ? "#059669" : "#f0f0f0",
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
              background: selectedPark === pid ? "#059669" : "#f0f0f0",
              color: selectedPark === pid ? "white" : "#555",
              transition: "all 0.15s",
            }}
          >
            {name}
          </button>
        ))}
      </div>

      {/* Leaflet 地图 */}
      <div className="map-wrap">
        <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
      </div>

      {/* 选中详情 */}
      {selectedBld && (
        <div style={{
          marginTop: 10, background: "white", borderRadius: 10,
          padding: "12px 16px",
          border: `1px solid ${getFloorColor(selectedBld.floors)}30`,
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>
              🏢 {selectedBld.name || selectedBld.building_id}
            </div>
            <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>
              {parkSummaries.find(p => p.pid === selectedBld.park_id)?.name}
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
            style={{
              background: "#f5f5f5", border: "none", borderRadius: 6,
              padding: "4px 12px", fontSize: 12, color: "#999", cursor: "pointer",
            }}
          >关闭</button>
        </div>
      )}

      <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", marginTop: 6 }}>
        📍 Thunderforest 瓦片 · 点击圆点标记查看详情
      </div>
    </div>
  );
}
