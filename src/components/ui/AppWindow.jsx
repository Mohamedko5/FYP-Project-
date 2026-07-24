import { useEffect, useId, useRef, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import Button from './Button.jsx';
import ModalPortal from './ModalPortal.jsx';

function MinusIcon() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h12" /></svg>;
}

function MaximizeIcon() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="5" y="5" width="10" height="10" rx="1.5" /></svg>;
}

function RestoreIcon() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 5.5h7.5v7.5" /><rect x="4.5" y="8" width="7.5" height="7.5" rx="1.4" /></svg>;
}

function CloseIcon() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5.5 5.5 9 9M14.5 5.5l-9 9" /></svg>;
}

function focusableElements(root) {
  if (!root) return [];
  return Array.from(root.querySelectorAll(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )).filter((element) => !element.hasAttribute('disabled') && !element.getAttribute('aria-hidden'));
}

function WindowControl({ label, onClick, disabled, children }) {
  return (
    <button type="button" className="app-window__control" aria-label={label} title={label} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

function UnsavedChangesDialog({ onContinue, onDiscard, saving }) {
  const { t } = useLanguage();
  const titleId = useId();

  return (
    <ModalPortal>
      <div className="app-window-confirm" role="presentation">
        <section className="confirmation-dialog app-window-confirm__dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
          <h3 id={titleId}>{t('window.unsavedChanges')}</h3>
          <p>{t('window.unsavedCloseMessage')}</p>
          <div className="confirmation-dialog__actions">
            <Button type="button" variant="secondary" onClick={onContinue} disabled={saving}>{t('window.continueEditing')}</Button>
            <Button type="button" onClick={onDiscard} disabled={saving}>{t('window.discardChanges')}</Button>
          </div>
        </section>
      </div>
    </ModalPortal>
  );
}

export function MinimizedWindowsDock({ windows = [] }) {
  const visibleWindows = windows.filter(Boolean);
  const { t } = useLanguage();
  if (!visibleWindows.length) return null;

  return (
    <div className="app-window-dock" aria-label={t('window.minimizedWindows')}>
      {visibleWindows.map((windowItem) => (
        <button
          key={windowItem.id}
          type="button"
          className="app-window-dock__item"
          onClick={windowItem.onRestore}
          aria-label={`${t('window.restoreWindow')}: ${windowItem.title}`}
        >
          {windowItem.title}
        </button>
      ))}
    </div>
  );
}

export default function AppWindow({
  id,
  title,
  description,
  isOpen,
  isDirty = false,
  isSubmitting = false,
  defaultSize = 'large',
  allowMinimize = true,
  allowMaximize = true,
  openerRef,
  onClose,
  children,
}) {
  const { t, isArabic } = useLanguage();
  const titleId = useId();
  const windowRef = useRef(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setIsMinimized(false);
      setIsMaximized(false);
      setShowUnsavedDialog(false);
      return;
    }
    window.setTimeout(() => {
      const firstField = windowRef.current?.querySelector('input, select, textarea, button');
      firstField?.focus();
    }, 0);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || isMinimized) return undefined;

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        requestClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusableElements(windowRef.current);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isMinimized, isDirty, isSubmitting]);

  if (!isOpen) return null;

  function restoreFocus() {
    window.setTimeout(() => openerRef?.current?.focus?.(), 0);
  }

  function completeClose() {
    setShowUnsavedDialog(false);
    setIsMinimized(false);
    setIsMaximized(false);
    onClose?.();
    restoreFocus();
  }

  function requestClose() {
    if (isSubmitting) return;
    if (isDirty) {
      setShowUnsavedDialog(true);
      return;
    }
    completeClose();
  }

  function minimize() {
    if (!allowMinimize) return;
    setShowUnsavedDialog(false);
    setIsMinimized(true);
    restoreFocus();
  }

  function restoreMinimized() {
    setIsMinimized(false);
    window.setTimeout(() => {
      const firstField = windowRef.current?.querySelector('input, select, textarea, button');
      firstField?.focus();
    }, 0);
  }

  const className = [
    'app-window',
    `app-window--${defaultSize}`,
    isMaximized ? 'is-maximized' : '',
    isSubmitting ? 'is-submitting' : '',
  ].filter(Boolean).join(' ');

  if (isMinimized) {
    return <MinimizedWindowsDock windows={[{ id, title, onRestore: restoreMinimized }]} />;
  }

  return (
    <ModalPortal>
      <div className="app-window-backdrop" role="presentation" dir={isArabic ? 'rtl' : 'ltr'}>
        <section ref={windowRef} className={className} role="dialog" aria-modal="true" aria-labelledby={titleId}>
          <header className="app-window__titlebar">
            <div className="app-window__title">
              <h2 id={titleId}>{title}</h2>
              {description && <p>{description}</p>}
            </div>
            <div className="app-window__controls">
              {allowMinimize && <WindowControl label={t('window.minimize')} onClick={minimize} disabled={isSubmitting}><MinusIcon /></WindowControl>}
              {allowMaximize && (
                <WindowControl
                  label={isMaximized ? t('window.restore') : t('window.maximize')}
                  onClick={() => setIsMaximized((current) => !current)}
                  disabled={isSubmitting}
                >
                  {isMaximized ? <RestoreIcon /> : <MaximizeIcon />}
                </WindowControl>
              )}
              <WindowControl label={t('window.close')} onClick={requestClose} disabled={isSubmitting}><CloseIcon /></WindowControl>
            </div>
          </header>
          <div className="app-window__body">{children}</div>
        </section>
        {showUnsavedDialog && (
          <UnsavedChangesDialog
            saving={isSubmitting}
            onContinue={() => setShowUnsavedDialog(false)}
            onDiscard={completeClose}
          />
        )}
      </div>
    </ModalPortal>
  );
}
