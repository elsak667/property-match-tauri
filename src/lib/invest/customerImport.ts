import type { Customer } from "../../app/invest/types";

interface BatchImportResult {
  success: number;
  failed: number;
  errors: string[];
}

export async function batchImportCustomers(
  rows: Partial<Customer>[]
): Promise<BatchImportResult> {
  const res = await fetch("/api/invest-api/customers/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customers: rows }),
  });
  if (!res.ok) throw new Error("批量导入失败");
  return res.json();
}