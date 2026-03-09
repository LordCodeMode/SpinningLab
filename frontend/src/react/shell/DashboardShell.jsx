import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Home, 
  TrendingUp, 
  BarChart2, 
  Activity, 
  Target, 
  Percent, 
  Award, 
  Layers, 
  Heart, 
  Wind, 
  Calendar, 
  Book, 
  Edit, 
  Bluetooth,
  List, 
  Upload, 
  Settings, 
  LogOut,
  User,
  RefreshCw,
  Moon,
  Sun
} from 'lucide-react';
import { DASHBOARD_NAV_SECTIONS } from '../../lib/pages/registry.js';

const DashboardShell = ({
  children,
  activePage = 'overview',
  activePageMeta = null,
  displayName = 'User',
  avatarInitial = 'U',
  onNavigate,
  onLogout
}) => {
  const sidebarRef = useRef(null);
  const mainHeaderRef = useRef(null);
  const pageContentRef = useRef(null);
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'light';
    const stored = window.localStorage.getItem('dashboard-theme');
    if (stored === 'light' || stored === 'dark') return stored;
    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
    return 'light';
  });
  const isDark = theme === 'dark';
  const iconMap = useMemo(() => ({
    home: Home,
    'trending-up': TrendingUp,
    'bar-chart-2': BarChart2,
    activity: Activity,
    target: Target,
    percent: Percent,
    award: Award,
    layers: Layers,
    heart: Heart,
    wind: Wind,
    calendar: Calendar,
    book: Book,
    edit: Edit,
    bluetooth: Bluetooth,
    list: List,
    upload: Upload,
    settings: Settings
  }), []);

  const handleNavClick = (event, pageKey) => {
    if (!onNavigate) return;
    event.preventDefault();
    onNavigate(pageKey);
  };

  const avatarNode = useMemo(() => {
    if (avatarInitial) {
      return <span className="user-avatar__initial">{avatarInitial}</span>;
    }
    return <User size={20} />;
  }, [avatarInitial]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const body = document.body;
    root.dataset.theme = theme;
    root.classList.toggle('dark', isDark);
    if (body) {
      body.dataset.theme = theme;
      body.classList.toggle('dark', isDark);
    }
    window.localStorage.setItem('dashboard-theme', theme);
    window.dispatchEvent(new CustomEvent('dashboard:theme-change', { detail: { theme } }));
  }, [isDark, theme]);

  useEffect(() => {
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

    document.addEventListener('click', handleDocumentClick);

    window.dispatchEvent(new CustomEvent('dashboard:shell-ready'));

    return () => {
      contentObserver.disconnect();
      document.removeEventListener('click', handleDocumentClick);
    };
  }, []);

  const NavItem = ({ page, icon: Icon, label, delay = 0 }) => (
    <motion.a
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay }}
      href={`#${page}`}
      className={`nav-item${activePage === page ? ' active' : ''}`}
      onClick={(event) => handleNavClick(event, page)}
    >
      <Icon size={20} />
      <span>{label}</span>
      {activePage === page && (
        <motion.div 
          layoutId="active-nav"
          className="active-indicator"
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
      )}
    </motion.a>
  );

  return (
    <>
      <div className="loading-overlay loading-overlay--hidden" id="loading-overlay">
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
                    <stop offset="0%" stopColor="#5b8cff" stopOpacity="1" />
                    <stop offset="100%" stopColor="#7c5cff" stopOpacity="1" />
                  </linearGradient>
                  <linearGradient id="sidebarHubGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#5b8cff" stopOpacity="1" />
                    <stop offset="60%" stopColor="#7c5cff" stopOpacity="1" />
                    <stop offset="100%" stopColor="#f08fdc" stopOpacity="1" />
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
            {DASHBOARD_NAV_SECTIONS.map((section, sectionIndex) => (
              <div className="nav-section" key={section.id}>
                <div className="nav-section-title">{section.label}</div>
                {section.pages.map((page, pageIndex) => {
                  const Icon = iconMap[page.icon] || Activity;
                  const delay = 0.1 + ((sectionIndex * 5) + pageIndex) * 0.05;

                  return (
                    <NavItem
                      key={page.id}
                      page={page.id}
                      icon={Icon}
                      label={page.navLabel}
                      delay={delay}
                    />
                  );
                })}
              </div>
            ))}
          </nav>

          <div className="sidebar-footer">
            <div className="user-info">
              <div className="user-avatar" id="user-avatar">
                {avatarNode}
              </div>
              <span id="userEmail" title="Current user">{displayName}</span>
            </div>
            <div className="sidebar-actions">
              <button
                className="theme-toggle"
                type="button"
                title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                aria-pressed={isDark}
                onClick={() => setTheme(prev => (prev === 'dark' ? 'light' : 'dark'))}
              >
                {isDark ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <button
                className="logout-btn"
                id="logout-btn"
                title="Logout"
                aria-label="Logout"
                onClick={onLogout}
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </aside>

        <main className="main-content" id="main-content">
          <header className="main-header hidden" ref={mainHeaderRef}>
            <div>
              <h1 id="page-title">{activePageMeta?.title || 'Overview'}</h1>
              <p id="page-subtitle" className="main-subtitle">{activePageMeta?.subtitle || ''}</p>
            </div>
            <div className="header-actions">
              <button className="btn btn--secondary btn--sm" id="refresh-btn" title="Refresh Page">
                <RefreshCw size={16} />
                <span>Refresh</span>
              </button>
              <button className="btn btn--primary btn--sm" id="upload-btn-header" title="Upload Activities">
                <Upload size={16} />
                <span>Upload</span>
              </button>
            </div>
          </header>

          <div id="pageContent" ref={pageContentRef}>
            <AnimatePresence mode="wait">
              <motion.div
                key={`${activePage}-${theme}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              >
                {children || (
                  <div className="dashboard-loading-state">
                    <div className="loading-spinner dashboard-loading-state__spinner"></div>
                    <p className="dashboard-loading-state__text">Loading dashboard...</p>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </>
  );
};

export default DashboardShell;
