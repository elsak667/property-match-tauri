export interface Clue {
  clue_id?: string;
  company_name: string;
  contact_name: string;
  contact_phone: string;
  source_recommender: string;
  source_recommender_phone: string;
  required_area: number;
  preferred_district?: string;
  target_property?: string;
  investment_staff?: string;
  status: "待核实" | "跟进中" | "已转化" | "已失效";
  reward_eligible?: boolean;
  reward_note?: string;
  created_at?: string;
  updated_at?: string;
}

export type ClueStatus = Clue["status"];