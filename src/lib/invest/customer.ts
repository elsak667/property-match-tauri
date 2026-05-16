import type { Customer } from "../../app/invest/types";

const API_BASE = "https://pudong-invest-platform.kokosspig.workers.dev/api";

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

function adaptCustomer(item: BitableItem): Customer {
  const f = item.fields;
  return {
    customer_id: item.record_id,
    name: (f.name as string) || "",
    credit_code: f.credit_code as string | undefined,
    company_type: f.company_type as string | undefined,
    registered_capital: f.registered_capital as string | undefined,
    founded_date: f.founded_date as string | undefined,
    registered_address: f.registered_address as string | undefined,
    legal_representative: f.legal_representative as string | undefined,
    industry: f.industry as string | undefined,
    sub_industry: f.sub_industry as string | undefined,
    main_business: f.main_business as string | undefined,
    revenue_level: f.revenue_level as string | undefined,
    employee_count: f.employee_count as number | undefined,
    certifications: f.certifications as string | undefined,
    required_area: f.required_area as number | undefined,
    preferred_district: f.preferred_district as string | undefined,
    preferred_building_type: f.preferred_building_type as string | undefined,
    requirements: f.requirements as string | undefined,
    source: (f.source as Customer["source"]) || "主动录入",
    investment_staff: f.investment_staff as string | undefined,
    stage: (f.stage as Customer["stage"]) || "初步接触",
    created_at: f.文本 as string | undefined,
    // 承租信息
    current_location: f.current_location as string | undefined,
    rental_area: f.rental_area as number | undefined,
    lease_start: f.lease_start as string | undefined,
    lease_end: f.lease_end as string | undefined,
    rental_status: f.rental_status as Customer["rental_status"],
    // 联系人
    contact_name: f.contact_name as string | undefined,
    contact_title: f.contact_title as string | undefined,
    contact_phone: f.contact_phone as string | undefined,
    contact_wechat: f.contact_wechat as string | undefined,
  };
}

export async function getCustomers(): Promise<Customer[]> {
  const res = await fetch(`${API_BASE}/invest-api/customers`);
  if (!res.ok) throw new Error("获取客户列表失败");
  const json = await res.json() as BitableResponse;
  return json.data.map(adaptCustomer);
}

export async function getCustomer(id: string): Promise<Customer> {
  const res = await fetch(`${API_BASE}/invest-api/customers/${id}`);
  if (!res.ok) throw new Error("获取客户详情失败");
  const item = await res.json() as BitableItem;
  return adaptCustomer(item);
}

export async function createCustomer(
  data: Omit<Customer, "customer_id" | "created_at" | "updated_at">
): Promise<Customer> {
  // Strip internal fields and remove empty strings (Bitable rejects empty strings for date fields)
  const { name, credit_code, company_type, registered_capital, founded_date,
    registered_address, legal_representative, industry, sub_industry,
    main_business, revenue_level, employee_count, certifications,
    required_area, preferred_district, preferred_building_type,
    requirements, source, investment_staff, stage } = data;

  const fields: Record<string, unknown> = {
    ...(name && { name }),
    ...(credit_code && { credit_code }),
    ...(company_type && { company_type }),
    ...(registered_capital && { registered_capital }),
    ...(founded_date && { founded_date }),
    ...(registered_address && { registered_address }),
    ...(legal_representative && { legal_representative }),
    ...(industry && { industry }),
    ...(sub_industry && { sub_industry }),
    ...(main_business && { main_business }),
    ...(revenue_level && { revenue_level }),
    ...(employee_count != null && { employee_count }),
    ...(certifications && { certifications }),
    ...(required_area != null && { required_area }),
    ...(preferred_district && { preferred_district }),
    ...(preferred_building_type && { preferred_building_type }),
    ...(requirements && { requirements }),
    source, investment_staff, stage,
  };

  const res = await fetch(`${API_BASE}/invest-api/customers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
    mode: "cors",
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`创建客户失败: HTTP ${res.status} body=${text.slice(0, 200)}`);
  }
  let result: { record_id: string; fields: Record<string, unknown> };
  try {
    result = JSON.parse(text) as { record_id: string; fields: Record<string, unknown> };
  } catch (e) {
    throw new Error(`创建客户失败: JSON解析失败 status=${res.status} body=${text.slice(0, 200)}`);
  }
  return adaptCustomer({ id: result.record_id, record_id: result.record_id, fields: result.fields });
}

export async function updateCustomer(
  id: string,
  data: Partial<Customer>
): Promise<Customer> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { customer_id, created_at, updated_at, ...fields } = data;
  const res = await fetch(`${API_BASE}/invest-api/customers/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  if (!res.ok) throw new Error("更新客户失败");
  return res.json();
}

export async function deleteCustomer(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/invest-api/customers/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("删除客户失败");
}