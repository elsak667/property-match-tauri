// 物业数据模型类型

export interface Park {
  park_id: string;
  name: string;
  district: string;
  address: string;
  industry_direction: string;
  built_year: number | null;
  canteen: string | null;
  dormitory: string | null;
  parking_total: string | null;
  exhibition_hall: string | null;
  meeting_rooms: string | null;
  fire_rating: string | null;
  security_level: string | null;
  land_nature: string | null;
  is_104_block: string | null;
  lat: number | null;
  lng: number | null;
}

export interface Building {
  building_id: string;
  park_id: string;
  name: string;
  type: string;
  floors: number | null;
  area_vacant: number | null;
  occupancy_rate: number | null;
  built_year: number | null;
  property_fee: number | null;
  ac_type: string | null;
  ac_hours: string | null;
  network_mbps: number | null;
  power_kv: number | null;
  has_gas: string | null;
  has_drainage: string | null;
  waste_gas_facility: string | null;
  column_spacing: number | null;
  floor_thickness: number | null;
  has_crane_beam: string | null;
  fire_sprinkler: string | null;
  fire_extinguisher: string | null;
  hydrant: string | null;
  independent_access: string | null;
  industry: string | null;
  contact: string | null;
  phone: string | null;
  rel_x: number | null;
  rel_y: number | null;
  elevator_p: number | null;
  elevator_c: number | null;
  "纬度(lat)": number | null;
  "经度(lng)": number | null;
}

export interface Unit {
  unit_id: string;
  building_id: string;
  floor: number | null;
  unit_no: string | null;
  area_total: number | null;
  area_rented: number | null;
  area_vacant: number | null;
  area_min_split: number | null;
  support_split: string | null;
  floor_height: number | null;
  load: number | null;
  price: number | null;
  deposit_ratio: number | null;
  min_lease_year: number | null;
  wc_count: number | null;
  pantry: string | null;
  allow_catering: string | null;
  allow_hazardous: string | null;
  remark: string | null;
}

export interface Property {
  unit_id: string;
  floor: number | null;
  unit_no: string | null;
  area_total: number | null;
  area_vacant: number | null;
  area_min_split: number | null;
  support_split: string | null;
  floor_height: number | null;
  load: number | null;
  price: number | null;
  deposit_ratio: number | null;
  min_lease_year: number | null;
  wc_count: number | null;
  pantry: string | null;
  allow_catering: string | null;
  allow_hazardous: string | null;
  remark: string | null;
  building_id: string;
  building_name: string;
  building_type: string;
  floors: number | null;
  elevator_p: number | null;
  elevator_c: number | null;
  occupancy_rate: number | null;
  property_fee: number | null;
  ac_type: string | null;
  ac_hours: string | null;
  network_mbps: number | null;
  power_kv: number | null;
  has_gas: string | null;
  has_drainage: string | null;
  waste_gas_facility: string | null;
  column_spacing: number | null;
  fire_sprinkler: string | null;
  industry: string | null;
  contact: string | null;
  phone: string | null;
  park_id: string;
  park_name: string;
  district: string;
  address: string;
  canteen: string | null;
  dormitory: string | null;
  parking_total: string | null;
  exhibition_hall: string | null;
  meeting_rooms: string | null;
  land_nature: string | null;
  is_104_block: string | null;
}

export interface PropertyMatchQuery {
  areaMin?: number;
  areaMax?: number;
  priceMax?: number;
  types?: string[];
  industries?: string[];
  loadMin?: number;
  heightMin?: number;
  powerKVMin?: number;
  tolerance?: number;
  is104Block?: string;
}

export interface PropertyMatchResult {
  property: Property;
  totalScore: number;
  stars: string;
  scores: Record<string, number>;
  matchReason: string;
}

export const PROPERTY_WEIGHTS = {
  area: 0.22,
  price: 0.18,
  type: 0.15,
  industry: 0.22,
  load: 0.08,
  height: 0.08,
  is104: 0.07,
  powerKV: 0.05,
} as const;
