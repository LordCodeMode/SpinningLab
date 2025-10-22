// ============================================
// FILE: static/js/core/dashboard.js
// ADD THIS IMPORT AT THE VERY TOP
// ============================================

import { AuthAPI, API, AnalysisAPI } from '/static/js/core/api.js';
import { notify, setLoading } from '/static/js/core/utils.js';
import { router } from '/static/js/core/router.js';

// ⭐ ADD THIS CRITICAL IMPORT - Loads all services and makes them global
import Services from '/static/js/services/index.js';

// CRITICAL: Define TOKEN_STORAGE_KEY here as fallback
const TOKEN_STORAGE_KEY = 'auth_token';

const PAGE_DEFINITIONS = {
  overview: { path: '../pages/overview/index.js' },
  activities: { path: '../pages/activities/index.js' },
  settings: { path: '../pages/settings/index.js' },
  upload: { path: '../pages/upload/index.js' },
  'training-load': { path: '../pages/training-load/index.js' },
  'power-curve': { path: '../pages/power-curve/index.js' },
  'critical-power': { path: '../pages/critical-power/index.js' },
  efficiency: { path: '../pages/efficiency/index.js' },
  'best-powers': { path: '../pages/best-powers/index.js' },
  'fitness-state': { path: '../pages/fitness-state/index.js' },
  zones: { path: '../pages/zones/index.js' },
  vo2max: { path: '../pages/vo2max/index.js' },
  'hr-zones': { path: '../pages/hr-zones/index.js' }
};

const FALLBACK_MESSAGE = 'This page is not available yet. Check back soon!';

class Dashboard {
  constructor() {
    this.currentUser = null;
    this.isInitialized = false;
    this.refreshInterval = null;
    this.headerStatsCache = null;
    this.lastStatsUpdate = null;
  }

