import Tooltip from './Tooltip.jsx';

export default function Card({ title, subtitle, children, className = '', tooltip }) {
  return (
    <section className={`card ${className}`}>
      {(title || subtitle) && (
        <Tooltip as="div" content={tooltip || subtitle} className="card__header tooltip--block">
          {title && <h2>{title}</h2>}
          {subtitle && <p>{subtitle}</p>}
        </Tooltip>
      )}
      {children}
    </section>
  );
}
