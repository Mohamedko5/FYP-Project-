import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
        onLogin();
        navigate('/');
      }, 700);
    }, 900);
  }

  const dateTime = now.toLocaleString(language === 'ar' ? 'ar' : 'en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <main className="login-page" dir={direction} lang={language}>
      <section className="login-visual">
        <div className="login-visual__top">
          <button className="language-toggle" type="button" onClick={toggleLanguage}>
            {t('switchLanguage')}
          </button>
          <span>{dateTime}</span>
        </div>

        <div className="login-illustration" aria-hidden="true">
          <div className="login-illustration__sun" />
          <div className="login-illustration__warehouse">
            <span />
            <span />
            <span />
          </div>
          <div className="login-illustration__field">
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="login-illustration__truck">
            <span />
          </div>
        </div>

        <div className="login-welcome">
          <p>{t('companyName')}</p>
          <h1>{t('login.welcomeTitle')}</h1>
          <span>{t('login.welcomeSubtitle')}</span>
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
            <div className={message.type === 'success' ? 'form-success' : 'form-error'}>
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
              <button type="button" onClick={() => setShowPassword((current) => !current)}>
                {showPassword ? t('login.hidePassword') : t('login.showPassword')}
              </button>
            </div>
          </label>

          <div className="login-options">
            <label className="remember-option">
              <input name="remember" type="checkbox" checked={form.remember} onChange={handleChange} />
              <span>{t('login.rememberMe')}</span>
            </label>
            <button type="button" className="link-button">{t('login.forgotPassword')}</button>
          </div>

          <button className="button button--primary login-submit" type="submit" disabled={isLoading}>
            {isLoading ? t('login.loading') : t('login.loginButton')}
          </button>

          <footer className="login-footer">
            <span>{t('companyName')}</span>
            <span>© {now.getFullYear()}</span>
          </footer>
        </form>
      </section>
    </main>
  );
}
