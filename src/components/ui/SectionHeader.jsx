export default function SectionHeader({ title, subtitle, actions, className = '', children }) {
  return (
    <div className={`section-header ${className}`.trim()}>
      <div className="section-header__content">
        {title && <h3>{title}</h3>}
        {subtitle && <p>{subtitle}</p>}
        {children}
      </div>
      {actions && <div className="section-header__actions">{actions}</div>}
    </div>
  );
}