  async init() {
    try {
      setLoading(true);
      console.log('[Dashboard] ========== INITIALIZING DASHBOARD ==========');
      
      await this.checkAuth();
      await this.registerPages();
      this.setupEventListeners();
      
      // CRITICAL: Update header stats before loading first page
      await this.updateHeaderStats();
      
      await router.init();
      
      this.isInitialized = true;
      
      console.log('[Dashboard] ========== INITIALIZATION COMPLETE ==========');
    } catch (error) {
      console.error('[Dashboard] Initialization failed:', error);
      
      if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
        this.handleAuthError();
        return;
      }
      
      notify('Failed to initialize dashboard: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async checkAuth() {
    try {
      this.currentUser = await AuthAPI.me();
      console.log('[Dashboard] User authenticated:', this.currentUser.username);
      console.log('[Dashboard] User data:', this.currentUser);
      
      this.updateUserDisplay();
    } catch (error) {
      console.error('[Dashboard] Authentication check failed:', error);
      throw new Error('Authentication required');
    }
  }

  updateUserDisplay() {
    console.log('[Dashboard] Updating user display...');
    
    // Update username in sidebar footer (displays username, NOT email)
    const userEmailEl = document.getElementById('userEmail');
    if (userEmailEl && this.currentUser) {
      // Display username field from API response
      userEmailEl.textContent = this.currentUser.username || 'User';
      console.log('[Dashboard] Set display name to:', this.currentUser.username);
    } else {
      console.warn('[Dashboard] userEmail element not found or no currentUser');
    }
    
    // Also support old ID for backwards compatibility
    const currentUserEl = document.getElementById('current-user');
    if (currentUserEl && this.currentUser) {
      currentUserEl.textContent = this.currentUser.username || 'User';
    }
    
    // Update avatar with first letter of username
    const avatarElement = document.getElementById('user-avatar');
    if (avatarElement && this.currentUser?.username) {
      // Clear existing content and set text
      avatarElement.innerHTML = '';
      avatarElement.textContent = this.currentUser.username.charAt(0).toUpperCase();
      console.log('[Dashboard] Set avatar to:', this.currentUser.username.charAt(0).toUpperCase());
    } else {
      console.warn('[Dashboard] user-avatar element not found or no username');
    }
  }

  /**
   * CRITICAL: Centralized header stats updater
   * This ensures CTL, ATL, TSB, and Fitness Charge are always synchronized
   * with the actual training load data from the API
   */
  async updateHeaderStats(force = false) {
    try {
      // Cache stats for 30 seconds to avoid excessive API calls
      const now = Date.now();
      if (!force && this.headerStatsCache && this.lastStatsUpdate && (now - this.lastStatsUpdate < 30000)) {
        console.log('[Dashboard] Using cached header stats');
        return this.headerStatsCache;
      }

      console.log('[Dashboard] Fetching training load for header stats...');
      
      // Fetch training load data (primary source of truth)
      const loadData = await API.getTrainingLoad().catch(err => {
        console.error('[Dashboard] Error fetching training load:', err);
        return null;
      });
      
      // Extract CTL, ATL, TSB from training load data
      let ctl = 0, atl = 0, tsb = 0;
      
      if (loadData) {
        // Try multiple data structures (backend may return different formats)
        if (loadData.current) {
          // Format 1: { current: { ctl, atl, tsb } }
          ctl = loadData.current.ctl || 0;
          atl = loadData.current.atl || 0;
          tsb = loadData.current.tsb || 0;
        } else if (loadData.history && loadData.history.length > 0) {
          // Format 2: { history: [{ ctl, atl, tsb, date }] }
          const latest = loadData.history[loadData.history.length - 1];
          ctl = latest.ctl || latest.CTL || 0;
          atl = latest.atl || latest.ATL || 0;
          tsb = latest.tsb || latest.TSB || 0;
        } else if (loadData.timeseries && loadData.timeseries.length > 0) {
          // Format 3: { timeseries: [{ ctl, atl, tsb }] }
          const latest = loadData.timeseries[loadData.timeseries.length - 1];
          ctl = latest.ctl || latest.CTL || 0;
          atl = latest.atl || latest.ATL || 0;
          tsb = latest.tsb || latest.TSB || 0;
        } else if (typeof loadData.ctl !== 'undefined') {
          // Format 4: Direct values { ctl, atl, tsb }
          ctl = loadData.ctl || 0;
          atl = loadData.atl || 0;
          tsb = loadData.tsb || 0;
        }
      }

      console.log('[Dashboard] Training load values - CTL:', ctl, 'ATL:', atl, 'TSB:', tsb);

      // Update CTL/ATL/TSB in header
      this.updateHeaderElement('stat-ctl', Math.round(ctl));
      this.updateHeaderElement('stat-atl', Math.round(atl));
      this.updateHeaderElement('stat-tsb', Math.round(tsb));
      
      // Calculate and update Fitness Charge
      const fitnessCharge = this.calculateFitnessCharge(ctl, atl, tsb);
      this.updateFitnessCharge(fitnessCharge);
      
      // Get recent activities for activity count and time
      const activities = await API.getActivities({ limit: 100 }).catch(err => {
        console.error('[Dashboard] Error fetching activities:', err);
        return [];
      });
      
      if (activities && activities.length > 0) {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        
        const recentActivities = activities.filter(a => {
          const activityDate = new Date(a.start_time || a.date);
          return activityDate >= oneWeekAgo;
        });
        
        const recentCount = recentActivities.length;
        this.updateHeaderElement('stat-activities', recentCount);
        
        // Calculate total time
        const totalSeconds = recentActivities.reduce((sum, a) => {
          return sum + (a.duration || a.elapsed_time || 0);
        }, 0);
        
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.round((totalSeconds % 3600) / 60);
        this.updateHeaderElement('stat-time', `${hours}h ${minutes}m`);
        
        console.log('[Dashboard] Recent activities (7d):', recentCount, 'Total time:', `${hours}h ${minutes}m`);
      } else {
        this.updateHeaderElement('stat-activities', 0);
        this.updateHeaderElement('stat-time', '0h 0m');
      }

      // Cache the results
      this.headerStatsCache = { ctl, atl, tsb, fitnessCharge };
      this.lastStatsUpdate = now;

      console.log('[Dashboard] Header stats updated successfully');
      return this.headerStatsCache;

    } catch (error) {
      console.error('[Dashboard] Error updating header stats:', error);
      
      // Gracefully degrade - show placeholders
      this.updateHeaderElement('stat-ctl', '--');
      this.updateHeaderElement('stat-atl', '--');
      this.updateHeaderElement('stat-tsb', '--');
      this.updateHeaderElement('stat-activities', '--');
      this.updateHeaderElement('stat-time', '--');
      this.updateFitnessCharge(0);
      
      return null;
    }
  }

  /**
   * Calculate Fitness Charge percentage (0-100)
   * Based on CTL (fitness) and TSB (form) relationship
   */
  calculateFitnessCharge(ctl, atl, tsb) {
    // If no fitness, return neutral 50%
    if (ctl === 0 && atl === 0) {
      return 50;
    }

    // Fitness Charge represents recovery status and training readiness
    // Formula combines both absolute fitness (CTL) and form (TSB)
    
    // Base charge from CTL (higher fitness = higher base charge)
    // CTL of 100 = 70% base charge
    const ctlComponent = Math.min(70, (ctl / 100) * 70);
    
    // TSB adjustment (form component)
    // Positive TSB = fresh (adds charge)
    // Negative TSB = fatigued (reduces charge)
    // TSB range typically -30 to +30
    const tsbNormalized = Math.max(-30, Math.min(30, tsb));
    const tsbComponent = (tsbNormalized / 30) * 30; // Maps -30 to +30 TSB to -30 to +30 charge
    
    // Combine components
    let charge = ctlComponent + 50 + (tsbComponent * 0.5);
    
    // Clamp to 0-100 range
    charge = Math.max(0, Math.min(100, charge));
    
    return Math.round(charge);
  }

  /**
   * Update Fitness Charge UI with progress bar and percentage
   */
  updateFitnessCharge(percentage) {
    const chargeValue = document.getElementById('fitness-charge');
    const chargeFill = document.getElementById('fitness-fill');

    if (chargeValue) {
      chargeValue.textContent = `${percentage}%`;
    }

    if (chargeFill) {
      chargeFill.style.width = `${percentage}%`;
      
      // Update color class based on charge level
      chargeFill.className = 'charge-fill';
      
      if (percentage >= 60) {
        // High charge - recovered/fresh (keep default green gradient)
        // No additional class needed
      } else if (percentage >= 30) {
        // Medium charge - building fitness (purple gradient)
        chargeFill.classList.add('medium');
      } else {
        // Low charge - fatigued (red gradient)
        chargeFill.classList.add('low');
      }
    }

    console.log('[Dashboard] Fitness charge set to:', percentage + '%');
  }

  /**
   * Helper to safely update header stat elements
   */
  updateHeaderElement(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    } else {
      console.warn(`[Dashboard] Element not found: ${id}`);
    }
  }

