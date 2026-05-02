/**
 * 行为追踪 — 调用 Workers /api/track 端点
 * 所有追踪请求独立发送，不阻塞主流程
 */

const TRACK_ENDPOINT = "/api/track";
const SESSION_KEY = "pm_session";
const USE_WORKERS = import.meta.env.VITE_USE_WORKERS === "true";

function getSessionId(): string {
  let sid = sessionStorage.getItem(SESSION_KEY);
  if (!sid) {
    sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem(SESSION_KEY, sid);
  }
  return sid;
}

interface TrackPayload {
  action: string;
  policy_id?: string;
  unit_id?: string;
  search_query?: string;
  extra?: Record<string, unknown>;
}

export function trackEvent(payload: TrackPayload): void {
  const base = USE_WORKERS ? "https://api.elsak.eu.org" : "";
  const body = {
    session_id: getSessionId(),
    ...payload,
  };
  fetch(`${base}${TRACK_ENDPOINT}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});
}

export function trackExport(policyIds: string[]): void {
  if (!policyIds.length) return;
  const coExported = policyIds.slice(0, -1);
  trackEvent({ action: "export", extra: { co_exported: coExported } });
  for (const id of policyIds) {
    trackEvent({ action: "export", policy_id: id });
  }
}

export function trackClick(policyId: string): void {
  trackEvent({ action: "click", policy_id: policyId });
}

export function trackView(policyId: string): void {
  trackEvent({ action: "view", policy_id: policyId });
}

export function trackDetail(policyId: string): void {
  trackEvent({ action: "detail", policy_id: policyId });
}

export function trackSearch(query: string): void {
  if (!query.trim()) return;
  trackEvent({ action: "search", search_query: query });
}

export function trackUnitExport(unitId: string): void {
  trackEvent({ action: "export", unit_id: unitId });
}

export function trackCopy(policyId: string): void {
  trackEvent({ action: "copy", policy_id: policyId });
}
