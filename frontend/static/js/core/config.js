// ============================================
// FILE: static/js/core/config.js
// Centralized application configuration
// ============================================

const CONFIG = {
  // API Configuration
  API_BASE_URL: window.APP_CONFIG?.API_BASE_URL || 'http://localhost:8000',
  TOKEN_STORAGE_KEY: window.APP_CONFIG?.TOKEN_STORAGE_KEY || 'training_dashboard_token',
  DISPLAY_NAME_STORAGE_KEY: 'training_dashboard_display_name',
  
  // Upload Configuration
  UPLOAD_MAX_SIZE: 50 * 1024 * 1024, // 50MB
  UPLOAD_MAX_FILES: 10,
  SUPPORTED_FORMATS: ['.fit'],
  CHUNK_SIZE: 2 * 1024 * 1024, // 2MB chunks for large uploads
  
  // UI Configuration
  NOTIFICATION_DURATION: 4000, // 4 seconds
  LOADING_DEBOUNCE: 300, // 300ms
  AUTO_REFRESH_INTERVAL: 5 * 60 * 1000, // 5 minutes
  
  // Chart Configuration
  CHART_COLORS: {
    primary: '#3b82f6',
    secondary: '#6366f1',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#06b6d4',
    
    // Power zones
    z1: '#c7f6c1',
    z2: '#9ce4a5',
    z3: '#ffe285',
    z4: '#fab57e',
    z5: '#f1998e',
    z6: '#d67777',
    z7: '#c9a0db',
    
    // Gradients
    gradientPower: ['#1f6feb', '#4dabf7'],
    gradientHR: ['#da3633', '#ff6b6b'],
    gradientLoad: ['#8250df', '#a855f7'],
  },
  
  // Power Zones (relative to FTP)
  POWER_ZONES: [
    { name: 'Z1 (Recovery)', min: 0.0, max: 0.55, color: '#c7f6c1' },
    { name: 'Z2 (Endurance)', min: 0.55, max: 0.75, color: '#9ce4a5' },
    { name: 'Z3 (Tempo)', min: 0.75, max: 0.90, color: '#ffe285' },
    { name: 'Z4 (Threshold)', min: 0.90, max: 1.05, color: '#fab57e' },
    { name: 'Z5 (VO2max)', min: 1.05, max: 1.20, color: '#f1998e' },
    { name: 'Z6 (Anaerobic)', min: 1.20, max: 1.50, color: '#d67777' },
    { name: 'Z7 (Sprint)', min: 1.50, max: 10.0, color: '#c9a0db' }
  ],
  
  // Heart Rate Zones (relative to HR Max)
  HR_ZONES: [
    { name: 'Z1 (Recovery)', min: 0.0, max: 0.60, color: '#c7f6c1' },
    { name: 'Z2 (Endurance)', min: 0.60, max: 0.70, color: '#9ce4a5' },
    { name: 'Z3 (Tempo)', min: 0.70, max: 0.80, color: '#ffe285' },
    { name: 'Z4 (Threshold)', min: 0.80, max: 0.90, color: '#fab57e' },
    { name: 'Z5 (Max)', min: 0.90, max: 1.0, color: '#ef4444' }
  ],
  
  // Training Load Thresholds
  TSB_THRESHOLDS: {
    veryFresh: 25,
    fresh: 10,
    neutral: -10,
    fatigued: -20,
    veryFatigued: -30
  },
  
  // Pagination
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  
  // Cache Settings
  CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
  STATS_CACHE_DURATION: 2 * 60 * 1000, // 2 minutes
  
  // Date Ranges
  DEFAULT_DAYS: {
    trainingLoad: 90,
    powerCurve: 365,
    efficiency: 120,
    hrZones: 90,
    vo2max: 180
  },
  
  // Feature Flags
  FEATURES: {
    autoRefresh: false,
    debugMode: false,
    experimentalCharts: false,
    advancedAnalytics: true
  },
  
  // Regex Patterns
  PATTERNS: {
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    username: /^[a-zA-Z0-9_-]{3,20}$/
  }
};

// Make config immutable
Object.freeze(CONFIG);
Object.freeze(CONFIG.CHART_COLORS);
Object.freeze(CONFIG.POWER_ZONES);
Object.freeze(CONFIG.HR_ZONES);
Object.freeze(CONFIG.TSB_THRESHOLDS);
Object.freeze(CONFIG.DEFAULT_DAYS);
Object.freeze(CONFIG.FEATURES);
Object.freeze(CONFIG.PATTERNS);

// Export as default
export default CONFIG;

// Also export specific sections if needed
export const { 
  API_BASE_URL, 
  TOKEN_STORAGE_KEY,
  DISPLAY_NAME_STORAGE_KEY,
  CHART_COLORS,
  POWER_ZONES,
  HR_ZONES,
  TSB_THRESHOLDS
} = CONFIG;
