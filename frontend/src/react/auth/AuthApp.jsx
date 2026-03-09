import React, { useEffect, useState } from 'react';
import { notify } from '../../lib/utils/notifications.js';
import { AuthAPI } from '../../lib/core/api.js';

const PASSWORD_RULES = [
  {
    id: 'length',
    label: 'At least 8 characters',
    test: (value) => value.length >= 8 && value.length <= 128
  },
  {
    id: 'upper',
    label: 'One uppercase letter',
    test: (value) => /[A-Z]/.test(value)
  },
  {
    id: 'lower',
    label: 'One lowercase letter',
    test: (value) => /[a-z]/.test(value)
  },
  {
    id: 'number',
    label: 'One number',
    test: (value) => /\d/.test(value)
  },
  {
    id: 'special',
    label: 'One special character',
    test: (value) => /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/;'`~]/.test(value)
  }
];

const HERO_POINTS = [
  'Training load, fatigue and intensity distribution with direct context',
  'Workout planning, block structure and ride analysis in one workflow',
  'Highly specific cycling analysis without losing coaching clarity'
];

const HERO_METRICS = [
  { value: '90d', label: 'load horizon' },
  { value: '7d', label: 'weekly focus' },
  { value: '1 view', label: 'plan + analysis' }
];

function PasswordInput({
  id,
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
  visible,
  onToggle,
  helper,
}) {
  return (
    <div className="form-group">
      <label htmlFor={id}>{label}</label>
      <div className="input-wrapper input-wrapper--password">
        <svg className="input-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <input
          type={visible ? 'text' : 'password'}
          id={id}
          name={id}
          placeholder={placeholder}
          required
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
        />
        <button
          className="password-toggle"
          type="button"
          onClick={onToggle}
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
      {helper ? <p className="field-helper">{helper}</p> : null}
    </div>
  );
}

