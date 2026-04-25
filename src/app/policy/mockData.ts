/**
 * 模拟政策数据（演示用）
 * 正式使用时替换为飞书 API 调用的真实数据
 */
import type { FilterOptions, PolicyResult } from "./types";

// 模拟政策列表
export const MOCK_POLICIES: PolicyResult[] = [
  {
    _group: false, name: "浦东新区人工智能产业专项扶持资金", amount: 500, amount_s: "500万元", zcReleaseTime: "2025-01-15",
    end_date: "2025-12-31", days_left: 180, expired: false, method: "事后补贴", dept: "浦东新区科经委",
    area: "浦东新区", industry: "人工智能", subject: "企业", threshold: "需为国家高新技术企业", cap: "资金补贴", cat: "industry",
    content: "支持人工智能关键技术研发、创新应用示范项目建设、行业赋能应用场景开放。单项目最高支持500万元。\n申报条件：\n1. 在浦东新区注册的独立法人企业\n2. 项目需在浦东新区范围内实施\n3. 具有较好的项目前期基础",
    contentHtml: "", policyObject: "注册在浦东新区的人工智能企业", policyCondition: "国家高新技术企业认定", paymentStandard: "项目投资额的30%，最高500万元", contactInfo: "联系人：张老师，电话：021-12345678",
    _reasons: ["企业行业匹配：人工智能", "补贴金额较高：500万元"],
    stars: "★★★",
  },
  {
    _group: false, name: "浦东新区生物医药创新发展支持计划", amount: 1000, amount_s: "1000万元", zcReleaseTime: "2025-02-10",
    end_date: "2025-09-30", days_left: 90, expired: false, method: "事前立项、事后补贴", dept: "浦东新区生物医药产业促进中心",
    area: "浦东新区张江科学城", industry: "生物医药", subject: "企业/科研机构", threshold: "需在张江科学城内", cap: "综合支持", cat: "industry",
    content: "支持创新药研发、医疗器械创新、精准医疗等领域的临床研究和新产品产业化。单品种最高1000万元。\n支持方式：\n1. 临床试验补贴：按实际发生金额的30%给予补贴\n2. 产业化补贴：按项目总投资20%给予支持",
    contentHtml: "", policyObject: "注册在张江科学城的生物医药企业和科研机构", policyCondition: "具有相应药品/器械注册证书", paymentStandard: "单个品种最高1000万元", contactInfo: "联系人：李老师，电话：021-87654321",
    _reasons: ["适用区域：张江科学城", "补贴金额最高：1000万元"],
    stars: "★★★",
  },
  {
    _group: false, name: "集成电路产业发展专项奖励", amount: 300, amount_s: "300万元", zcReleaseTime: "2025-03-01",
    end_date: "2025-06-30", days_left: 30, expired: false, method: "事后奖励", dept: "浦东新区经信委",
    area: "浦东新区", industry: "集成电路", subject: "企业", threshold: "需规模以上工业企业", cap: "研发支持", cat: "industry",
    content: "对集成电路设计企业流片费用给予补贴，对集成电路制造企业给予用电补贴。\n补贴标准：\n1. MPW流片补贴50%，年度最高100万元\n2. 工程批流片补贴30%，年度最高200万元\n3. 制造企业用电补贴0.1元/度",
    contentHtml: "", policyObject: "集成电路设计、制造企业", policyCondition: "上年度集成电路产值2000万元以上", paymentStandard: "单项最高300万元", contactInfo: "联系人：王老师，电话：021-11112222",
    _reasons: ["即将截止：剩余30天", "企业行业匹配：集成电路"],
    stars: "★★★",
  },
  {
    _group: false, name: "绿色低碳示范企业认定奖励", amount: 50, amount_s: "50万元", zcReleaseTime: "2025-01-20",
    end_date: "2026-01-31", days_left: 280, expired: false, method: "事后奖励", dept: "浦东新区生态环境局",
    area: "浦东新区", industry: "绿色低碳", subject: "企业", threshold: "需通过清洁生产审核", cap: "荣誉表彰", cat: "industry",
    content: "对获评绿色制造示范、绿色供应链管理示范等称号的企业给予奖励。\n奖励标准：\n1. 国家级示范：50万元\n2. 上海市级示范：30万元\n3. 浦东区级示范：15万元",
    contentHtml: "", policyObject: "在浦东新区注册的工业企业", policyCondition: "近三年无重大环境违法行为", paymentStandard: "国家级50万元，市级30万元，区级15万元", contactInfo: "联系人：赵老师，电话：021-33334444",
    _reasons: ["企业资质匹配：绿色低碳"],
    stars: "★★☆",
  },
  {
    _group: false, name: "航运贸易企业高质量发展扶持资金", amount: 200, amount_s: "200万元", zcReleaseTime: "2025-02-28",
    end_date: "2025-08-31", days_left: 60, expired: false, method: "事后补贴", dept: "浦东新区商务委",
    area: "浦东新区外高桥港区", industry: "航运贸易", subject: "企业", threshold: "需在外高桥港区有实际业务", cap: "综合支持", cat: "industry",
    content: "支持航运服务、贸易便利化、国际物流供应链等领域发展。\n支持方向：\n1. 航运金融服务平台建设\n2. 大宗商品交易平台建设\n3. 国际中转集拼业务\n4. 跨境电商新业态",
    contentHtml: "", policyObject: "注册在浦东新区的航运、贸易、物流企业", policyCondition: "上年度航运/贸易营业收入1亿元以上", paymentStandard: "单个项目最高200万元", contactInfo: "联系人：陈老师，电话：021-55556666",
    _reasons: ["适用区域匹配：外高桥港区", "补贴力度：200万元"],
    stars: "★★☆",
  },
  {
    _group: false, name: "智能制造示范工厂认定奖励", amount: 800, amount_s: "800万元", zcReleaseTime: "2025-03-15",
    end_date: "2025-11-30", days_left: 120, expired: false, method: "事后奖励", dept: "浦东新区经信委",
    area: "浦东新区", industry: "智能制造", subject: "规模以上工业企业", threshold: "需具有智能制造能力", cap: "示范推广", cat: "industry",
    content: "对获评国家级、市级智能制造示范工厂（车间）的企业给予奖励。\n奖励标准：\n1. 国家级示范工厂：800万元\n2. 国家级示范车间：400万元\n3. 上海市级示范工厂：500万元",
    contentHtml: "", policyObject: "在浦东新区注册的工业企业", policyCondition: "具有智能化改造基础条件", paymentStandard: "国家级800万元，市级500万元", contactInfo: "联系人：周老师，电话：021-66667777",
    _reasons: ["企业行业匹配：智能制造", "奖励金额高：800万元"],
    stars: "★★★",
  },
  {
    _group: false, name: "人才引进与住房补贴政策", amount: 30, amount_s: "30万元", zcReleaseTime: "2025-01-01",
    end_date: null, days_left: 9999, expired: false, method: "直接补贴", dept: "浦东新区人社局",
    area: "浦东新区", industry: "全部行业", subject: "企业/个人", threshold: "需符合人才认定条件", cap: "人才支持", cat: "talent",
    content: "对符合条件的各类人才提供住房补贴、子女入学优待、就医便利等服务。\n补贴标准：\n1. 顶尖人才：每月住房补贴5000元\n2. 领军人才：每月住房补贴3000元\n3. 重点产业人才：每月住房补贴1500元",
    contentHtml: "", policyObject: "在浦东新区工作的各类人才", policyCondition: "符合浦东新区人才认定标准", paymentStandard: "按人才层次给予相应补贴", contactInfo: "人才热线：021-77778888",
    _reasons: ["适用行业：全部行业"],
    stars: "★☆☆",
  },
  {
    _group: false, name: "科技型中小企业创新专项资金", amount: 100, amount_s: "100万元", zcReleaseTime: "2025-04-01",
    end_date: "2025-07-15", days_left: 45, expired: false, method: "事前资助", dept: "浦东新区科经委",
    area: "浦东新区", industry: "科技服务", subject: "中小企业", threshold: "需为科技型中小企业", cap: "研发支持", cat: "industry",
    content: "支持科技型中小企业开展技术创新活动。\n支持方式：\n1. 研发费用补贴：按上年度研发费用20%给予补贴\n2. 科技金融支持：贷款贴息50%，年度最高50万元",
    contentHtml: "", policyObject: "在浦东新区注册的科技型中小企业", policyCondition: "已入库上海市科技型中小企业", paymentStandard: "最高100万元", contactInfo: "联系人：刘老师，电话：021-88889999",
    _reasons: ["即将截止：剩余45天", "补贴对象：中小企业"],
    stars: "★★☆",
  },
];

