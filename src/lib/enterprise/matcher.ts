import type { EnterpriseProfile } from './types';
import type { PolicyCondition, PrecisionMatch } from '../policy/types';

export function matchEnterpriseToPolicy(
  enterprise: EnterpriseProfile,
  condition: PolicyCondition
): PrecisionMatch {
  const matched: string[] = [];
  const unmatched: string[] = [];

  // 1. 注册资金
  if (condition.registerCapital) {
    const { min, max } = condition.registerCapital;
    const capital = enterprise.registeredCapital;
    if (min !== undefined && capital < min) {
      unmatched.push(`注册资金 ${capital}万 < ${min}万（要求）`);
    } else if (max !== undefined && capital > max) {
      unmatched.push(`注册资金 ${capital}万 > ${max}万（要求）`);
    } else {
      const label = min !== undefined ? `≥ ${min}万` : '';
      matched.push(`注册资金 ${capital}万 ${label}`);
    }
  }

  // 2. 行业
  if (condition.industry?.required?.length) {
    const entIndustries = enterprise.industry;
    const hasRequired = condition.industry.required.some(i =>
      entIndustries.some(ei =>
        ei.includes(i) || i.includes(ei) || ei.toLowerCase().includes(i.toLowerCase())
      )
    );
    if (!hasRequired) {
      unmatched.push(`行业不匹配：要求 ${condition.industry.required.join('/')}，实际 ${entIndustries.join('/')}`);
    } else {
      matched.push(`行业匹配：${entIndustries.join('/')}`);
    }
  }

  // 3. 区域
  if (condition.region?.district) {
    if (!enterprise.district.includes(condition.region.district)) {
      unmatched.push(`区域不匹配：要求 ${condition.region.district}，实际 ${enterprise.district}`);
    } else {
      matched.push(`区域匹配：${enterprise.district}`);
    }
  }
  if (condition.region?.taxLocation) {
    if (enterprise.taxLocation !== condition.region.taxLocation) {
      unmatched.push(`纳税地要求：${condition.region.taxLocation}，实际 ${enterprise.taxLocation}`);
    }
  }

  // 4. 成立年限
  if (condition.establishmentYear) {
    const years = Math.floor(
      (Date.now() - new Date(enterprise.establishmentDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
    );
    if (condition.establishmentYear.min && years < condition.establishmentYear.min) {
      unmatched.push(`成立年限不足：${years}年 < ${condition.establishmentYear.min}年（要求）`);
    }
    if (condition.establishmentYear.max && years > condition.establishmentYear.max) {
      unmatched.push(`成立年限超标：${years}年 > ${condition.establishmentYear.max}年（要求）`);
    }
    if (!unmatched.includes(`成立年限不足`) && !unmatched.includes(`成立年限超标`)) {
      matched.push(`成立年限：${years}年`);
    }
  }

  // 5. 员工人数
  if (condition.employeeCount?.min !== undefined) {
    if (enterprise.employeeCount < condition.employeeCount.min) {
      unmatched.push(`员工人数不足：${enterprise.employeeCount}人 < ${condition.employeeCount.min}人（要求）`);
    } else {
      matched.push(`员工人数：${enterprise.employeeCount}人`);
    }
  }

  // 6. 资质认证
  if (condition.qualifications?.required?.length) {
    const hasAll = condition.qualifications.required.every(q =>
      enterprise.qualifications.some(eq => eq.includes(q))
    );
    if (!hasAll) {
      const missing = condition.qualifications.required.filter(q =>
        !enterprise.qualifications.some(eq => eq.includes(q))
      );
      unmatched.push(`缺少必备资质：${missing.join(', ')}`);
    } else {
      matched.push(`具备必备资质：${condition.qualifications.required.join(', ')}`);
    }
  }

  // 7. 信用记录
  if (condition.creditRecord?.required) {
    if (enterprise.creditRating === '不良') {
      unmatched.push(`信用记录不良`);
    } else {
      matched.push(`信用记录：${enterprise.creditRating || '未评级'}`);
    }
  }

  // 8. 知识产权
  if (condition.intellectualProperty?.patents?.min) {
    if (enterprise.patents < condition.intellectualProperty.patents.min) {
      unmatched.push(`专利数量不足：${enterprise.patents}个 < ${condition.intellectualProperty.patents.min}个（要求）`);
    } else {
      matched.push(`专利数量：${enterprise.patents}个达标`);
    }
  }
  if (condition.intellectualProperty?.softwareCopyright?.min) {
    if (enterprise.softwareCopyright < condition.intellectualProperty.softwareCopyright.min) {
      unmatched.push(`软件著作权不足：${enterprise.softwareCopyright}个 < ${condition.intellectualProperty.softwareCopyright.min}个（要求）`);
    } else {
      matched.push(`软件著作权：${enterprise.softwareCopyright}个达标`);
    }
  }

  // 9. 特殊行业要求
  if (condition.environmental?.hasEIA) {
    if (!enterprise.hasEIA) {
      unmatched.push(`缺少环评批复`);
    } else {
      matched.push(`已完成环评`);
    }
  }
  if (condition.environmental?.hasDischargePermit) {
    if (!enterprise.hasDischargePermit) {
      unmatched.push(`缺少排污许可证`);
    } else {
      matched.push(`已取得排污许可证`);
    }
  }

  // 10. 企业类型
  if (condition.enterpriseType?.required?.length) {
    const hasAll = condition.enterpriseType.required.every(t =>
      enterprise.enterpriseType.some(et => et.includes(t))
    );
    if (!hasAll) {
      const missing = condition.enterpriseType.required.filter(t =>
        !enterprise.enterpriseType.some(et => et.includes(t))
      );
      unmatched.push(`缺少企业类型：${missing.join(', ')}`);
    } else {
      matched.push(`具备要求的企业类型：${condition.enterpriseType.required.join(', ')}`);
    }
  }

  return {
    matched: unmatched.length === 0,
    matchedConditions: matched,
    unmatchedConditions: unmatched,
    overallReason: unmatched.length === 0
      ? '符合所有申报条件'
      : `不符合 ${unmatched.length} 项条件`,
  };
}