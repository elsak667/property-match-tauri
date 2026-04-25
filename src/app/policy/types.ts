// 政策数据结构类型
export interface PolicyResult {
  _group: boolean;
  group_name?: string;
  group_count?: number;
  children?: PolicyResult[];
  name?: string;
  amount: number | null;
  amount_s: string;
  zcReleaseTime: string;
  end_date?: string | null;
  days_left: number;
  expired: boolean;
  method: string;
  dept: string;
  area: string;
  industry: string;
  subject: string;
  threshold: string;
  cap: string;
  content: string;
  contentHtml: string;
  policyObject: string;
  policyCondition: string;
  paymentStandard: string;
  contactInfo: string;
  _reasons: string[];
  stars?: string;
}

export interface FilterOption {
  k: string;
  l: string;
  cnt?: number;
}

export interface FilterOptions {
  locations: FilterOption[];
  subjects: FilterOption[];
  industries: FilterOption[];
  caps: FilterOption[];
  thresholds: FilterOption[];
  depts: FilterOption[];
  cats: FilterOption[];
  total: number;
}