// 筛选选项
export const MOCK_OPTIONS: FilterOptions = {
  locations: [
    { k: "pudong", l: "浦东新区", cnt: 6 },
    { k: "zhangjiang", l: "张江科学城", cnt: 2 },
    { k: "waigaoqiao", l: "外高桥港区", cnt: 1 },
    { k: "lingang", l: "临港新片区", cnt: 1 },
  ],
  subjects: [
    { k: "enterprise", l: "企业", cnt: 7 },
    { k: "research", l: "科研机构", cnt: 2 },
    { k: "individual", l: "个人", cnt: 1 },
  ],
  industries: [
    { k: "ai", l: "人工智能", cnt: 1 },
    { k: "biomed", l: "生物医药", cnt: 1 },
    { k: "ic", l: "集成电路", cnt: 1 },
    { k: "manufacturing", l: "智能制造", cnt: 1 },
    { k: "green", l: "绿色低碳", cnt: 1 },
    { k: "shipping", l: "航运贸易", cnt: 1 },
    { k: "tech_service", l: "科技服务", cnt: 1 },
    { k: "all", l: "全部行业", cnt: 1 },
  ],
  caps: [
    { k: "fund", l: "资金补贴", cnt: 3 },
    { k: "rd", l: "研发支持", cnt: 2 },
    { k: "honor", l: "荣誉表彰", cnt: 1 },
    { k: "talent", l: "人才支持", cnt: 1 },
    { k: "comprehensive", l: "综合支持", cnt: 2 },
  ],
  thresholds: [
    { k: "high-tech", l: "高新技术企业", cnt: 2 },
    { k: "large", l: "规模以上", cnt: 2 },
    { k: "sme", l: "中小企业", cnt: 2 },
  ],
  depts: [
    { k: "kejingwei", l: "浦东新区科经委", cnt: 3 },
    { k: "jingxinwei", l: "浦东新区经信委", cnt: 2 },
    { k: "shengwu", l: "浦东新区生物医药促进中心", cnt: 1 },
    { k: "rensheju", l: "浦东新区人社局", cnt: 1 },
  ],
  cats: [
    { k: "industry", l: "产业专项", cnt: 5 },
    { k: "talent", l: "人才政策", cnt: 1 },
    { k: "tax", l: "税费优惠", cnt: 2 },
  ],
  total: MOCK_POLICIES.length,
};

