import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Tooltip from '../components/ui/Tooltip.jsx';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { loginUser, requestPasswordReset } from '../services/authApi.js';

export default function Login({ onLogin }) {
  const navigate = useNavigate();
  const { t, isArabic, direction, language, toggleLanguage } = useLanguage();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', password: '' });
  const [forgotEmail, setForgotEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);
  const currentYear = new Date().getFullYear();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setMessage({ type: '', text: '' });
    setFieldErrors({});
    setShowPassword(false);
  }

  function readableLoginError(error) {
    if (!navigator.onLine) return t('login.serverError');
    const text = String(error?.message || '');
    if (/inactive/i.test(text)) return t('login.inactiveAccount');
    if (/failed to fetch|network/i.test(text)) return t('login.serverError');
    if (/token|session/i.test(text)) return t('login.sessionExpired');
    return text || t('login.invalidCredentials');
  }

  function validateLogin() {
    const nextErrors = {};
    const email = form.email.trim();
    if (!email) {
      nextErrors.email = t('login.emailRequiredError');
    } else if (!emailPattern.test(email)) {
      nextErrors.email = t('login.emailFormatError');
    }
    if (!form.password.trim()) {
      nextErrors.password = t('login.passwordRequiredError') || t('login.requiredError');
    }
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function validateForgotPassword() {
    const email = forgotEmail.trim();
    if (!email) {
      setFieldErrors({ forgotEmail: t('login.emailRequiredError') });
      return false;
    }
    if (!emailPattern.test(email)) {
      setFieldErrors({ forgotEmail: t('login.emailFormatError') });
      return false;
    }
    return true;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (isLoading) return;
    setMessage({ type: '', text: '' });
    setFieldErrors({});

    if (!validateLogin()) return;

    setIsLoading(true);
    try {
      const data = await loginUser({
        email: form.email.trim(),
        password: form.password,
      });

      if (!data.access || !data.refresh) {
        throw new Error(t('login.invalidCredentials'));
      }

      setIsLoading(false);
      setMessage({ type: 'success', text: t('login.successMessage') });
      window.setTimeout(() => {
        onLogin(data);
        navigate('/dashboard');
      }, 700);
    } catch (error) {
      setIsLoading(false);
      setMessage({ type: 'error', text: readableLoginError(error) });
    }
  }

  async function handleForgotSubmit(event) {
    event.preventDefault();
    if (isLoading) return;
    setMessage({ type: '', text: '' });
    setFieldErrors({});

    if (!validateForgotPassword()) return;

    setIsLoading(true);
    try {
      await requestPasswordReset(forgotEmail.trim());

      setForgotEmail('');
      setMode('login');
      setMessage({ type: 'success', text: t('login.forgotSuccess') });
    } catch {
      setMessage({ type: 'error', text: t('login.forgotError') });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="login-page login-page--premium" dir={direction} lang={language}>
      <section className="login-brand-side" aria-label={t('login.welcomeTitle')}>
        <header className="login-brand-side__top">
          <div className="login-brand-lockup">
            <span className="login-brand-lockup__mark" aria-hidden="true">{isArabic ? 'ب' : 'B'}</span>
            <div>
              <strong>{t('companyName')}</strong>
              <span>{t('login.secureAccess')}</span>
            </div>
          </div>
          <Tooltip content={t('tooltips.switchLanguage')}>
            <button className="login-language-toggle login-language-toggle--brand" type="button" onClick={toggleLanguage}>
              {isArabic ? 'English' : 'العربية'}
            </button>
          </Tooltip>
        </header>

        <div className="login-brand-side__content">
          <div className="login-brand-copy">
            <p>{t('login.portalEyebrow')}</p>
            <h1>{t('login.welcomeTitle')}</h1>
            <span>{t('login.welcomeSubtitle')}</span>
          </div>

          <div className="login-business-board" aria-hidden="true">
            <div className="login-business-board__bar">
              <span />
              <span />
              <span />
            </div>
            <div className="login-business-board__scene">
              <div className="login-board-warehouse">
                <span />
                <span />
                <span />
              </div>
              <div className="login-board-ledger">
                <span />
                <span />
                <span />
              </div>
              <div className="login-board-scale">
                <span />
              </div>
              <div className="login-board-truck">
                <span />
              </div>
            </div>
          </div>

          <div className="login-highlight-grid">
            <article>
              <span>01</span>
              <strong>{t('login.features.inventoryTitle')}</strong>
              <p>{t('login.features.inventoryText')}</p>
            </article>
            <article>
              <span>02</span>
              <strong>{t('login.features.financeTitle')}</strong>
              <p>{t('login.features.financeText')}</p>
            </article>
            <article>
              <span>03</span>
              <strong>{t('login.features.shipmentTitle')}</strong>
              <p>{t('login.features.shipmentText')}</p>
            </article>
          </div>
        </div>
      </section>

      <section className="login-access-side" aria-label={t('login.title')}>
        <form
          className="login-card login-card--premium"
          onSubmit={mode === 'forgot' ? handleForgotSubmit : handleSubmit}
          noValidate
        >
          <div className="login-card__brand">
            <div className="login-logo" aria-hidden="true">{isArabic ? 'ب' : 'B'}</div>
            <div>
              <h2>{t('companyName')}</h2>
              <p>{t('login.systemName')}</p>
            </div>
          </div>

          <div className="login-card__heading">
            <p className="login-access-label">{t('login.secureAccess')}</p>
            <h3>{mode === 'forgot' ? t('login.forgotTitle') : t('login.title')}</h3>
            <p>{mode === 'forgot' ? t('login.forgotSubtitle') : t('login.subtitle')}</p>
          </div>

          {message.text && (
            <div
              className={`login-message login-message--${message.type}`}
              role={message.type === 'error' ? 'alert' : 'status'}
            >
              <p>{message.text}</p>
            </div>
          )}

          {mode === 'login' && (
            <>
              <label htmlFor="login-email">
                {t('login.emailAddress')}
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder={t('login.emailPlaceholder')}
                  autoComplete="email"
                  inputMode="email"
                  autoCapitalize="none"
                  spellCheck="false"
                  disabled={isLoading}
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
                />
                {fieldErrors.email && <span id="login-email-error" className="field-error">{fieldErrors.email}</span>}
              </label>

              <label htmlFor="login-password">
                {t('login.password')}
                <div className="password-field">
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={handleChange}
                    placeholder={t('login.passwordPlaceholder')}
                    autoComplete="current-password"
                    disabled={isLoading}
                    aria-invalid={Boolean(fieldErrors.password)}
                    aria-describedby={fieldErrors.password || isCapsLockOn ? 'login-password-help' : undefined}
                    onKeyUp={(event) => setIsCapsLockOn(Boolean(event.getModifierState?.('CapsLock')))}
                    onBlur={() => setIsCapsLockOn(false)}
                  />
                  <Tooltip content={showPassword ? t('tooltips.hidePassword') : t('tooltips.showPassword')}>
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowPassword((current) => !current)}
                      aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
                      disabled={isLoading}
                    >
                      {showPassword ? (
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M3 3l18 18" />
                          <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                          <path d="M9.1 5.4A9.8 9.8 0 0 1 12 5c5 0 8.7 4.1 10 7a13.6 13.6 0 0 1-3.1 4.4" />
                          <path d="M6.6 6.6A13.4 13.4 0 0 0 2 12c1.3 2.9 5 7 10 7 1.5 0 2.9-.4 4.1-1" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                      <span className="sr-only">{showPassword ? t('login.hidePassword') : t('login.showPassword')}</span>
                    </button>
                  </Tooltip>
                </div>
                {(fieldErrors.password || isCapsLockOn) && (
                  <span id="login-password-help" className="field-error">
                    {fieldErrors.password || t('login.capsLockWarning')}
                  </span>
                )}
              </label>

              <div className="login-options">
                <Tooltip content={t('tooltips.forgotPassword')}>
                  <button type="button" className="link-button" onClick={() => switchMode('forgot')}>{t('login.forgotPassword')}</button>
                </Tooltip>
              </div>
            </>
          )}

          {mode === 'forgot' && (
            <label htmlFor="login-forgot-email">
              {t('login.emailAddress')}
              <input
                id="login-forgot-email"
                name="forgotEmail"
                type="email"
                value={forgotEmail}
                onChange={(event) => setForgotEmail(event.target.value)}
                placeholder={t('login.emailPlaceholder')}
                autoComplete="email"
                inputMode="email"
                autoCapitalize="none"
                spellCheck="false"
                disabled={isLoading}
                aria-invalid={Boolean(fieldErrors.forgotEmail)}
                aria-describedby={fieldErrors.forgotEmail ? 'login-forgot-email-error' : undefined}
              />
              {fieldErrors.forgotEmail && <span id="login-forgot-email-error" className="field-error">{fieldErrors.forgotEmail}</span>}
            </label>
          )}

          <Tooltip content={t('tooltips.login')}>
            <button className="button button--primary login-submit" type="submit" disabled={isLoading}>
              {isLoading
                ? (mode === 'forgot' ? t('login.loading') : t('login.signingIn'))
                : mode === 'forgot'
                    ? t('login.sendResetLink')
                    : t('login.loginButton')}
            </button>
          </Tooltip>

          <div className="login-options login-options--center">
            {mode !== 'login' && (
              <button type="button" className="link-button" onClick={() => switchMode('login')}>{t('login.backToLogin')}</button>
            )}
          </div>

          <footer className="login-footer">
            <span>{t('companyName')}</span>
            <span>© {currentYear}</span>
          </footer>
        </form>
      </section>
    </main>
  );
}
