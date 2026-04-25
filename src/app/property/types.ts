export interface Property {
  id: number;
  name: string;
  district: string;
  park: string;
  address: string;
  load: number | null;
  height: number | null;
  areaMin: number | null;
  areaMax: number | null;
  priceMin: number | null;
  priceMax: number | null;
  type: string;
  industry: string;
  contact: string;
  remark: string;
}

export interface Industry {
  code: string;
  name: string;
  alias: string[];
  loadMin: number | null;
  heightMin: number | null;
  priceMax: number | null;
  powerKV: number | null;
  dualPower: boolean | null;
  cleanliness: string | null;
  fireRating: string | null;
  envAssessment: string | null;
  special: string[];
  remark: string;
}

export interface IndustryCategory {
  name: string;
  code: string;
  industries: Industry[];
}

export interface IndustryProfiles {
  description: string;
  version: string;
  lastUpdated: string;
  categories: IndustryCategory[];
}
