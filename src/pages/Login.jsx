import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Tooltip from '../components/ui/Tooltip.jsx';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { loginUser, requestPasswordReset } from '../services/authApi.js';

export default function Login({ onLogin }) {
  const navigate = useNavigate();
  const { t, isArabic, direction, language, toggleLanguage } = useLanguage();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ username: '', password: '', remember: false });
  const [forgotEmail, setForgotEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  function handleChange(event) {
    const { name, value, checked, type } = event.target;
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
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
    if (!form.username.trim()) nextErrors.username = t('login.emailRequiredError');
    if (!form.password.trim()) nextErrors.password = t('login.passwordRequiredError') || t('login.requiredError');
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
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
        email: form.username.trim(),
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

    if (!forgotEmail.trim()) {
      setFieldErrors({ forgotEmail: t('login.emailRequiredError') });
      return;
    }

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

  const dateTime = now.toLocaleString(language === 'ar' ? 'ar' : 'en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <main className="login-page" dir={direction} lang={language}>
      <section className="login-visual" aria-label={t('login.welcomeTitle')}>
        <div className="login-visual__top">
          <Tooltip content={t('tooltips.switchLanguage')}>
            <button className="login-language-toggle" type="button" onClick={toggleLanguage}>
              {isArabic ? 'English' : 'العربية'}
            </button>
          </Tooltip>
          <time dateTime={now.toISOString()}>{dateTime}</time>
        </div>

        <div className="login-brand-panel">
          <div className="login-welcome">
            <p>{t('companyName')}</p>
            <h1>{t('login.welcomeTitle')}</h1>
            <span>{t('login.welcomeSubtitle')}</span>
          </div>

          <div className="login-trade-visual" aria-hidden="true">
            <div className="login-trade-visual__warehouse">
              <span />
              <span />
              <span />
            </div>
            <div className="login-trade-visual__grain">
              <span />
              <span />
              <span />
            </div>
            <div className="login-trade-visual__truck">
              <span />
            </div>
          </div>

          <div className="login-feature-grid">
            <article className="login-feature-card">
              <span className="login-feature-card__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M4 9.5L12 5l8 4.5v9L12 23l-8-4.5z" />
                  <path d="M12 14v9M4.5 10L12 14l7.5-4" />
                </svg>
              </span>
              <strong>{t('login.features.inventoryTitle')}</strong>
              <p>{t('login.features.inventoryText')}</p>
            </article>
            <article className="login-feature-card">
              <span className="login-feature-card__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M5 19V5M5 19h16" />
                  <path d="M9 16v-5M13 16V8M17 16v-8" />
                </svg>
              </span>
              <strong>{t('login.features.financeTitle')}</strong>
              <p>{t('login.features.financeText')}</p>
            </article>
            <article className="login-feature-card">
              <span className="login-feature-card__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M3 17h13V7H3z" />
                  <path d="M16 11h3l2 3v3h-5z" />
                  <path d="M6 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM18 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
                </svg>
              </span>
              <strong>{t('login.features.shipmentTitle')}</strong>
              <p>{t('login.features.shipmentText')}</p>
            </article>
          </div>
        </div>
      </section>

      <section className="login-panel">
        <form
          className="login-card"
          onSubmit={mode === 'forgot' ? handleForgotSubmit : handleSubmit}
        >
          <div className="login-card__brand">
            <div className="login-logo">{isArabic ? 'ب' : 'B'}</div>
            <div>
              <h2>{t('companyName')}</h2>
              <p>{t('login.systemName')}</p>
            </div>
          </div>

          <div className="login-card__heading">
            <h3>{mode === 'forgot' ? t('login.forgotTitle') : t('login.title')}</h3>
            <p>{mode === 'forgot' ? t('login.forgotSubtitle') : t('login.subtitle')}</p>
          </div>

          {message.text && (
            <div className={`login-message login-message--${message.type}`} role="status">
              <p>{message.text}</p>
            </div>
          )}

          {mode === 'login' && (
            <>
              <label>
                {t('login.username')}
                <input
                  name="username"
                  type="text"
                  value={form.username}
                  onChange={handleChange}
                  placeholder={t('login.usernamePlaceholder')}
                  autoComplete="username"
                  aria-invalid={Boolean(fieldErrors.username)}
                  aria-describedby={fieldErrors.username ? 'login-username-error' : undefined}
                />
                {fieldErrors.username && <span id="login-username-error" className="field-error">{fieldErrors.username}</span>}
              </label>

              <label>
                {t('login.password')}
                <div className="password-field">
                  <input
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={handleChange}
                    placeholder={t('login.passwordPlaceholder')}
                    autoComplete="current-password"
                    aria-invalid={Boolean(fieldErrors.password)}
                    aria-describedby={fieldErrors.password || isCapsLockOn ? 'login-password-help' : undefined}
                    onKeyUp={(event) => setIsCapsLockOn(Boolean(event.getModifierState?.('CapsLock')))}
                    onBlur={() => setIsCapsLockOn(false)}
                  />
                  <Tooltip content={showPassword ? t('tooltips.hidePassword') : t('tooltips.showPassword')}>
                    <button type="button" onClick={() => setShowPassword((current) => !current)}>
                      {showPassword ? t('login.hidePassword') : t('login.showPassword')}
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
                <label className="remember-option">
                  <input name="remember" type="checkbox" checked={form.remember} onChange={handleChange} />
                  <span>{t('login.rememberMe')}</span>
                </label>
                <Tooltip content={t('tooltips.forgotPassword')}>
                  <button type="button" className="link-button" onClick={() => switchMode('forgot')}>{t('login.forgotPassword')}</button>
                </Tooltip>
              </div>
            </>
          )}

          {mode === 'forgot' && (
            <label>
              {t('login.email')}
              <input
                name="forgotEmail"
                type="email"
                value={forgotEmail}
                onChange={(event) => setForgotEmail(event.target.value)}
                placeholder={t('login.emailPlaceholder')}
                autoComplete="email"
                aria-invalid={Boolean(fieldErrors.forgotEmail)}
                aria-describedby={fieldErrors.forgotEmail ? 'login-forgot-email-error' : undefined}
              />
              {fieldErrors.forgotEmail && <span id="login-forgot-email-error" className="field-error">{fieldErrors.forgotEmail}</span>}
            </label>
          )}

          <Tooltip content={t('tooltips.login')}>
            <button className="button button--primary login-submit" type="submit" disabled={isLoading}>
              {isLoading
                ? t('login.loading')
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
            <span>© {now.getFullYear()}</span>
          </footer>
        </form>
      </section>
    </main>
  );
}
