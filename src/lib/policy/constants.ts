// 政策标签映射常量

export const IND_LABEL_MAP: Record<string, string> = {
  "人工智能": "ai",
  "智能制造": "manufacturing",
  "生物医药": "biomed",
  "绿色低碳": "green",
  "消费文旅": "culture",
  "航运贸易": "shipping",
  "金融法律": "finance",
  "科技服务": "tech_service",
  "企业服务": "enterprise_service",
  "集成电路": "ic",
  "教育": "education",
  "农业": "agriculture",
  "质量标杆": "quality",
  "建设交通": "construction",
  "商务服务": "business",
};

export const INDUSTRY_ORDER = [
  "人工智能", "智能制造", "集成电路", "生物医药", "绿色低碳",
  "消费文旅", "航运贸易", "金融法律", "科技服务", "企业服务",
  "教育", "农业",
];

export const CAPS_K_MAP: Record<string, string> = {
  "资金补贴": "fund",
  "研发支持": "rd",
  "荣誉表彰": "honor",
  "人才支持": "talent",
  "资质认定": "qualify",
  "示范推广": "promote",
  "融资支持": "finance",
  "税费减免": "tax",
  "税收优惠": "tax",
  "费用减免": "fee",
  "场地支持": "space",
  "综合支持": "comprehensive",
  "一站式服务": "service",
};

export const THRESHOLD_K_MAP: Record<string, string> = {
  "无限定": "unlimited",
  "中小微企业": "sme",
  "高新技术企业": "hightech",
  "专精特新企业": "specialized",
  "张江区域企业": "zhangjiang",
  "新招引企业": "newly_introduced",
  "外资企业": "foreign",
  "金融机构": "financial_inst",
  "高校科研院所": "university",
  "社会组织": "social_org",
};

export const LOCATIONS = [
  { k: "pudong", l: "浦东新区" },
  { k: "zhangjiang", l: "张江科学城" },
  { k: "resort", l: "度假区" },
  { k: "free_trade", l: "自贸试验区" },
];

export const SUBJECTS = [
  { k: "enterprise", l: "企业" },
  { k: "individual", l: "个人" },
  { k: "social_org", l: "社会组织" },
];

export const CAPS_LIST = [
  { k: "fund", l: "💰 资金补贴" },
  { k: "rd", l: "🔬 研发支持" },
  { k: "honor", l: "🏆 荣誉表彰" },
  { k: "talent", l: "👤 人才支持" },
  { k: "qualify", l: "🏅 资质认定" },
  { k: "promote", l: "🚀 示范推广" },
  { k: "finance", l: "💳 融资支持" },
  { k: "tax", l: "📉 税费减免" },
  { k: "fee", l: "📋 费用减免" },
  { k: "space", l: "🏠 场地支持" },
  { k: "comprehensive", l: "📋 综合支持" },
  { k: "service", l: "🏗️ 一站式服务" },
];
