import React, { useEffect, useState } from 'react';
import { notify } from '../../../static/js/utils/notifications.js';
import CONFIG, { API_BASE_URL } from '../../../static/js/core/config.js';

const AuthApp = () => {
  const [showAuth, setShowAuth] = useState(false);
  const [activeTab, setActiveTab] = useState('login');
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [registerData, setRegisterData] = useState({
    name: '',
    email: '',
    password: ''
  });
  const [loginLoading, setLoginLoading] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem(CONFIG.TOKEN_STORAGE_KEY);
    if (token && window.location.pathname === '/index.html') {
      window.location.href = '/dashboard.html';
    }
  }, []);

  useEffect(() => {
    if (typeof feather !== 'undefined') {
      feather.replace();
    }
  }, [activeTab]);

  const openAuth = (tab) => {
    setShowAuth(true);
    setActiveTab(tab);
  };

  const handleLoginChange = (field) => (event) => {
    setLoginData((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleRegisterChange = (field) => (event) => {
    setRegisterData((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    if (loginLoading) return;
    setLoginLoading(true);

    try {
      const payload = new URLSearchParams({
        username: loginData.username,
        password: loginData.password
      });

      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: payload
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem(CONFIG.TOKEN_STORAGE_KEY, data.access_token);
        localStorage.setItem('username', loginData.username);
        notify('Login successful! Redirecting...', 'success');
        setTimeout(() => {
          window.location.href = '/dashboard.html';
        }, 500);
      } else {
        notify(data.detail || 'Login failed', 'error');
      }
    } catch (error) {
      console.error('Login error:', error);
      notify('Network error. Please try again.', 'error');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    if (registerLoading) return;
    setRegisterLoading(true);

    try {
      const payload = {
        username: registerData.email,
        email: registerData.email,
        password: registerData.password,
        name: registerData.name || null
      };

      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok) {
        notify('Registration successful! Please log in.', 'success');
        setTimeout(() => {
          setActiveTab('login');
          setRegisterData({ name: '', email: '', password: '' });
        }, 1200);
      } else {
        notify(data.detail || 'Registration failed', 'error');
      }
    } catch (error) {
      console.error('Registration error:', error);
      notify('Network error. Please try again.', 'error');
    } finally {
      setRegisterLoading(false);
    }
  };

  return (
    <div className={`auth-background ${showAuth ? '' : 'auth-background--intro'}`}>
      <div className={`auth-container ${showAuth ? '' : 'auth-container--intro'}`}>
        <div className="auth-header">
          <div className="logo" style={{ gap: '20px' }}>
            <svg viewBox="0 0 120 120" width="140" height="140" className="spinning-lab-logo" aria-hidden="true">
              <defs>
                <linearGradient id="authLogoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style={{ stopColor: '#5b8cff', stopOpacity: 1 }} />
                  <stop offset="50%" style={{ stopColor: '#7c5cff', stopOpacity: 1 }} />
                  <stop offset="100%" style={{ stopColor: '#f08fdc', stopOpacity: 1 }} />
                </linearGradient>
                <linearGradient id="authRimGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" style={{ stopColor: '#5b8cff', stopOpacity: 1 }} />
                  <stop offset="100%" style={{ stopColor: '#7c5cff', stopOpacity: 1 }} />
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
        </div>

        {!showAuth ? (
          <div className="auth-intro">
            <div className="auth-intro-card">
              <div className="auth-intro-kicker">Training, simplified</div>
              <h2>All your rides, insights, and planning in one place.</h2>
              <p>
                SpinningLab turns raw ride files into clear coaching signals,
                structured training plans, and performance trends you can act on.
              </p>
              <div className="auth-intro-list">
                <span>Power curves, zones, and training load</span>
                <span>Workout builder with calendar planning</span>
                <span>Smart insights to guide each week</span>
              </div>
            </div>
            <div className="auth-intro-actions">
              <button className="auth-btn" type="button" onClick={() => openAuth('login')}>
                Continue to Login
              </button>
              <button className="auth-btn auth-btn--ghost" type="button" onClick={() => openAuth('register')}>
                Create Account
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="auth-intro-back">
              <button type="button" onClick={() => setShowAuth(false)}>
                <span>Back to intro</span>
              </button>
            </div>

            <div className="tab-navigation">
              <button
                className={`tab-btn ${activeTab === 'login' ? 'active' : ''}`}
                type="button"
                data-tab="login"
                onClick={() => setActiveTab('login')}
              >
                <svg className="tab-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                <span>Login</span>
              </button>
              <button
                className={`tab-btn ${activeTab === 'register' ? 'active' : ''}`}
                type="button"
                data-tab="register"
                onClick={() => setActiveTab('register')}
              >
                <svg className="tab-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                <span>Register</span>
              </button>
            </div>

            <div className="tab-container">
              <div className={`tab-content ${activeTab === 'login' ? 'active' : ''}`} id="loginTab">
                <form className="auth-form" id="loginForm" onSubmit={handleLogin}>
              <div className="form-group">
                <label htmlFor="loginEmail">Email or Username</label>
                <div className="input-wrapper">
                  <svg className="input-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <input
                    type="text"
                    id="loginEmail"
                    name="username"
                    placeholder="you@example.com or username"
                    required
                    autoComplete="username"
                    value={loginData.username}
                    onChange={handleLoginChange('username')}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="loginPassword">Password</label>
                <div className="input-wrapper">
                  <svg className="input-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <input
                    type="password"
                    id="loginPassword"
                    name="password"
                    placeholder="password"
                    required
                    autoComplete="current-password"
                    value={loginData.password}
                    onChange={handleLoginChange('password')}
                  />
                </div>
              </div>

              <button type="submit" className="auth-btn" id="loginBtn" disabled={loginLoading}>
                <svg className="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ display: loginLoading ? 'none' : 'block' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                <span className="btn-text">{loginLoading ? 'Logging in...' : 'Sign In'}</span>
                <span className="btn-loader" style={{ display: loginLoading ? 'inline-flex' : 'none' }}>
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" strokeWidth="4" stroke="currentColor" fill="none" opacity="0.25" />
                    <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="4" fill="none" />
                  </svg>
                </span>
              </button>
                </form>
              </div>

              <div className={`tab-content ${activeTab === 'register' ? 'active' : ''}`} id="registerTab">
                <form className="auth-form" id="registerForm" onSubmit={handleRegister}>
              <div className="form-group">
                <label htmlFor="registerName">
                  Full Name
                  <span className="optional">(optional)</span>
                </label>
                <div className="input-wrapper">
                  <svg className="input-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <input
                    type="text"
                    id="registerName"
                    name="name"
                    placeholder="John Doe"
                    autoComplete="name"
                    value={registerData.name}
                    onChange={handleRegisterChange('name')}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="registerEmail">Email Address</label>
                <div className="input-wrapper">
                  <svg className="input-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

              <div className="form-group">
                <label htmlFor="registerPassword">Password</label>
                <div className="input-wrapper">
                  <svg className="input-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <input
                    type="password"
                    id="registerPassword"
                    name="password"
                    placeholder="password"
                    required
                    autoComplete="new-password"
                    minLength={6}
                    value={registerData.password}
                    onChange={handleRegisterChange('password')}
                  />
                </div>
              </div>

              <button type="submit" className="auth-btn" id="registerBtn" disabled={registerLoading}>
                <svg className="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ display: registerLoading ? 'none' : 'block' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                <span className="btn-text">{registerLoading ? 'Creating account...' : 'Create Account'}</span>
                <span className="btn-loader" style={{ display: registerLoading ? 'inline-flex' : 'none' }}>
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" strokeWidth="4" stroke="currentColor" fill="none" opacity="0.25" />
                    <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="4" fill="none" />
                  </svg>
                </span>
              </button>
                </form>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthApp;
