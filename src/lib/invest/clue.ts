import type { Clue } from "../../app/clue/types";

const API_BASE = "/api";

export async function submitClue(
  data: Omit<Clue, "clue_id" | "created_at" | "updated_at">
): Promise<Clue> {
  const res = await fetch(`${API_BASE}/invest-api/clues`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("提交失败");
  return res.json();
}