const AuthApp = () => {
  const [activeTab, setActiveTab] = useState('login');
  const [resetToken, setResetToken] = useState('');
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [registerData, setRegisterData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetData, setResetData] = useState({ password: '', confirmPassword: '' });
  const [devResetUrl, setDevResetUrl] = useState('');
  const [devVerifyUrl, setDevVerifyUrl] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState('');
  const [passwordVisibility, setPasswordVisibility] = useState({
    login: false,
    register: false,
    registerConfirm: false,
    reset: false,
    resetConfirm: false
  });
  const [loginLoading, setLoginLoading] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AuthAPI.me()
      .then(() => {
        if (!cancelled && window.location.pathname === '/index.html') {
          window.location.href = '/dashboard.html';
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const currentUrl = new URL(window.location.href);
    const mode = currentUrl.searchParams.get('mode');
    const token = currentUrl.searchParams.get('token');

    if (mode === 'reset' && token) {
      setActiveTab('reset');
      setResetToken(token);
      return;
    }

    if (mode === 'verify' && token) {
      setVerifyLoading(true);
      AuthAPI.confirmEmailVerification(token)
        .then((response) => {
          setVerifyMessage(response?.message || 'Email verified successfully. You can sign in now.');
          notify('Email verified. You can sign in now.', 'success');
          setActiveTab('login');
        })
        .catch((error) => {
          setVerifyMessage(error.message || 'Verification link is invalid or expired.');
          notify(error.message || 'Email verification failed', 'error');
          setActiveTab('login');
        })
        .finally(() => {
          const cleanUrl = new URL(window.location.href);
          cleanUrl.searchParams.delete('mode');
          cleanUrl.searchParams.delete('token');
          window.history.replaceState({}, '', `${cleanUrl.pathname}${cleanUrl.search}`);
          setVerifyLoading(false);
        });
    }
  }, []);

  const registerChecks = PASSWORD_RULES.map((rule) => ({
    ...rule,
    valid: rule.test(registerData.password)
  }));
  const resetChecks = PASSWORD_RULES.map((rule) => ({
    ...rule,
    valid: rule.test(resetData.password)
  }));

  const setTab = (tab) => {
    setActiveTab(tab);
    if (tab !== 'reset') {
      setResetToken('');
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.delete('mode');
      currentUrl.searchParams.delete('token');
      window.history.replaceState({}, '', `${currentUrl.pathname}${currentUrl.search}`);
    }
  };

  const togglePasswordVisibility = (field) => {
    setPasswordVisibility((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const handleLoginChange = (field) => (event) => {
    setLoginData((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleRegisterChange = (field) => (event) => {
    setRegisterData((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleResetChange = (field) => (event) => {
    setResetData((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    if (loginLoading) return;
    setLoginLoading(true);

    try {
      await AuthAPI.login(loginData.username.trim(), loginData.password);
      notify('Login successful. Redirecting...', 'success');
      setTimeout(() => {
        window.location.href = '/dashboard.html';
      }, 500);
    } catch (error) {
      console.error('Login error:', error);
      notify(error.message || 'Login failed', 'error');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    if (registerLoading) return;

    if (registerData.password !== registerData.confirmPassword) {
      notify('Passwords do not match', 'error');
      return;
    }

    setRegisterLoading(true);
    const normalizedEmail = registerData.email.trim().toLowerCase();
    setDevVerifyUrl('');

    try {
      const response = await AuthAPI.register(
        normalizedEmail,
        normalizedEmail,
        registerData.password,
        registerData.name || null
      );
      setLoginData((prev) => ({ ...prev, username: normalizedEmail }));
      setForgotEmail(normalizedEmail);
      setRegisterData({ name: '', email: '', password: '', confirmPassword: '' });
      if (response?.dev_verify_url) {
        setDevVerifyUrl(response.dev_verify_url);
        notify('Account created. Open the local verification link to activate sign-in.', 'success');
      } else {
        notify('Account created. Verify your email before signing in.', 'success');
      }
      setVerifyMessage('Check your inbox and verify the email address before signing in.');
      setTab('login');
    } catch (error) {
      console.error('Registration error:', error);
      notify(error.message || 'Registration failed', 'error');
    } finally {
      setRegisterLoading(false);
    }
  };

  const handleForgotPassword = async (event) => {
    event.preventDefault();
    if (forgotLoading) return;
    setForgotLoading(true);
    setDevResetUrl('');

    try {
      const normalizedEmail = forgotEmail.trim().toLowerCase();
      const response = await AuthAPI.requestPasswordReset(normalizedEmail);
      setLoginData((prev) => ({ ...prev, username: normalizedEmail }));
      if (response?.dev_reset_url) {
        setDevResetUrl(response.dev_reset_url);
        notify('Local dev link generated. Open it like a reset mail link.', 'success');
      } else {
        notify('If the email exists, a reset link has been sent.', 'success');
        setTab('login');
      }
    } catch (error) {
      console.error('Password reset request error:', error);
      notify(error.message || 'Unable to send reset email', 'error');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async (event) => {
    event.preventDefault();
    if (resetLoading) return;

    if (!resetToken) {
      notify('Reset link missing. Request a new reset email.', 'error');
      setTab('forgot');
      return;
    }

    if (resetData.password !== resetData.confirmPassword) {
      notify('Passwords do not match', 'error');
      return;
    }

    setResetLoading(true);

    try {
      await AuthAPI.confirmPasswordReset(resetToken, resetData.password);

      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.delete('mode');
      currentUrl.searchParams.delete('token');
      window.history.replaceState({}, '', `${currentUrl.pathname}${currentUrl.search}`);

      notify('Password updated. Redirecting to dashboard...', 'success');
      setTimeout(() => {
        window.location.href = '/dashboard.html';
      }, 700);
    } catch (error) {
      console.error('Password reset confirm error:', error);
      notify(error.message || 'Unable to update password', 'error');
    } finally {
      setResetLoading(false);
    }
  };

  const openDevResetLink = () => {
    if (!devResetUrl) return;
    const resetUrl = new URL(devResetUrl, window.location.origin);
    const token = resetUrl.searchParams.get('token') || '';
    setResetToken(token);
    window.history.replaceState({}, '', `${resetUrl.pathname}${resetUrl.search}`);
    setActiveTab('reset');
  };

  const copyDevResetLink = async () => {
    if (!devResetUrl || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(devResetUrl);
      notify('Reset link copied to clipboard.', 'success');
    } catch (error) {
      console.error('Copy reset link error:', error);
      notify('Unable to copy reset link', 'error');
    }
  };

  const openDevVerifyLink = async () => {
    if (!devVerifyUrl) return;
    const verifyUrl = new URL(devVerifyUrl, window.location.origin);
    const token = verifyUrl.searchParams.get('token');
    if (!token) return;
    try {
      setVerifyLoading(true);
      const response = await AuthAPI.confirmEmailVerification(token);
      setVerifyMessage(response?.message || 'Email verified successfully. You can sign in now.');
      setDevVerifyUrl('');
      notify('Email verified. You can sign in now.', 'success');
    } catch (error) {
      console.error('Verify link error:', error);
      notify(error.message || 'Unable to verify email', 'error');
    } finally {
      setVerifyLoading(false);
    }
  };

  const copyDevVerifyLink = async () => {
    if (!devVerifyUrl || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(devVerifyUrl);
      notify('Verification link copied to clipboard.', 'success');
    } catch (error) {
      console.error('Copy verify link error:', error);
      notify('Unable to copy verification link', 'error');
    }
  };

  return (
    <div className="auth-background">
      <div className="auth-shell">
        <section className="auth-hero auth-hero--welcome">
          <div className="auth-hero-copy">
            <div className="auth-badge">Performance dashboard</div>
            <div className="logo logo--hero">
              <svg viewBox="0 0 120 120" width="140" height="140" className="spinning-lab-logo" aria-hidden="true">
                <defs>
                  <linearGradient id="authLogoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity="1" />
                    <stop offset="50%" stopColor="#8b5cf6" stopOpacity="1" />
                    <stop offset="100%" stopColor="#c084fc" stopOpacity="1" />
                  </linearGradient>
                  <linearGradient id="authRimGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity="1" />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity="1" />
                  </linearGradient>
                  <filter id="authGlow">
                    <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                  <path id="authWordmarkPathTop" d="M 16 60 A 44 44 0 0 0 104 60" />
                  <path id="authWordmarkPathBottom" d="M 104 60 A 44 44 0 0 0 16 60" />
                </defs>

                <g className="auth-rim-spin">
                  <circle cx="60" cy="60" r="44" fill="none" stroke="url(#authRimGradient)" strokeWidth="12" opacity="0.95" />
                  <text className="auth-wordmark">
                    <textPath href="#authWordmarkPathTop" startOffset="50%" textAnchor="middle">
                      SpinningLab
                    </textPath>
                  </text>
                  <text className="auth-wordmark">
                    <textPath href="#authWordmarkPathBottom" startOffset="50%" textAnchor="middle">
                      SpinningLab
                    </textPath>
                  </text>
                </g>

                <g className="auth-chain-spin">
                  <g className="auth-chainring">
                    <circle cx="60" cy="60" r="18" fill="none" stroke="url(#authLogoGradient)" strokeWidth="3.2" opacity="0.9" />
                    <circle cx="60" cy="60" r="21" fill="none" stroke="url(#authLogoGradient)" strokeWidth="3" strokeDasharray="2 6" strokeLinecap="round" opacity="0.9" />
                    <circle cx="60" cy="60" r="11" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.4" />
                  </g>
                  <circle cx="60" cy="60" r="7.5" fill="url(#authLogoGradient)" filter="url(#authGlow)" />
                  <circle cx="60" cy="60" r="4.6" fill="none" stroke="white" strokeWidth="1.2" opacity="0.65" />
                  <circle cx="60" cy="60" r="2.2" fill="white" opacity="0.45" />
                </g>
              </svg>
              <h1>SpinningLab</h1>
            </div>
            <p className="tagline">Where data meets performance</p>
            <h2>Your training cockpit for load, planning and performance.</h2>
            <p className="auth-hero-text">
              SpinningLab brings ride data, weekly structure and coaching signals into one focused dashboard built for faster decisions and cleaner training feedback.
            </p>
            <div className="auth-hero-list">
              {HERO_POINTS.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </div>
        </section>

        <section className="auth-panel">
          <div className="auth-panel-card">
            <div className="auth-panel-top">
              <div>
                <div className="auth-panel-kicker">
                  {activeTab === 'register' ? 'Create account' : activeTab === 'forgot' ? 'Recover access' : activeTab === 'reset' ? 'New password' : 'Welcome back'}
                </div>
                <h3>
                  {activeTab === 'login' && 'Sign in to your dashboard'}
                  {activeTab === 'register' && 'Create your athlete account'}
                  {activeTab === 'forgot' && 'Request a reset email'}
                  {activeTab === 'reset' && 'Choose a new password'}
                </h3>
              </div>
              <div className="auth-panel-chip">{activeTab === 'reset' ? 'Recovery' : 'Secure access'}</div>
            </div>

            <div className="tab-navigation">
              <button
                className={`tab-btn ${activeTab === 'login' ? 'active' : ''}`}
                type="button"
                onClick={() => setTab('login')}
              >
                <svg className="tab-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                <span>Login</span>
              </button>
              <button
                className={`tab-btn ${activeTab === 'register' ? 'active' : ''}`}
                type="button"
                onClick={() => setTab('register')}
              >
                <svg className="tab-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                <span>Register</span>
              </button>
            </div>

            <div className="tab-container">
              <div className={`tab-content ${activeTab === 'login' ? 'active' : ''}`}>
                {verifyLoading ? (
                  <div className="reset-banner">
                    <span>Verifying</span>
                    <strong>Checking your email verification link…</strong>
                  </div>
                ) : null}
                {verifyMessage ? (
                  <div className="reset-banner">
                    <span>Email status</span>
                    <strong>{verifyMessage}</strong>
                  </div>
                ) : null}
                {devVerifyUrl ? (
                  <div className="dev-reset-card">
                    <div className="dev-reset-card__label">Local verification fallback</div>
                    <p>
                      No SMTP server is configured, so the backend generated a verification link instead of sending a mail.
                      Open it once to activate this account.
                    </p>
                    <div className="dev-reset-card__actions">
                      <button type="button" className="auth-btn" onClick={openDevVerifyLink} disabled={verifyLoading}>
                        <span className="btn-text">{verifyLoading ? 'Verifying...' : 'Open Verify Link'}</span>
                      </button>
                      <button type="button" className="auth-secondary-link" onClick={copyDevVerifyLink}>
                        Copy link
                      </button>
                    </div>
                  </div>
                ) : null}
                <form className="auth-form" onSubmit={handleLogin}>
                  <div className="form-group">
                    <label htmlFor="loginEmail">Email or username</label>
                    <div className="input-wrapper">
                      <svg className="input-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <input
                        type="text"
                        id="loginEmail"
                        name="username"
                        placeholder="you@example.com"
                        required
                        autoComplete="username"
                        value={loginData.username}
                        onChange={handleLoginChange('username')}
                      />
                    </div>
                  </div>

                  <PasswordInput
                    id="loginPassword"
                    label="Password"
                    value={loginData.password}
                    onChange={handleLoginChange('password')}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    visible={passwordVisibility.login}
                    onToggle={() => togglePasswordVisibility('login')}
                  />

                  <div className="auth-inline-row">
                    <span className="field-helper">Use your email address as your login identifier.</span>
                    <button className="auth-inline-link" type="button" onClick={() => setTab('forgot')}>
                      Forgot password?
                    </button>
                  </div>

                  <button type="submit" className="auth-btn" disabled={loginLoading}>
                    <span className="btn-text">{loginLoading ? 'Signing in...' : 'Sign In'}</span>
                  </button>
                </form>
              </div>

              <div className={`tab-content ${activeTab === 'register' ? 'active' : ''}`}>
                <form className="auth-form" onSubmit={handleRegister}>
                  <div className="form-group">
                    <label htmlFor="registerName">
                      Full name
                      <span className="optional">(optional)</span>
                    </label>
                    <div className="input-wrapper">
                      <svg className="input-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <input
                        type="text"
                        id="registerName"
                        name="name"
                        placeholder="Max Hartwig"
                        autoComplete="name"
                        value={registerData.name}
                        onChange={handleRegisterChange('name')}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="registerEmail">Email address</label>
                    <div className="input-wrapper">
                      <svg className="input-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <input
                        type="email"
                        id="registerEmail"
                        name="email"
                        placeholder="you@example.com"
                        required
                        autoComplete="email"
                        value={registerData.email}
                        onChange={handleRegisterChange('email')}
                      />
                    </div>
                  </div>

                  <PasswordInput
                    id="registerPassword"
                    label="Password"
                    value={registerData.password}
                    onChange={handleRegisterChange('password')}
                    autoComplete="new-password"
                    placeholder="Choose a strong password"
                    visible={passwordVisibility.register}
                    onToggle={() => togglePasswordVisibility('register')}
                    helper="The password must include uppercase, lowercase, number and symbol."
                  />

                  <PasswordInput
                    id="registerPasswordConfirm"
                    label="Confirm password"
                    value={registerData.confirmPassword}
                    onChange={handleRegisterChange('confirmPassword')}
                    autoComplete="new-password"
                    placeholder="Repeat your password"
                    visible={passwordVisibility.registerConfirm}
                    onToggle={() => togglePasswordVisibility('registerConfirm')}
                  />

                  <div className="password-checklist">
                    {registerChecks.map((rule) => (
                      <span key={rule.id} className={`password-check ${rule.valid ? 'is-valid' : ''}`}>
                        {rule.label}
                      </span>
                    ))}
                  </div>

                  <button type="submit" className="auth-btn" disabled={registerLoading}>
                    <span className="btn-text">{registerLoading ? 'Creating account...' : 'Create Account'}</span>
                  </button>
                </form>
              </div>

              <div className={`tab-content ${activeTab === 'forgot' ? 'active' : ''}`}>
                <form className="auth-form" onSubmit={handleForgotPassword}>
                  <div className="form-group">
                    <label htmlFor="forgotEmail">Account email</label>
                    <div className="input-wrapper">
                      <svg className="input-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <input
                        type="email"
                        id="forgotEmail"
                        name="forgotEmail"
                        placeholder="you@example.com"
                        required
                        autoComplete="email"
                        value={forgotEmail}
                        onChange={(event) => setForgotEmail(event.target.value)}
                      />
                    </div>
                    <p className="field-helper">If the account exists, the server sends a single-use reset link.</p>
                  </div>

                  <button type="submit" className="auth-btn" disabled={forgotLoading}>
                    <span className="btn-text">{forgotLoading ? 'Sending reset link...' : 'Send Reset Email'}</span>
                  </button>

                  <button className="auth-secondary-link" type="button" onClick={() => setTab('login')}>
                    Back to login
                  </button>
                </form>

                {devResetUrl ? (
                  <div className="dev-reset-card">
                    <div className="dev-reset-card__label">Local development fallback</div>
                    <p>
                      No SMTP server is configured, so the backend generated a reset link instead of sending a mail.
                      Open it manually to mimic the real mail flow.
                    </p>
                    <div className="dev-reset-card__actions">
                      <button type="button" className="auth-btn" onClick={openDevResetLink}>
                        <span className="btn-text">Open Reset Link</span>
                      </button>
                      <button type="button" className="auth-secondary-link" onClick={copyDevResetLink}>
                        Copy link
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className={`tab-content ${activeTab === 'reset' ? 'active' : ''}`}>
                <form className="auth-form" onSubmit={handleResetPassword}>
                  <div className="reset-banner">
                    <span>Single-use link</span>
                    <strong>
                      {resetToken
                        ? 'Choose a new password and continue directly into the dashboard.'
                        : 'This link is missing or expired. Request a new reset email.'}
                    </strong>
                  </div>

                  <PasswordInput
                    id="resetPassword"
                    label="New password"
                    value={resetData.password}
                    onChange={handleResetChange('password')}
                    autoComplete="new-password"
                    placeholder="Create a new password"
                    visible={passwordVisibility.reset}
                    onToggle={() => togglePasswordVisibility('reset')}
                  />

                  <PasswordInput
                    id="resetPasswordConfirm"
                    label="Confirm new password"
                    value={resetData.confirmPassword}
                    onChange={handleResetChange('confirmPassword')}
                    autoComplete="new-password"
                    placeholder="Repeat the new password"
                    visible={passwordVisibility.resetConfirm}
                    onToggle={() => togglePasswordVisibility('resetConfirm')}
                  />

                  <div className="password-checklist">
                    {resetChecks.map((rule) => (
                      <span key={rule.id} className={`password-check ${rule.valid ? 'is-valid' : ''}`}>
                        {rule.label}
                      </span>
                    ))}
                  </div>

                  <button type="submit" className="auth-btn" disabled={resetLoading}>
                    <span className="btn-text">{resetLoading ? 'Updating password...' : 'Save New Password'}</span>
                  </button>

                  <button className="auth-secondary-link" type="button" onClick={() => setTab('forgot')}>
                    Need a fresh reset link?
                  </button>
                </form>
              </div>
            </div>

            <div className="auth-panel-footer">
              <span>Passwords are hashed server-side. Reset links are stored hashed, expire automatically and cannot be reused.</span>
            </div>
          </div>
        </section>

        <section className="auth-visual-card" aria-hidden="true">
          <div className="auth-visual-card__image" />
          <div className="auth-visual-card__overlay">
            <div className="auth-visual-card__copy">
              <div className="auth-hero-media__topline">
                <div className="auth-hero-media__eyebrow">Analysis-first workspace</div>
                <div className="auth-hero-status">Performance focus</div>
              </div>
              <strong className="auth-visual-card__headline">
                High-end design meets deeply specific cycling analytics, training structure and sports science context.
              </strong>
              <p className="auth-visual-card__text">
                SpinningLab connects power, heart rate, fatigue signals, block planning and session interpretation in one premium interface built for athletes and coaches who want precise analysis rather than generic fitness summaries.
              </p>
              <div className="auth-metric-grid">
                {HERO_METRICS.map((metric) => (
                  <div className="auth-metric-card" key={metric.label}>
                    <strong>{metric.value}</strong>
                    <span>{metric.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="auth-hero-preview">
              <div className="auth-hero-preview__panel auth-hero-preview__panel--primary">
                  <span className="auth-hero-preview__label">Weekly load</span>
                  <strong>82%</strong>
                <div className="auth-hero-preview__bars">
                  <span className="is-tall" />
                  <span className="is-mid" />
                  <span className="is-tall" />
                  <span className="is-short" />
                  <span className="is-mid" />
                  <span className="is-tall" />
                  <span className="is-mid" />
                </div>
              </div>
              <div className="auth-hero-preview__stack">
                <div className="auth-hero-preview__panel">
                  <span className="auth-hero-preview__label">Periodization block</span>
                  <strong>VO2 + Tempo</strong>
                  <div className="auth-hero-preview__meta">3 key sessions aligned with recovery</div>
                </div>
                <div className="auth-hero-preview__panel auth-hero-preview__panel--glass">
                  <span className="auth-hero-preview__label">Readiness</span>
                  <strong>+11</strong>
                  <div className="auth-hero-preview__spark" />
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AuthApp;
