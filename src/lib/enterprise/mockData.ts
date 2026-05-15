import type { EnterpriseProfile } from './types';

export const MOCK_ENTERPRISES: Record<string, EnterpriseProfile> = {
  '阿里巴巴': {
    name: '阿里巴巴（中国）有限公司',
    creditCode: '91310000MA1K4XXX1X',
    legalPerson: '张勇',
    registeredCapital: 50000, // 5亿
    establishmentDate: '2012-07-10',
    province: '上海市',
    city: '上海市',
    district: '浦东新区',
    employeeCount: 10000,
    businessScope: '电子商务、云计算、数字媒体',
    industry: ['互联网', '云计算', '人工智能'],
    annualRevenue: 500000,
    taxLocation: '浦东新区',
    qualifications: ['高新技术企业', '软件企业认定'],
    creditRating: '优',
    patents: 500,
    softwareCopyright: 200,
    hasEIA: false,
    hasDischargePermit: false,
    hasProductionLicense: false,
    hasImportExportRights: true,
    enterpriseType: ['高新技术企业', '规模以上'],
    listedStatus: '上市',
  },
  '中芯国际': {
    name: '中芯国际集成电路制造有限公司',
    creditCode: '91310000MA1K5XXX2X',
    legalPerson: '周子学',
    registeredCapital: 200000, // 20亿
    establishmentDate: '2000-04-01',
    province: '上海市',
    city: '上海市',
    district: '浦东新区',
    employeeCount: 15000,
    businessScope: '集成电路制造',
    industry: ['集成电路', '半导体'],
    annualRevenue: 300000,
    taxLocation: '浦东新区',
    qualifications: ['高新技术企业', '集成电路制造企业'],
    creditRating: '优',
    patents: 3000,
    softwareCopyright: 100,
    hasEIA: true,
    hasDischargePermit: true,
    hasProductionLicense: true,
    hasImportExportRights: true,
    enterpriseType: ['高新技术企业', '专精特新', '规模以上'],
    listedStatus: '上市',
  },
};

// 搜索企业（模糊匹配）
export function searchMockEnterprise(name: string): EnterpriseProfile[] {
  const lower = name.toLowerCase();
  return Object.values(MOCK_ENTERPRISES).filter(e =>
    e.name.toLowerCase().includes(lower) ||
    e.industry.some(i => i.toLowerCase().includes(lower))
  );
}