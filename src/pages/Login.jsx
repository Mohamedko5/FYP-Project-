import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Tooltip from '../components/ui/Tooltip.jsx';
import { useLanguage } from '../i18n/LanguageContext.jsx';

export default function Login({ onLogin }) {
  const navigate = useNavigate();
  const { t, isArabic, direction, language, toggleLanguage } = useLanguage();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ username: '', password: '', remember: false });
  const [registerForm, setRegisterForm] = useState({
    fullName: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [forgotEmail, setForgotEmail] = useState('');
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

  function handleRegisterChange(event) {
    const { name, value } = event.target;
    setRegisterForm((current) => ({ ...current, [name]: value }));
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setMessage({ type: '', text: '' });
    setShowPassword(false);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage({ type: '', text: '' });

    if (!form.username.trim() || !form.password.trim()) {
      setMessage({ type: 'error', text: t('login.requiredError') });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('http://127.0.0.1:8000/api/auth/login/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.username.trim(),
          password: form.password,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.access) {
        throw new Error('Invalid credentials');
      }

      setIsLoading(false);
      setMessage({ type: 'success', text: t('login.successMessage') });
      window.setTimeout(() => {
        onLogin(data);
        navigate('/dashboard');
      }, 700);
    } catch {
      setIsLoading(false);
      setMessage({ type: 'error', text: t('login.invalidCredentials') });
    }
  }

  async function handleRegisterSubmit(event) {
    event.preventDefault();
    setMessage({ type: '', text: '' });

    if (
      !registerForm.fullName.trim()
      || !registerForm.username.trim()
      || !registerForm.email.trim()
      || !registerForm.password
      || !registerForm.confirmPassword
    ) {
      setMessage({ type: 'error', text: t('login.registerRequiredError') });
      return;
    }

    if (registerForm.password.length < 8) {
      setMessage({ type: 'error', text: t('login.passwordLengthError') });
      return;
    }

    if (registerForm.password !== registerForm.confirmPassword) {
      setMessage({ type: 'error', text: t('login.passwordMismatchError') });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('http://127.0.0.1:8000/api/auth/register/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: registerForm.fullName.trim(),
          username: registerForm.username.trim(),
          email: registerForm.email.trim(),
          password: registerForm.password,
          confirm_password: registerForm.confirmPassword,
          role: 'admin',
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.email?.[0] || data.username?.[0] || data.detail || 'Registration failed');
      }

      setRegisterForm({ fullName: '', username: '', email: '', password: '', confirmPassword: '' });
      setMode('login');
      setMessage({ type: 'success', text: t('login.registerSuccess') });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || t('login.registerError') });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleForgotSubmit(event) {
    event.preventDefault();
    setMessage({ type: '', text: '' });

    if (!forgotEmail.trim()) {
      setMessage({ type: 'error', text: t('login.emailRequiredError') });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('http://127.0.0.1:8000/api/auth/forgot-password/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim() }),
      });

      if (!response.ok) {
        throw new Error('Forgot password failed');
      }

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
          onSubmit={mode === 'register' ? handleRegisterSubmit : mode === 'forgot' ? handleForgotSubmit : handleSubmit}
        >
          <div className="login-card__brand">
            <div className="login-logo">{isArabic ? 'ب' : 'B'}</div>
            <div>
              <h2>{t('companyName')}</h2>
              <p>{t('login.systemName')}</p>
            </div>
          </div>

          <div className="login-card__heading">
            <h3>{mode === 'register' ? t('login.createAccount') : mode === 'forgot' ? t('login.forgotTitle') : t('login.title')}</h3>
            <p>{mode === 'register' ? t('login.registerSubtitle') : mode === 'forgot' ? t('login.forgotSubtitle') : t('login.subtitle')}</p>
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
                  <button type="button" className="link-button" onClick={() => switchMode('forgot')}>{t('login.forgotPassword')}</button>
                </Tooltip>
              </div>
            </>
          )}

          {mode === 'register' && (
            <>
              <label>{t('login.fullName')}<input name="fullName" value={registerForm.fullName} onChange={handleRegisterChange} placeholder={t('login.fullNamePlaceholder')} /></label>
              <label>{t('login.usernameOnly')}<input name="username" value={registerForm.username} onChange={handleRegisterChange} placeholder={t('login.usernameOnlyPlaceholder')} autoComplete="username" /></label>
              <label>{t('login.email')}<input name="email" type="email" value={registerForm.email} onChange={handleRegisterChange} placeholder={t('login.emailPlaceholder')} autoComplete="email" /></label>
              <label>{t('login.password')}
                <div className="password-field">
                  <input name="password" type={showPassword ? 'text' : 'password'} value={registerForm.password} onChange={handleRegisterChange} placeholder={t('login.passwordPlaceholder')} autoComplete="new-password" />
                  <button type="button" onClick={() => setShowPassword((current) => !current)}>{showPassword ? t('login.hidePassword') : t('login.showPassword')}</button>
                </div>
              </label>
              <label>{t('login.confirmPassword')}<input name="confirmPassword" type={showPassword ? 'text' : 'password'} value={registerForm.confirmPassword} onChange={handleRegisterChange} placeholder={t('login.confirmPasswordPlaceholder')} autoComplete="new-password" /></label>
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
              />
            </label>
          )}

          <Tooltip content={t('tooltips.login')}>
            <button className="button button--primary login-submit" type="submit" disabled={isLoading}>
              {isLoading
                ? t('login.loading')
                : mode === 'register'
                  ? t('login.createAccount')
                  : mode === 'forgot'
                    ? t('login.sendResetLink')
                    : t('login.loginButton')}
            </button>
          </Tooltip>

          <div className="login-options login-options--center">
            {mode === 'login' ? (
              <button type="button" className="link-button" onClick={() => switchMode('register')}>{t('login.createAccount')}</button>
            ) : (
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
