export default function Button({ children, type = 'button', variant = 'primary', onClick }) {
  return (
    <button type={type} className={`button button--${variant}`} onClick={onClick}>
      {children}
    </button>
  );
}
