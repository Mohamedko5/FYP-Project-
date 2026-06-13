import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Tooltip from '../components/ui/Tooltip.jsx';
import { useLanguage } from '../i18n/LanguageContext.jsx';

export default function Login({ onLogin }) {
  const navigate = useNavigate();
  const { t, isArabic, direction, language, toggleLanguage } = useLanguage();
  const [form, setForm] = useState({ username: '', password: '', remember: false });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  function handleChange(event) {
    const { name, value, checked, type } = event.target;
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    setMessage({ type: '', text: '' });

    if (!form.username.trim() || !form.password.trim()) {
      setMessage({ type: 'error', text: t('login.requiredError') });
      return;
    }

    setIsLoading(true);
    window.setTimeout(() => {
      setIsLoading(false);
      setMessage({ type: 'success', text: t('login.successMessage') });
      window.setTimeout(() => {
        onLogin(form.remember);
        navigate('/');
      }, 700);
    }, 700);
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
        <form className="login-card" onSubmit={handleSubmit}>
          <div className="login-card__brand">
            <div className="login-logo">{isArabic ? 'ب' : 'B'}</div>
            <div>
              <h2>{t('companyName')}</h2>
              <p>{t('login.systemName')}</p>
            </div>
          </div>

          <div className="login-card__heading">
            <h3>{t('login.title')}</h3>
            <p>{t('login.subtitle')}</p>
          </div>

          {message.text && (
            <div className={`login-message login-message--${message.type}`} role="status">
              <p>{message.text}</p>
            </div>
          )}

          <label>
            {t('login.username')}
            <input
              name="username"
              type="text"
              value={form.username}
              onChange={handleChange}
              placeholder={t('login.usernamePlaceholder')}
              autoComplete="username"
            />
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
              />
              <Tooltip content={showPassword ? t('tooltips.hidePassword') : t('tooltips.showPassword')}>
                <button type="button" onClick={() => setShowPassword((current) => !current)}>
                  {showPassword ? t('login.hidePassword') : t('login.showPassword')}
                </button>
              </Tooltip>
            </div>
          </label>

          <div className="login-options">
            <label className="remember-option">
              <input name="remember" type="checkbox" checked={form.remember} onChange={handleChange} />
              <span>{t('login.rememberMe')}</span>
            </label>
            <Tooltip content={t('tooltips.forgotPassword')}>
              <button type="button" className="link-button">{t('login.forgotPassword')}</button>
            </Tooltip>
          </div>

          <Tooltip content={t('tooltips.login')}>
            <button className="button button--primary login-submit" type="submit" disabled={isLoading}>
              {isLoading ? t('login.loading') : t('login.loginButton')}
            </button>
          </Tooltip>

          <footer className="login-footer">
            <span>{t('companyName')}</span>
            <span>© {now.getFullYear()}</span>
          </footer>
        </form>
      </section>
    </main>
  );
}
