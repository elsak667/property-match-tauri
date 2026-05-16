// 企业画像结构（天眼查拉取）
export interface EnterpriseProfile {
  name: string;
  creditCode: string;
  legalPerson: string;
  registeredCapital: number;  // 万元
  establishmentDate: string;  // YYYY-MM-DD
  province: string;
  city: string;
  district: string;
  employeeCount: number;
  businessScope: string;
  industry: string[];
  annualRevenue?: number;
  taxLocation?: string;
  qualifications: string[];
  creditRating?: string;
  patents: number;
  softwareCopyright: number;
  hasEIA: boolean;
  hasDischargePermit: boolean;
  hasProductionLicense: boolean;
  hasImportExportRights: boolean;
  enterpriseType: string[];
  listedStatus: string;
}
