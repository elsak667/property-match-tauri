import type { Customer } from "../../app/invest/types";

const API_BASE = "/api";

export async function getCustomers(): Promise<Customer[]> {
  const res = await fetch(`${API_BASE}/invest-api/customers`);
  if (!res.ok) throw new Error("获取客户列表失败");
  return res.json();
}

export async function getCustomer(id: string): Promise<Customer> {
  const res = await fetch(`${API_BASE}/invest-api/customers/${id}`);
  if (!res.ok) throw new Error("获取客户详情失败");
  return res.json();
}

export async function createCustomer(
  data: Omit<Customer, "customer_id" | "created_at" | "updated_at">
): Promise<Customer> {
  const res = await fetch(`${API_BASE}/invest-api/customers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("创建客户失败");
  return res.json();
}

export async function updateCustomer(
  id: string,
  data: Partial<Customer>
): Promise<Customer> {
  const res = await fetch(`${API_BASE}/invest-api/customers/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
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