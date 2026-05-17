export default function Card({ title, subtitle, children, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {(title || subtitle) && (
        <div className="card__header">
          {title && <h2>{title}</h2>}
          {subtitle && <p>{subtitle}</p>}
        </div>
      )}
      {children}
    </section>
  );
}
