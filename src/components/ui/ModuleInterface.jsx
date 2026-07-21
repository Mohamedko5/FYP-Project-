import { useEffect, useRef } from 'react';
import Button from './Button.jsx';

export function ModulePageHeader({ title, description, meta, actions }) {
  return (
    <header className="module-page-header">
      <div>
        <p className="module-page-header__eyebrow">Bayad ERP</p>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      <div className="module-page-header__side">
        {meta && <span>{meta}</span>}
        {actions && <div className="module-page-header__actions">{actions}</div>}
      </div>
    </header>
  );
}

export function StatGrid({ children, className = '' }) {
  return <div className={`module-stat-grid ${className}`.trim()}>{children}</div>;
}

export function SummaryCard({ icon, label, value, note, tone = 'neutral' }) {
  return (
    <article className={`module-summary-card module-summary-card--${tone}`}>
      <div className="module-summary-card__top">
        {icon && <span className="module-icon" aria-hidden="true">{icon}</span>}
        <span>{label}</span>
      </div>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </article>
  );
}

export function FilterToolbar({ children, actions }) {
  return (
    <div className="module-filter-toolbar">
      <div className="module-filter-toolbar__fields">{children}</div>
      {actions && <div className="module-filter-toolbar__actions">{actions}</div>}
    </div>
  );
}

export function LoadingState({ message = 'Loading records...' }) {
  return (
    <div className="module-state module-state--loading" role="status" aria-live="polite">
      <span className="module-loader" aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}

export function EmptyState({ title = 'No records found.', description }) {
  return (
    <div className="module-state module-state--empty">
      <strong>{title}</strong>
      {description && <p>{description}</p>}
    </div>
  );
}

export function ErrorState({ errors, onRetry, retryLabel = 'Retry' }) {
  if (!errors?.length) return null;
  return (
    <div className="module-state module-state--error" role="alert">
      <div>
        <strong>Something needs attention</strong>
        {errors.map((error) => <p key={error}>{error}</p>)}
      </div>
      {onRetry && <Button variant="secondary" onClick={onRetry}>{retryLabel}</Button>}
    </div>
  );
}

export function DetailSection({ title, children, actions }) {
  return (
    <section className="module-detail-section">
      <div className="module-detail-section__header">
        <h3>{title}</h3>
        {actions && <div>{actions}</div>}
      </div>
      {children}
    </section>
  );
}

export function RecordMeta({ items }) {
  return (
    <div className="module-record-meta">
      {items.filter(Boolean).map((item) => (
        <div key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value ?? '-'}</strong>
        </div>
      ))}
    </div>
  );
}

export function ResponsiveDataList({ rows, renderCard, emptyTitle }) {
  if (!rows.length) return <EmptyState title={emptyTitle} />;
  return <div className="module-responsive-list">{rows.map(renderCard)}</div>;
}

export function ConfirmationDialog({
  title,
  description,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  saving = false,
  variant = 'standard',
}) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const firstField = dialogRef.current?.querySelector('input, select, textarea, button');
    firstField?.focus();
    function handleKeyDown(event) {
      if (event.key === 'Escape' && !saving) onCancel?.();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel, saving]);

  return (
    <div className="module-dialog-backdrop" role="presentation">
      <section
        className={`module-dialog module-dialog--${variant}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="module-dialog-title"
        ref={dialogRef}
      >
        <header>
          <h2 id="module-dialog-title">{title}</h2>
          {description && <p>{description}</p>}
        </header>
        <div className="module-dialog__body">{children}</div>
        <footer>
          <Button variant="secondary" onClick={onCancel} disabled={saving}>{cancelLabel}</Button>
          <Button onClick={onConfirm} disabled={saving}>{saving ? 'Saving...' : confirmLabel}</Button>
        </footer>
      </section>
    </div>
  );
}
