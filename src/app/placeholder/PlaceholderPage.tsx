/**
 * 预留模块占位页
 */
interface Props {
  title: string;
  description: string;
  features: string[];
}

export default function PlaceholderPage({ title, description, features }: Props) {
  return (
    <div className="container">
      <div className="placeholder-container">
        <div className="placeholder-icon">🔧</div>
        <h1 className="placeholder-title">{title}</h1>
        <p className="placeholder-desc">{description}</p>
        <div className="placeholder-features">
          <div className="placeholder-features-title">规划功能</div>
          <div className="placeholder-feature-list">
            {features.map((f, i) => (
              <div key={i} className="placeholder-feature-item">
                <span className="placeholder-check">☐</span>
                <span>{f}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="placeholder-wip">
          <div className="placeholder-wip-badge">功能开发中</div>
          <p>本模块正在规划与开发中，敬请期待后续版本更新。</p>
        </div>
      </div>
    </div>
  );
}
