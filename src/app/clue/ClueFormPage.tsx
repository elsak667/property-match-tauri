import { useState } from "react";
import { submitClue } from "../../lib/invest/clue";
import type { Clue } from "./types";

interface Props {
  standalone?: boolean;
}

export default function ClueFormPage({ standalone }: Props = {}) {
  const [formData, setFormData] = useState({
    company_name: "",
    contact_name: "",
    contact_phone: "",
    source_recommender: "",
    source_recommender_phone: "",
    required_area: "",
    preferred_district: "",
    target_property: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      const payload: Omit<Clue, "clue_id" | "created_at" | "updated_at"> = {
        company_name: formData.company_name,
        contact_name: formData.contact_name,
        contact_phone: formData.contact_phone,
        source_recommender: formData.source_recommender,
        source_recommender_phone: formData.source_recommender_phone,
        required_area: Number(formData.required_area),
        preferred_district: formData.preferred_district || undefined,
        target_property: formData.target_property || undefined,
        status: "待核实",
      };
      await submitClue(payload);
      setMessage({ type: "success", text: "线索提交成功！" });
      setFormData({
        company_name: "",
        contact_name: "",
        contact_phone: "",
        source_recommender: "",
        source_recommender_phone: "",
        required_area: "",
        preferred_district: "",
        target_property: "",
      });
    } catch {
      setMessage({ type: "error", text: "提交失败，请稍后重试" });
    } finally {
      setSubmitting(false);
    }
  };

  return standalone ? (
    <div className="launcher-clue-form">
      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}
      <form onSubmit={handleSubmit} className="clue-form compact">
        <div className="form-section">
          <h2 className="form-section-title">企业信息</h2>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="company_name">企业名称 *</label>
              <input type="text" id="company_name" name="company_name" value={formData.company_name}
                onChange={handleChange} required placeholder="请输入企业名称" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="contact_name">联系人 *</label>
              <input type="text" id="contact_name" name="contact_name" value={formData.contact_name}
                onChange={handleChange} required placeholder="请输入联系人姓名" />
            </div>
            <div className="form-group">
              <label htmlFor="contact_phone">联系电话 *</label>
              <input type="tel" id="contact_phone" name="contact_phone" value={formData.contact_phone}
                onChange={handleChange} required placeholder="请输入联系电话" />
            </div>
          </div>
        </div>
        <div className="form-section">
          <h2 className="form-section-title">推荐人信息</h2>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="source_recommender">推荐人姓名 *</label>
              <input type="text" id="source_recommender" name="source_recommender"
                value={formData.source_recommender} onChange={handleChange} required placeholder="请输入推荐人姓名" />
            </div>
            <div className="form-group">
              <label htmlFor="source_recommender_phone">推荐人电话 *</label>
              <input type="tel" id="source_recommender_phone" name="source_recommender_phone"
                value={formData.source_recommender_phone} onChange={handleChange} required placeholder="请输入推荐人电话" />
            </div>
          </div>
        </div>
        <div className="form-section">
          <h2 className="form-section-title">需求信息</h2>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="required_area">需求面积(平方米) *</label>
              <input type="number" id="required_area" name="required_area" value={formData.required_area}
                onChange={handleChange} required min="1" placeholder="请输入需求面积" />
            </div>
            <div className="form-group">
              <label htmlFor="preferred_district">意向区域</label>
              <input type="text" id="preferred_district" name="preferred_district"
                value={formData.preferred_district} onChange={handleChange} placeholder="请输入意向区域" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="target_property">目标物业</label>
              <input type="text" id="target_property" name="target_property"
                value={formData.target_property} onChange={handleChange} placeholder="请输入目标物业" />
            </div>
          </div>
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "提交中..." : "提交线索"}
          </button>
        </div>
      </form>
    </div>
  ) : (
    <div className="container">
      <div className="clue-form-container">
        <h1 className="page-title">招商线索提交</h1>
        <p className="page-subtitle">填写企业招商线索信息，提交后招商人员将尽快跟进</p>
        {message && (
          <div className={`alert alert-${message.type}`}>{message.text}</div>
        )}
        <form onSubmit={handleSubmit} className="clue-form">
          <div className="form-section">
            <h2 className="form-section-title">企业信息</h2>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="company_name">企业名称 *</label>
                <input
                  type="text"
                  id="company_name"
                  name="company_name"
                  value={formData.company_name}
                  onChange={handleChange}
                  required
                  placeholder="请输入企业名称"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="contact_name">联系人 *</label>
                <input
                  type="text"
                  id="contact_name"
                  name="contact_name"
                  value={formData.contact_name}
                  onChange={handleChange}
                  required
                  placeholder="请输入联系人姓名"
                />
              </div>
              <div className="form-group">
                <label htmlFor="contact_phone">联系电话 *</label>
                <input
                  type="tel"
                  id="contact_phone"
                  name="contact_phone"
                  value={formData.contact_phone}
                  onChange={handleChange}
                  required
                  placeholder="请输入联系电话"
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h2 className="form-section-title">推荐人信息</h2>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="source_recommender">推荐人姓名 *</label>
                <input
                  type="text"
                  id="source_recommender"
                  name="source_recommender"
                  value={formData.source_recommender}
                  onChange={handleChange}
                  required
                  placeholder="请输入推荐人姓名"
                />
              </div>
              <div className="form-group">
                <label htmlFor="source_recommender_phone">推荐人电话 *</label>
                <input
                  type="tel"
                  id="source_recommender_phone"
                  name="source_recommender_phone"
                  value={formData.source_recommender_phone}
                  onChange={handleChange}
                  required
                  placeholder="请输入推荐人电话"
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h2 className="form-section-title">需求信息</h2>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="required_area">需求面积(平方米) *</label>
                <input
                  type="number"
                  id="required_area"
                  name="required_area"
                  value={formData.required_area}
                  onChange={handleChange}
                  required
                  min="1"
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
                <label htmlFor="target_property">目标物业</label>
                <input
                  type="text"
                  id="target_property"
                  name="target_property"
                  value={formData.target_property}
                  onChange={handleChange}
                  placeholder="请输入目标物业"
                />
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setFormData({
              company_name: "",
              contact_name: "",
              contact_phone: "",
              source_recommender: "",
              source_recommender_phone: "",
              required_area: "",
              preferred_district: "",
              target_property: "",
            })}>
              重置
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "提交中..." : "提交线索"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );