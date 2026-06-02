export default function Tooltip({ as: Component = 'span', children, className = '', content, position = 'top' }) {
  if (!content) return children;

  return (
    <Component
      className={`tooltip ${className}`.trim()}
      data-tooltip={content}
      data-tooltip-position={position}
      title={content}
    >
      {children}
    </Component>
  );
}
