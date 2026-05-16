import { useState, useEffect } from "react";
import { createCustomer, updateCustomer, getCustomer } from "../../lib/invest/customer";
import type { Customer } from "./types";

interface CustomerFormProps {
  customerId?: string;
  initialData?: Partial<Omit<Customer, "customer_id" | "created_at" | "updated_at">>;
  onSave: () => void;
  onCancel: () => void;
}

const initialFormData: Omit<Customer, "customer_id" | "created_at" | "updated_at"> = {
  name: "",
  credit_code: "",
  company_type: "",
  registered_capital: "",
  founded_date: "",
  registered_address: "",
  legal_representative: "",
  industry: "",
  sub_industry: "",
  main_business: "",
  revenue_level: "",
  employee_count: undefined,
  certifications: "",
  required_area: undefined,
  preferred_district: "",
  preferred_building_type: "",
  requirements: "",
  source: "主动录入",
  investment_staff: "",
  stage: "初步接触",
};

export default function CustomerForm({ customerId, initialData, onSave, onCancel }: CustomerFormProps) {
  const [formData, setFormData] = useState(initialFormData);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isEditing = !!customerId;

  useEffect(() => {
    if (initialData && Object.keys(initialData).length > 0) {
      setFormData(prev => ({ ...prev, ...initialData }));
    } else if (customerId) {
      getCustomer(customerId)
        .then(customer => {
          const { customer_id, created_at, updated_at, ...rest } = customer;
          setFormData(prev => ({ ...prev, ...rest }));
        })
        .catch(() => {
          setMessage({ type: "error", text: "加载客户信息失败" });
        });
    }
  }, [customerId, initialData]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) {
      newErrors.name = "请输入客户名称";
    }
    if (!formData.source) {
      newErrors.source = "请选择客户来源";
    }
    if (!formData.stage) {
      newErrors.stage = "请选择客户阶段";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === "employee_count" || name === "required_area"
        ? value ? Number(value) : undefined
        : value,
    }));
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    setMessage(null);
    try {
      if (isEditing && customerId) {
        await updateCustomer(customerId, formData);
        setMessage({ type: "success", text: "客户信息更新成功！" });
      } else {
        await createCustomer(formData);
        setMessage({ type: "success", text: "客户创建成功！" });
      }
      onSave();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessage({ type: "error", text: `保存失败: ${msg}` });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    if (isEditing && customerId) {
      getCustomer(customerId)
        .then(customer => {
          const { customer_id, created_at, updated_at, ...rest } = customer;
          setFormData(rest);
        })
        .catch(() => {});
    } else {
      setFormData(initialFormData);
    }
    setErrors({});
  };

  return (
    <div className="container">
      <div className="clue-form-container">
        <h1 className="page-title">{isEditing ? "编辑客户" : "新建客户"}</h1>
        <p className="page-subtitle">
          {isEditing ? "修改客户信息" : "填写客户信息，创建新客户档案"}
        </p>
        {message && (
          <div className={`alert alert-${message.type}`}>{message.text}</div>
        )}
        <form onSubmit={handleSubmit} className="clue-form">
          <div className="form-section">
            <h2 className="form-section-title">基本信息</h2>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="name">客户名称 *</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="请输入客户名称"
                  className={errors.name ? "input-error" : ""}
                />
                {errors.name && <span className="error-text">{errors.name}</span>}
              </div>
              <div className="form-group">
                <label htmlFor="credit_code">统一社会信用代码</label>
                <input
                  type="text"
                  id="credit_code"
                  name="credit_code"
                  value={formData.credit_code}
                  onChange={handleChange}
                  placeholder="请输入统一社会信用代码"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="company_type">企业类型</label>
                <input
                  type="text"
                  id="company_type"
                  name="company_type"
                  value={formData.company_type}
                  onChange={handleChange}
                  placeholder="请输入企业类型"
                />
              </div>
              <div className="form-group">
                <label htmlFor="registered_capital">注册资本</label>
                <input
                  type="text"
                  id="registered_capital"
                  name="registered_capital"
                  value={formData.registered_capital}
                  onChange={handleChange}
                  placeholder="请输入注册资本"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="founded_date">成立日期</label>
                <input
                  type="date"
                  id="founded_date"
                  name="founded_date"
                  value={formData.founded_date}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="registered_address">注册地址</label>
                <input
                  type="text"
                  id="registered_address"
                  name="registered_address"
                  value={formData.registered_address}
                  onChange={handleChange}
                  placeholder="请输入注册地址"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="legal_representative">法定代表人</label>
                <input
                  type="text"
                  id="legal_representative"
                  name="legal_representative"
                  value={formData.legal_representative}
                  onChange={handleChange}
                  placeholder="请输入法定代表人"
                />
              </div>
              <div className="form-group">
                <label htmlFor="industry">行业</label>
                <input
                  type="text"
                  id="industry"
                  name="industry"
                  value={formData.industry}
                  onChange={handleChange}
                  placeholder="请输入行业"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="sub_industry">子行业</label>
                <input
                  type="text"
                  id="sub_industry"
                  name="sub_industry"
                  value={formData.sub_industry}
                  onChange={handleChange}
                  placeholder="请输入子行业"
                />
              </div>
              <div className="form-group">
                <label htmlFor="main_business">主营业务</label>
                <input
                  type="text"
                  id="main_business"
                  name="main_business"
                  value={formData.main_business}
                  onChange={handleChange}
                  placeholder="请输入主营业务"
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h2 className="form-section-title">经营信息</h2>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="revenue_level">营收规模</label>
                <select
                  id="revenue_level"
                  name="revenue_level"
                  value={formData.revenue_level}
                  onChange={handleChange}
                >
                  <option value="">请选择营收规模</option>
                  <option value="初创">初创</option>
                  <option value="中小型">中小型</option>
                  <option value="大型">大型</option>
                  <option value="上市公司">上市公司</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="employee_count">员工人数</label>
                <input
                  type="number"
                  id="employee_count"
                  name="employee_count"
                  value={formData.employee_count ?? ""}
                  onChange={handleChange}
                  min="0"
                  placeholder="请输入员工人数"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="certifications">资质认证</label>
                <input
                  type="text"
                  id="certifications"
                  name="certifications"
                  value={formData.certifications}
                  onChange={handleChange}
                  placeholder="请输入资质认证"
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h2 className="form-section-title">选址需求</h2>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="required_area">需求面积(平方米)</label>
                <input
                  type="number"
                  id="required_area"
                  name="required_area"
                  value={formData.required_area ?? ""}
                  onChange={handleChange}
                  min="0"
                  placeholder="请输入需求面积"
                />
              </div>
              <div className="form-group">
                <label htmlFor="preferred_district">意向区域</label>
                <input
                  type="text"
                  id="preferred_district"
                  name="preferred_district"
                  value={formData.preferred_district}
                  onChange={handleChange}
                  placeholder="请输入意向区域"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="preferred_building_type">意向楼宇类型</label>
                <input
                  type="text"
                  id="preferred_building_type"
                  name="preferred_building_type"
                  value={formData.preferred_building_type}
                  onChange={handleChange}
                  placeholder="请输入意向楼宇类型"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group full-width">
                <label htmlFor="requirements">其他需求</label>
                <textarea
                  id="requirements"
                  name="requirements"
                  value={formData.requirements}
                  onChange={handleChange}
                  rows={3}
                  placeholder="请输入其他选址需求"
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h2 className="form-section-title">客户信息</h2>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="source">客户来源 *</label>
                <select
                  id="source"
                  name="source"
                  value={formData.source}
                  onChange={handleChange}
                  required
                  className={errors.source ? "input-error" : ""}
                >
                  <option value="">请选择客户来源</option>
                  <option value="主动录入">主动录入</option>
                  <option value="载体转化">载体转化</option>
                </select>
                {errors.source && <span className="error-text">{errors.source}</span>}
              </div>
              <div className="form-group">
                <label htmlFor="investment_staff">招商人员</label>
                <input
                  type="text"
                  id="investment_staff"
                  name="investment_staff"
                  value={formData.investment_staff}
                  onChange={handleChange}
                  placeholder="请输入招商人员"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="stage">客户阶段 *</label>
                <select
                  id="stage"
                  name="stage"
                  value={formData.stage}
                  onChange={handleChange}
                  required
                  className={errors.stage ? "input-error" : ""}
                >
                  <option value="">请选择客户阶段</option>
                  <option value="初步接触">初步接触</option>
                  <option value="需求确认">需求确认</option>
                  <option value="实地看房">实地看房</option>
                  <option value="谈判中">谈判中</option>
                  <option value="签约入驻">签约入驻</option>
                </select>
                {errors.stage && <span className="error-text">{errors.stage}</span>}
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
              取消
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleReset}>
              重置
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "保存中..." : "保存"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
