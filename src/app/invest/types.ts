export interface Customer {
  customer_id?: string;
  name: string;
  credit_code?: string;
  company_type?: string;
  registered_capital?: string;
  founded_date?: string;
  registered_address?: string;
  legal_representative?: string;
  industry?: string;
  sub_industry?: string;
  main_business?: string;
  revenue_level?: string;
  employee_count?: number;
  certifications?: string;
  required_area?: number;
  preferred_district?: string;
  preferred_building_type?: string;
  requirements?: string;
  source: "主动录入" | "载体转化";
  investment_staff?: string;
  stage: "初步接触" | "需求确认" | "实地看房" | "谈判中" | "签约入驻";
  created_at?: string;
  updated_at?: string;
  // 承租信息
  current_location?: string;
  rental_area?: number;
  lease_start?: string;
  lease_end?: string;
  rental_status?: "正常" | "欠租" | "已退";
  // 联系人
  contact_name?: string;
  contact_title?: string;
  contact_phone?: string;
  contact_wechat?: string;
}

export type CustomerStage = Customer["stage"];
export type CustomerSource = Customer["source"];