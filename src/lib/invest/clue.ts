import type { Clue } from "../../app/clue/types";

const API_BASE = "https://pudong-invest-platform.kokosspig.workers.dev/api";

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