import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext.jsx';

export default function ResetPassword() {
  const { t, direction, language } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const resetData = useMemo(() => ({
    uid: searchParams.get('uid') || '',
    token: searchParams.get('token') || '',
  }), [searchParams]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage({ type: '', text: '' });

    if (!resetData.uid || !resetData.token) {
      setMessage({ type: 'error', text: t('login.resetInvalidLink') });
      return;
    }

    if (form.password.length < 8) {
      setMessage({ type: 'error', text: t('login.passwordLengthError') });
      return;
    }

    if (form.password !== form.confirmPassword) {
      setMessage({ type: 'error', text: t('login.passwordMismatchError') });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('http://127.0.0.1:8000/api/auth/reset-password/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: resetData.uid,
          token: resetData.token,
          password: form.password,
          confirm_password: form.confirmPassword,
        }),
      });

      if (!response.ok) throw new Error('Reset failed');

      setMessage({ type: 'success', text: t('login.resetSuccess') });
      window.setTimeout(() => navigate('/login'), 900);
    } catch {
      setMessage({ type: 'error', text: t('login.resetError') });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="login-page login-page--reset" dir={direction} lang={language}>
      <section className="login-panel login-panel--full">
        <form className="login-card" onSubmit={handleSubmit}>
          <div className="login-card__brand">
            <div className="login-logo">B</div>
            <div>
              <h2>{t('companyName')}</h2>
              <p>{t('login.systemName')}</p>
            </div>
          </div>

          <div className="login-card__heading">
            <h3>{t('login.resetTitle')}</h3>
            <p>{t('login.resetSubtitle')}</p>
          </div>

          {message.text && (
            <div className={`login-message login-message--${message.type}`} role="status">
              <p>{message.text}</p>
            </div>
          )}

          <label>
            {t('login.newPassword')}
            <input name="password" type="password" value={form.password} onChange={handleChange} autoComplete="new-password" />
          </label>
          <label>
            {t('login.confirmPassword')}
            <input name="confirmPassword" type="password" value={form.confirmPassword} onChange={handleChange} autoComplete="new-password" />
          </label>

          <button className="button button--primary login-submit" type="submit" disabled={isLoading}>
            {isLoading ? t('login.loading') : t('login.resetPassword')}
          </button>

          <div className="login-options login-options--center">
            <Link className="link-button" to="/login">{t('login.backToLogin')}</Link>
          </div>
        </form>
      </section>
    </main>
  );
}