// 获取政策列表
export function getMockPolicies(): PolicyResult[] {
  return MOCK_POLICIES;
}

// 获取筛选选项
export function getMockOptions(): FilterOptions {
  return MOCK_OPTIONS;
}

export function filterPolicies(
  policies: PolicyResult[],
  opts: {
    query?: string;
    industry?: string;
    location?: string;
    dept?: string;
    caps?: string[];
    cats?: string[];
  },
): PolicyResult[] {
  const { query, industry, location, dept, caps = [], cats = [] } = opts;
  return policies.filter(p => {
    const q = (query || "").toLowerCase();
    const matchQuery = !q || !p.name || p.name.toLowerCase().includes(q) ||
      p.content?.toLowerCase().includes(q) || p.industry?.toLowerCase().includes(q);
    const matchIndustry = !industry || !p.industry || p.industry.includes(industry) || industry === "全部行业" || industry === "all";
    const matchLocation = !location || !p.area || p.area.includes(location);
    const matchDept = !dept || p.dept?.includes(dept);
    const matchCap = caps.length === 0 || caps.some(c => p.cap?.includes(c) || c === p.cap);
    const matchCat = cats.length === 0 || cats.some(c => p.cat === c);
    return matchQuery && matchIndustry && matchLocation && matchDept && matchCap && matchCat;
  });
}
