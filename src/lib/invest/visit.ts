/**
 * 招商跟进记录 API (Bitable: 招商跟进记录表)
 */

const API_BASE = "https://pudong-invest-platform.kokosspig.workers.dev/api";

export interface VisitRecord {
  visit_id: string;
  customer_id: string;
  customer_name: string;
  visit_date: string;
  visit_purpose: string;
  visit_content: string;
  next_step: string;
  investment_staff: string;
  created_at: string;
}

interface BitableItem {
  id: string;
  record_id: string;
  fields: Record<string, unknown>;
}

interface BitableResponse {
  data: BitableItem[];
  hasMore: boolean;
  pageToken?: string;
}

function adaptVisit(item: BitableItem): VisitRecord {
  const f = item.fields;
  return {
    visit_id: item.record_id,
    customer_id: (f.customer_id as string) || "",
    customer_name: (f.customer_name as string) || "",
    visit_date: (f.visit_date as string) || "",
    visit_purpose: (f.visit_purpose as string) || "",
    visit_content: (f.visit_content as string) || "",
    next_step: (f.next_step as string) || "",
    investment_staff: (f.investment_staff as string) || "",
    created_at: (f.created_at as string) || "",
  };
}

export async function getVisits(customerId: string): Promise<VisitRecord[]> {
  const res = await fetch(`${API_BASE}/invest-api/customers/${customerId}/visits`, {
    mode: "cors",
  });
  if (!res.ok) {
    throw new Error(`获取跟进记录失败: HTTP ${res.status}`);
  }
  const json = await res.json() as BitableResponse;
  return json.data.map(adaptVisit);
}

export async function createVisit(
  customerId: string,
  data: Omit<VisitRecord, "visit_id" | "created_at">
): Promise<VisitRecord> {
  // Filter empty values (Bitable rejects empty strings for many field types)
  const fields: Record<string, unknown> = {
    customer_id: customerId,
  };
  if (data.customer_name) fields.customer_name = data.customer_name;
  if (data.visit_date) fields.visit_date = data.visit_date;
  if (data.visit_purpose) fields.visit_purpose = data.visit_purpose;
  if (data.visit_content) fields.visit_content = data.visit_content;
  if (data.next_step) fields.next_step = data.next_step;
  if (data.investment_staff) fields.investment_staff = data.investment_staff;

  const res = await fetch(`${API_BASE}/invest-api/customers/${customerId}/visits`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
    mode: "cors",
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`创建跟进记录失败: HTTP ${res.status} body=${text.slice(0, 200)}`);
  }
  return JSON.parse(text) as VisitRecord;
}