  async registerPages() {
    console.log('[Dashboard] Registering pages...');
    
    for (const [pageKey, definition] of Object.entries(PAGE_DEFINITIONS)) {
      const modulePath = definition.path;
      
      if (!modulePath) {
        console.info(`[Dashboard] Placeholder registered for ${pageKey}`);
        router.registerPage(pageKey, this.createPlaceholderPage(pageKey));
        continue;
      }
      
      try {
        const module = await import(modulePath);
        const pageModule = this.resolvePageModule(pageKey, module);
        
        if (!pageModule || typeof pageModule.load !== 'function') {
          throw new Error('No load() method found on module export');
        }
        
        router.registerPage(pageKey, pageModule);
        console.log(`[Dashboard] Registered page module: ${pageKey}`);
      } catch (error) {
        console.warn(`[Dashboard] Using placeholder for ${pageKey}: ${error.message}`);
        router.registerPage(pageKey, this.createPlaceholderPage(pageKey));
      }
    }
    
    console.log('[Dashboard] Page registration complete');
  }

  resolvePageModule(pageKey, module) {
    if (!module) return null;
    if (module.default && typeof module.default.load === 'function') {
      return module.default;
    }
    
    const candidates = [
      this.toCamel(pageKey) + 'Page',
      this.toPascal(pageKey) + 'Page',
      'page'
    ];
    
    for (const name of candidates) {
      if (module[name] && typeof module[name].load === 'function') {
        return module[name];
      }
    }
    
    return null;
  }

