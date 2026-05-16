import type { Clue } from "../../app/clue/types";

const API_BASE = "https://pudong-invest-platform.kokosspig.workers.dev/api";

export async function getClues(): Promise<Clue[]> {
  const res = await fetch(`${API_BASE}/invest-api/clues`, {
    method: "GET",
    mode: "cors",
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`获取线索失败: HTTP ${res.status} body=${text.slice(0, 200)}`);
  }
  const data = JSON.parse(text) as { data: Record<string, unknown>[] };
  return data.data as Clue[];
}

export async function updateClueStatus(id: string, status: string): Promise<void> {
  const fields: Record<string, unknown> = {};
  if (status !== "") fields.status = status;

  const res = await fetch(`${API_BASE}/invest-api/clues/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
    mode: "cors",
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`更新线索状态失败: HTTP ${res.status} body=${text.slice(0, 200)}`);
  }
}

export async function convertClue(id: string): Promise<{ customer_id: string }> {
  const res = await fetch(`${API_BASE}/invest-api/clues/${id}/convert`, {
    method: "POST",
    mode: "cors",
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`转化失败: HTTP ${res.status} body=${text.slice(0, 200)}`);
  }
  const data = JSON.parse(text) as { success: boolean; customer_id: string };
  return { customer_id: data.customer_id };
}

export async function submitClue(
  data: Omit<Clue, "clue_id" | "created_at" | "updated_at">
): Promise<Clue> {
  // Filter empty values (Bitable rejects empty strings for many field types)
  const fields: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== "" && v != null) fields[k] = v;
  }

  const res = await fetch(`${API_BASE}/invest-api/clues`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
    mode: "cors",
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`提交失败: HTTP ${res.status} body=${text.slice(0, 200)}`);
  }
  return JSON.parse(text);
}