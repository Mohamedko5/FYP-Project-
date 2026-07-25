import SectionHeader from './SectionHeader.jsx';
import Tooltip from './Tooltip.jsx';

export default function Card({ title, subtitle, children, className = '', tooltip }) {
  return (
    <section className={`card ${className}`}>
      {(title || subtitle) && (
        <Tooltip as="div" content={tooltip || subtitle} className="tooltip--block">
          <SectionHeader title={title} subtitle={subtitle} className="card__header" />
        </Tooltip>
      )}
      {children}
    </section>
  );
}
