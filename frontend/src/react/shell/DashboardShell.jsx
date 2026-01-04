import React, { useEffect, useRef } from 'react';

const DashboardShell = () => {
  const sidebarRef = useRef(null);
  const mainHeaderRef = useRef(null);
  const pageContentRef = useRef(null);

  useEffect(() => {
    const refreshIcons = () => {
      if (typeof feather !== 'undefined') {
        feather.replace();
      }
    };

    refreshIcons();

    const iconObserver = new MutationObserver(() => refreshIcons());
    iconObserver.observe(document.body, { childList: true, subtree: true });

    const ensureHeaderHidden = () => {
      if (mainHeaderRef.current) {
        mainHeaderRef.current.classList.add('hidden');
      }
    };

    ensureHeaderHidden();
    const contentObserver = new MutationObserver(() => ensureHeaderHidden());
    if (pageContentRef.current) {
      contentObserver.observe(pageContentRef.current, { childList: true, subtree: true });
    }

    const handleDocumentClick = (event) => {
      const sidebar = sidebarRef.current;
      if (!sidebar) return;
      if (window.innerWidth <= 1024 && !sidebar.contains(event.target)) {
        sidebar.classList.remove('mobile-open');
      }
    };

    const stopSidebarClick = (event) => {
      event.stopPropagation();
    };

    document.addEventListener('click', handleDocumentClick);
    if (sidebarRef.current) {
      sidebarRef.current.addEventListener('click', stopSidebarClick);
    }

    window.dispatchEvent(new CustomEvent('dashboard:shell-ready'));

    return () => {
      iconObserver.disconnect();
      contentObserver.disconnect();
      document.removeEventListener('click', handleDocumentClick);
      if (sidebarRef.current) {
        sidebarRef.current.removeEventListener('click', stopSidebarClick);
      }
    };
  }, []);

  return (
    <>
      <div className="loading-overlay" id="loading-overlay" style={{ display: 'none' }}>
        <div className="loading-spinner"></div>
      </div>

      <div className="notification" id="notification"></div>

      <div className="app-container shell-premium">
        <aside className="sidebar" id="sidebar" ref={sidebarRef}>
          <div className="sidebar-header">
            <div className="sidebar-brand">
              <svg className="brand-logo" viewBox="0 0 64 64" aria-hidden="true">
                <defs>
                  <linearGradient id="sidebarRimGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" style={{ stopColor: '#5b8cff', stopOpacity: 1 }} />
                    <stop offset="100%" style={{ stopColor: '#7c5cff', stopOpacity: 1 }} />
                  </linearGradient>
                  <linearGradient id="sidebarHubGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style={{ stopColor: '#5b8cff', stopOpacity: 1 }} />
                    <stop offset="60%" style={{ stopColor: '#7c5cff', stopOpacity: 1 }} />
                    <stop offset="100%" style={{ stopColor: '#f08fdc', stopOpacity: 1 }} />
                  </linearGradient>
                  <filter id="sidebarGlow">
                    <feGaussianBlur stdDeviation="1.2" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                  <path id="sidebarWordTop" d="M 12 32 A 20 20 0 0 0 52 32" />
                  <path id="sidebarWordBottom" d="M 52 32 A 20 20 0 0 0 12 32" />
                </defs>

                <g>
                  <circle cx="32" cy="32" r="20" fill="none" stroke="url(#sidebarRimGradient)" strokeWidth="8" opacity="0.95" />
                  <text fill="#ffffff" fontSize="4.6" fontWeight="600" letterSpacing="0.28em" dominantBaseline="middle">
                    <textPath href="#sidebarWordTop" startOffset="50%" textAnchor="middle">
                      SPINNINGLAB
                    </textPath>
                  </text>
                  <text fill="#ffffff" fontSize="4.6" fontWeight="600" letterSpacing="0.28em" dominantBaseline="middle">
                    <textPath href="#sidebarWordBottom" startOffset="50%" textAnchor="middle">
                      SPINNINGLAB
                    </textPath>
                  </text>
                </g>

                <g>
                  <circle cx="32" cy="32" r="9" fill="none" stroke="url(#sidebarHubGradient)" strokeWidth="2.5" opacity="0.9" />
                  <circle cx="32" cy="32" r="11" fill="none" stroke="url(#sidebarHubGradient)" strokeWidth="2.2" strokeDasharray="3 6" strokeLinecap="round" opacity="0.9" />
                  <circle cx="32" cy="32" r="5.5" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.2" />
                  <circle cx="32" cy="32" r="4" fill="url(#sidebarHubGradient)" filter="url(#sidebarGlow)" />
                  <circle cx="32" cy="32" r="2.6" fill="none" stroke="white" strokeWidth="0.8" opacity="0.65" />
                  <circle cx="32" cy="32" r="1.2" fill="white" opacity="0.45" />
                </g>
              </svg>
              <span>SpinningLab</span>
            </div>
          </div>

          <nav className="sidebar-nav">
            <div className="nav-section">
              <div className="nav-section-title">Dashboard</div>
              <a href="#overview" className="nav-item active" data-page="overview">
                <i data-feather="home"></i>
                <span>Overview</span>
              </a>
            </div>

            <div className="nav-section">
              <div className="nav-section-title">Performance</div>
              <a href="#training-load" className="nav-item" data-page="training-load">
                <i data-feather="trending-up"></i>
                <span>Training Load</span>
              </a>
              <a href="#comparisons" className="nav-item" data-page="comparisons">
                <i data-feather="bar-chart-2"></i>
                <span>Comparisons</span>
              </a>
              <a href="#power-curve" className="nav-item" data-page="power-curve">
                <i data-feather="activity"></i>
                <span>Power Curve</span>
              </a>
              <a href="#critical-power" className="nav-item" data-page="critical-power">
                <i data-feather="target"></i>
                <span>Critical Power</span>
              </a>
              <a href="#efficiency" className="nav-item" data-page="efficiency">
                <i data-feather="percent"></i>
                <span>Efficiency</span>
              </a>
              <a href="#best-powers" className="nav-item" data-page="best-powers">
                <i data-feather="award"></i>
                <span>Best Powers</span>
              </a>
            </div>

            <div className="nav-section">
              <div className="nav-section-title">Analysis</div>
              <a href="#zones" className="nav-item" data-page="zones">
                <i data-feather="layers"></i>
                <span>Power Zones</span>
              </a>
              <a href="#hr-zones" className="nav-item" data-page="hr-zones">
                <i data-feather="heart"></i>
                <span>HR Zones</span>
              </a>
              <a href="#vo2max" className="nav-item" data-page="vo2max">
                <i data-feather="wind"></i>
                <span>VO2 Max</span>
              </a>
            </div>

            <div className="nav-section">
              <div className="nav-section-title">Workout Planning</div>
              <a href="#calendar" className="nav-item" data-page="calendar">
                <i data-feather="calendar"></i>
                <span>Calendar</span>
              </a>
              <a href="#workout-library" className="nav-item" data-page="workout-library">
                <i data-feather="book"></i>
                <span>Workout Library</span>
              </a>
              <a href="#workout-builder" className="nav-item" data-page="workout-builder">
                <i data-feather="edit"></i>
                <span>Workout Builder</span>
              </a>
              <a href="#training-plans" className="nav-item" data-page="training-plans">
                <i data-feather="layers"></i>
                <span>Training Plans</span>
              </a>
            </div>

            <div className="nav-section">
              <div className="nav-section-title">Data</div>
              <a href="#activities" className="nav-item" data-page="activities">
                <i data-feather="list"></i>
                <span>Activities</span>
              </a>
              <a href="#upload" className="nav-item" data-page="upload">
                <i data-feather="upload"></i>
                <span>Upload</span>
              </a>
              <a href="#settings" className="nav-item" data-page="settings">
                <i data-feather="settings"></i>
                <span>Settings</span>
              </a>
            </div>
          </nav>

          <div className="sidebar-footer">
            <div className="user-info">
              <div className="user-avatar" id="user-avatar">
                <i data-feather="user"></i>
              </div>
              <span id="userEmail" title="Current user">User</span>
            </div>
            <button className="logout-btn" id="logout-btn" title="Logout" aria-label="Logout">
              <i data-feather="log-out"></i>
            </button>
          </div>
        </aside>

        <main className="main-content" id="main-content">
          <header className="main-header hidden" ref={mainHeaderRef}>
            <div>
              <h1 id="page-title">Overview</h1>
              <p id="page-subtitle" className="main-subtitle"></p>
            </div>
            <div className="header-actions">
              <button className="btn btn--secondary btn--sm" id="refresh-btn" title="Refresh Page">
                <i data-feather="refresh-cw" style={{ width: '16px', height: '16px' }}></i>
                <span>Refresh</span>
              </button>
              <button className="btn btn--primary btn--sm" id="upload-btn-header" title="Upload Activities">
                <i data-feather="upload" style={{ width: '16px', height: '16px' }}></i>
                <span>Upload</span>
              </button>
            </div>
          </header>

          <div id="pageContent" ref={pageContentRef}>
            <div style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
              <div className="loading-spinner" style={{ margin: '0 auto 20px' }}></div>
              <p style={{ fontSize: '15px', fontWeight: 500 }}>Loading dashboard...</p>
            </div>
          </div>
        </main>
      </div>
    </>
  );
};

export default DashboardShell;
