/**
 * 产业快讯 — 左侧竖排滚动面板
 */
import { useState } from "react";
import { openInBrowser } from "../lib/tauri";

interface NewsItem {
  time: string;
  category: string;
  title: string;
  link: string;
  summary: string;
}

interface Props {
  news: NewsItem[];
}

const CATEGORY_COLORS: Record<string, string> = {
  IPO: "#e74c3c",
  投融资: "#27ae60",
  人事: "#2980b9",
  新增企业: "#8e44ad",
  政策: "#f39c12",
  收并购: "#c0392b",
  产业项目: "#16a085",
  其他动态: "#7f8c8d",
};

function getColor(cat: string): string {
  return CATEGORY_COLORS[cat] || "#7f8c8d";
}

export default function NewsTicker({ news }: Props) {
  const [paused, setPaused] = useState(false);

  if (news.length === 0) {
    return (
      <div className="news-ticker">
        <div className="news-ticker-header">
          <span>📰</span>
          <span className="news-ticker-label">产业快讯</span>
        </div>
        <span className="news-ticker-empty-text">暂无快讯内容</span>
      </div>
    );
  }

  const items = [...news, ...news];

  return (
    <div
      className="news-ticker"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="news-ticker-header">
        <span>📰</span>
        <span className="news-ticker-label">产业快讯</span>
      </div>

      <div className="news-ticker-track-wrap">
        <div className={`news-ticker-track${paused ? " paused" : ""}`}>
          {items.map((item, i) => (
            <div
              key={i}
              className="news-ticker-item"
              onClick={() => item.link && openInBrowser(item.link)}
              title={item.summary || item.title}
            >
              <div className="news-ticker-meta">
                <span className="news-ticker-time">{item.time}</span>
                <span
                  className="news-ticker-cat"
                  style={{ background: getColor(item.category) }}
                >
                  {item.category}
                </span>
              </div>
              <span className="news-ticker-title">{item.title}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
