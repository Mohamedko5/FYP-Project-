import React from 'react';
import Button from './Button.jsx';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    if (import.meta.env.DEV) {
      console.error('Bayad UI render error:', error, errorInfo);
    }
  }

  handleTryAgain = () => {
    this.setState({ error: null });
  };

  handleDashboard = () => {
    this.setState({ error: null });
    window.history.pushState({}, '', '/dashboard');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  handleLogout = () => {
    localStorage.removeItem('bayadAccessToken');
    localStorage.removeItem('bayadRefreshToken');
    localStorage.removeItem('bayadUser');
    window.location.assign('/login');
  };

  render() {
    if (!this.state.error) return this.props.children;
    const isArabic = document.documentElement.dir === 'rtl' || document.querySelector('[dir="rtl"]');
    const label = isArabic ? {
      title: 'حدث خطأ أثناء عرض هذه الصفحة.',
      description: 'حاول مرة أخرى، أو ارجع إلى لوحة التحكم، أو سجل الخروج ثم ادخل مرة أخرى.',
      tryAgain: 'حاول مرة أخرى',
      dashboard: 'اذهب إلى لوحة التحكم',
      logout: 'تسجيل الخروج',
    } : {
      title: 'Something went wrong while displaying this page.',
      description: 'Try again, go back to the Dashboard, or log out and sign in again.',
      tryAgain: 'Try Again',
      dashboard: 'Go to Dashboard',
      logout: 'Logout',
    };

    return (
      <main className="error-boundary-page" role="alert">
        <section className="error-boundary-card">
          <span className="error-boundary-card__mark">B</span>
          <h1>{label.title}</h1>
          <p>{label.description}</p>
          <div className="error-boundary-card__actions">
            <Button onClick={this.handleTryAgain}>{label.tryAgain}</Button>
            <Button variant="secondary" onClick={this.handleDashboard}>{label.dashboard}</Button>
            <Button variant="secondary" onClick={this.handleLogout}>{label.logout}</Button>
          </div>
        </section>
      </main>
    );
  }
}