  toCamel(pageKey) {
    return pageKey.replace(/[-_](\w)/g, (_, char) => char.toUpperCase());
  }

  toPascal(pageKey) {
    const camel = this.toCamel(pageKey);
    return camel.charAt(0).toUpperCase() + camel.slice(1);
  }

  formatPageTitle(pageKey) {
    return pageKey
      .replace(/[-_]/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  createPlaceholderPage(pageKey) {
    const title = this.formatPageTitle(pageKey);
    
    return {
      async load() {
        const container = document.getElementById('pageContent') || document.getElementById('page-content');
        if (!container) return;
        
        container.innerHTML = `
          <section style="
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 320px;
            padding: 48px 16px;
          ">
            <div style="
              max-width: 420px;
              text-align: center;
              background: #ffffff;
              border: 1px solid rgba(148, 163, 184, 0.35);
              border-radius: 16px;
              padding: 40px 32px;
              box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08);
            ">
              <div style="
                width: 64px;
                height: 64px;
                margin: 0 auto 16px;
                border-radius: 50%;
                background: rgba(59, 130, 246, 0.12);
                display: flex;
                align-items: center;
                justify-content: center;
                color: #2563eb;
              ">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="28" height="28">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <h1 style="
                font-size: 1.5rem;
                font-weight: 700;
                margin-bottom: 12px;
                color: #0f172a;
              ">${title}</h1>
              <p style="
                font-size: 0.95rem;
                color: #475569;
                line-height: 1.6;
              ">${FALLBACK_MESSAGE}</p>
            </div>
          </section>
        `;
      }
    };
  }

  setupEventListeners() {
    console.log('[Dashboard] Setting up event listeners...');
    
    // Logout button - support multiple IDs
    const logoutBtns = [
      document.getElementById('logout-btn'),
      document.getElementById('logoutBtn')
    ].filter(Boolean);
    
    console.log('[Dashboard] Found', logoutBtns.length, 'logout buttons');
    
    logoutBtns.forEach((btn, index) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log(`[Dashboard] Logout button ${index + 1} clicked`);
        this.logout();
      });
      console.log(`[Dashboard] Logout listener attached to button ${index + 1}`);
    });
    
