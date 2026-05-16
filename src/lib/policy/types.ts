// 政策匹配算法类型定义

export interface Policy {
  id: string;
  name: string;
  start: Date | null;
  end: Date | null;
  zcReleaseTime: string;
  amount: number | null;
  amount_s: string;
  method: string;
  area: string;
  dept: string;
  phone: string;
  industry: string;
  industry_ks: string[];
  subject: string;
  subject_ks: string[];
  threshold: string;
  threshold_ks: string[];
  cap: string;
  cap_ks: string[];
  content: string;
  contentHtml: string;
  policyObject: string;
  policyCondition: string;
  paymentStandard: string;
  contactInfo: string;
  specialAbbreviat: string;
  specialCat: string;
  expired: boolean;
  days_left: number;
}

export interface MatchQuery {
  query?: string;
  industries?: string[];
  location?: string;
  subjects?: string[];
  caps?: string[];
  thresholds?: string[];
  dept?: string;
  cat?: string;
}

export interface MatchResult {
  id: string;
  name: string;
  start: Date | null;
  end: Date | null;
  zcReleaseTime: string;
  amount: number | null;
  amount_s: string;
  method: string;
  area: string;
  dept: string;
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
  specialAbbreviat: string;
  expired: boolean;
  days_left: number;
  _score: number;
  _reasons: string[];
  _rank: number;
  _group?: boolean;
  group_name?: string;
  group_count?: number;
  children?: MatchResult[];
}

export interface FilterOptions {
  industries: { k: string; l: string }[];
  caps: { k: string; l: string }[];
  thresholds: { k: string; l: string }[];
  depts: { k: string; l: string; cnt: number }[];
  cats: { k: string; l: string; cnt: number }[];
}

export const POLICY_CONSTANTS = {
  P_IND: 5,
  P_SUB: 2,
  P_CAP: 1,
  P_LOC: 1,
  P_THRESHOLD: 1,
} as const;

// ── 产业字典类型 ────────────────────────────────────────────────────────────

export interface IndustryProfile {
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
  remark: string | null;
}

export interface IndustryCategory {
  name: string;
  code: string;
  industries: IndustryProfile[];
}

export interface RawIndustry {
  category_name: string | null;
  category_code: string | null;
  code: string;
  name: string;
  alias: string | null;
  load_min: number | null;
  height_min: number | null;
  price_max: number | null;
  power_kv: number | null;
  dual_power: string | null;
  cleanliness: string | null;
  fire_rating: string | null;
  env_assessment: string | null;
  special: string | null;
  remark: string | null;
}

// ── 政策条件结构化类型 ────────────────────────────────────────────────────

export interface PolicyCondition {
  registerCapital?: {
    min?: number;
    max?: number;
    unit?: '万' | '亿';
    currency?: '人民币' | '美元' | '欧元';
  };

  industry?: {
    required?: string[];
    preferred?: string[];
    excluded?: string[];
  };

  region?: {
    province?: string;
    city?: string;
    district?: string;
    taxLocation?: string;
  };

  establishmentYear?: {
    min?: number;
    max?: number;
  };

  employeeCount?: {
    min?: number;
    max?: number;
  };

  annualRevenue?: {
    min?: number;
    max?: number;
    unit?: '万' | '亿';
  };

  taxAmount?: {
    min?: number;
    location?: string;
  };

  qualifications?: {
    required?: string[];
    preferred?: string[];
  };

  creditRecord?: {
    required?: boolean;
  };

  rdExpenditure?: {
    minRatio?: number;
    minAmount?: number;
  };

  intellectualProperty?: {
    patents?: { min?: number };
    softwareCopyright?: { min?: number };
  };

  environmental?: {
    hasEIA?: boolean;
    hasDischargePermit?: boolean;
  };

  safety?: {
    hasProductionLicense?: boolean;
  };

  importExport?: {
    hasImportExportRights?: boolean;
  };

  enterpriseType?: {
    allowed?: string[];
    excluded?: string[];
    required?: string[];
  };

  listedStatus?: {
    allowed?: ('上市' | '非上市' | '新三板' | '科创板')[];
  };

  projectInvestment?: {
    min?: number;
    unit?: '万' | '亿';
  };

  landArea?: {
    min?: number;
    buildingArea?: { min?: number; max?: number };
  };

  applicationMethod?: string;

  specialConditions?: string[];
  rawText?: string;
  extractionStatus: 'pending' | 'completed' | 'failed';
  extractedAt?: string;
}

// 精准匹配结果
export interface PrecisionMatch {
  matched: boolean;
  matchedConditions: string[];
  unmatchedConditions: string[];
  overallReason: string;
}