    // Refresh buttons
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.refreshCurrentPage());
    }
    
    const headerRefreshBtn = document.getElementById('header-refresh-btn');
    if (headerRefreshBtn) {
      headerRefreshBtn.addEventListener('click', () => this.refreshCurrentPage());
    }
    
    // Navigation handling - support both clicks and hash changes
    document.addEventListener('click', (e) => {
      const navItem = e.target.closest('.nav-item');
      if (navItem) {
        e.preventDefault();
        const page = navItem.dataset.page;
        if (page) {
          router.navigateTo(page);
        }
      }
    });
  }

  async refreshCurrentPage() {
    if (!this.isInitialized) return;
    
    try {
      setLoading(true);
      
      // CRITICAL: Force refresh header stats (bypass cache)
      await this.updateHeaderStats(true);
      
      // Refresh current page
      const currentPageModule = router.pages.get(router.currentPage);
      
      if (currentPageModule && typeof currentPageModule.refresh === 'function') {
        console.log(`[Dashboard] Refreshing page: ${router.currentPage}`);
        await currentPageModule.refresh();
        notify('Data refreshed', 'success');
      } else {
        console.log(`[Dashboard] Page ${router.currentPage} doesn't support refresh`);
        notify('Data refreshed', 'success');
      }
    } catch (error) {
      console.error('[Dashboard] Refresh failed:', error);
      notify('Refresh failed: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  /**
   * Public method for pages to trigger header stats update
   * Call this after data changes (e.g., after uploading files)
   */
  async forceUpdateHeaderStats() {
    console.log('[Dashboard] Force updating header stats...');
    return await this.updateHeaderStats(true);
  }

  /**
   * CRITICAL: FIXED LOGOUT METHOD WITH COMPREHENSIVE LOGGING
   * Handles all edge cases and works even if backend endpoint is missing
   */
  async logout() {
    console.log('[Dashboard] ========================================');
    console.log('[Dashboard] ========== LOGOUT STARTED ==========');
    console.log('[Dashboard] ========================================');
    
    try {
      // Clear intervals
      if (this.refreshInterval) {
        clearInterval(this.refreshInterval);
        this.refreshInterval = null;
        console.log('[Dashboard] ✓ Refresh interval cleared');
      }
      
      // Try to call backend logout endpoint (optional - may not be implemented)
      try {
        console.log('[Dashboard] Attempting backend logout...');
        await AuthAPI.logout();
        console.log('[Dashboard] ✓ Backend logout endpoint called successfully');
      } catch (e) {
        console.warn('[Dashboard] ⚠ Backend logout endpoint not available or failed (this is OK):', e.message);
      }
      
      // Clear all authentication data from localStorage
      const tokenKeys = [
        TOKEN_STORAGE_KEY,
        'auth_token',
        'token',
        'access_token',
        'jwt',
        'authToken',
        'bearerToken'
      ];
      
      console.log('[Dashboard] Clearing localStorage tokens...');
      let tokensCleared = 0;
      tokenKeys.forEach(key => {
        if (localStorage.getItem(key)) {
          localStorage.removeItem(key);
          console.log(`[Dashboard] ✓ Removed: ${key}`);
          tokensCleared++;
        }
      });
      console.log(`[Dashboard] Total tokens cleared: ${tokensCleared}`);
      
      // Clear user data
      console.log('[Dashboard] Clearing user data...');
      const userDataKeys = ['user', 'currentUser', 'userData'];
      userDataKeys.forEach(key => {
        if (localStorage.getItem(key)) {
          localStorage.removeItem(key);
          console.log(`[Dashboard] ✓ Removed: ${key}`);
        }
      });
      
      // Clear sessionStorage
      console.log('[Dashboard] Clearing sessionStorage...');
      const sessionBefore = sessionStorage.length;
      sessionStorage.clear();
      console.log(`[Dashboard] ✓ SessionStorage cleared (had ${sessionBefore} items)`);
      
      // Reset dashboard state
      this.currentUser = null;
      this.isInitialized = false;
      this.headerStatsCache = null;
      this.lastStatsUpdate = null;
      console.log('[Dashboard] ✓ Dashboard state reset');
      
      console.log('[Dashboard] ========================================');
      console.log('[Dashboard] All authentication data cleared successfully');
      console.log('[Dashboard] Redirecting to login page in 100ms...');
      console.log('[Dashboard] ========================================');
      
      // Small delay to ensure all console logs are visible
      setTimeout(() => {
        console.log('[Dashboard] ➡ Redirecting NOW to /index.html');
        window.location.href = '/index.html';
      }, 100);
      
    } catch (error) {
      console.error('[Dashboard] ========================================');
      console.error('[Dashboard] ❌ LOGOUT ERROR:', error);
      console.error('[Dashboard] ========================================');
      
      // Emergency fallback - nuclear option
      console.log('[Dashboard] 🚨 Emergency logout - clearing ALL storage');
      try {
        localStorage.clear();
        sessionStorage.clear();
        console.log('[Dashboard] ✓ All storage cleared');
      } catch (clearError) {
        console.error('[Dashboard] ❌ Could not clear storage:', clearError);
      }
      
      // Force redirect regardless
      console.log('[Dashboard] ➡ Force redirecting to /index.html');
      setTimeout(() => {
        window.location.href = '/index.html';
      }, 100);
    }
  }

  /**
   * FIXED HANDLE AUTH ERROR
   * Clears all auth data and redirects to login
   */
  handleAuthError() {
    console.log('[Dashboard] ========================================');
    console.log('[Dashboard] ========== AUTH ERROR HANDLER ==========');
    console.log('[Dashboard] ========================================');
    console.log('[Dashboard] Handling authentication error - clearing all data');
    
    // Clear all possible token storage
    const tokenKeys = [
      TOKEN_STORAGE_KEY,
      'auth_token',
      'token',
      'access_token',
      'jwt',
      'authToken'
    ];
    
    tokenKeys.forEach(key => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });
    
    // Clear user data
    localStorage.removeItem('user');
    localStorage.removeItem('currentUser');
    sessionStorage.clear();
    
    console.log('[Dashboard] ✓ Auth data cleared');
    console.log('[Dashboard] ➡ Redirecting to login');
    
    // Redirect to login
    window.location.href = '/index.html';
  }

  // Public methods for debugging
  getCurrentUser() {
    return this.currentUser;
  }

  getRouter() {
    return router;
  }

  getHeaderStats() {
    return this.headerStatsCache;
  }

  async testAPI() {
    console.log('[Dashboard] Testing API endpoints...');
    
    try {
      const results = {
        activities: await API.getActivities({ limit: 5 }).catch(e => ({ error: e.message })),
        settings: await API.getSettings().catch(e => ({ error: e.message })),
        trainingLoad: await API.getTrainingLoad().catch(e => ({ error: e.message })),
        powerCurve: await AnalysisAPI.getPowerCurve({ weighted: false }).catch(e => ({ error: e.message })),
        vo2max: await AnalysisAPI.getVO2Max().catch(e => ({ error: e.message })),
        hrZones: await AnalysisAPI.getHeartRateZones({ days: 90 }).catch(e => ({ error: e.message })),
      };
      
      console.log('[Dashboard] API Test Results:', results);
      return results;
    } catch (error) {
      console.error('[Dashboard] API test failed:', error);
      return { error: error.message };
    }
  }
}

// Initialize dashboard when DOM is ready
let dashboardInstance = null;

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Dashboard] ========================================');
  console.log('[Dashboard] DOM LOADED - STARTING INITIALIZATION');
  console.log('[Dashboard] ========================================');
  
  dashboardInstance = new Dashboard();
  await dashboardInstance.init();
  
  // Make available globally for debugging and page access
  window.dashboard = dashboardInstance;
  window.API = API;
  window.AnalysisAPI = AnalysisAPI;
  
  console.log('[Dashboard] ========================================');
  console.log('[Dashboard] Debug helpers available:');
  console.log('  - window.dashboard (Dashboard instance)');
  console.log('  - window.dashboard.logout() - Force logout');
  console.log('  - window.dashboard.getCurrentUser() - Get user');
  console.log('  - window.dashboard.forceUpdateHeaderStats() - Refresh stats');
  console.log('  - window.dashboard.testAPI() - Test all endpoints');
  console.log('  - window.API (API client)');
  console.log('  - window.AnalysisAPI (Analysis API client)');
  console.log('[Dashboard] Services loaded:', Services);
  console.log('[Dashboard] window.Services available:', !!window.Services);
  console.log('[Dashboard] ========================================');
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && dashboardInstance?.isInitialized) {
    console.log('[Dashboard] Page became visible');
    // Optional: Refresh data when page becomes visible
    // dashboardInstance.forceUpdateHeaderStats();
  }
});

export default Dashboard;