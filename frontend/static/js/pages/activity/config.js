// ============================================
// FILE: pages/activity/config.js
// Activity Detail Page Configuration
// ============================================

const CONFIG = {
  PAGE_NAME: 'Activity Detail',
  CACHE_KEY: 'activity',

  // Chart colors
  COLORS: {
    primary: '#3b82f6',
    secondary: '#8b5cf6',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    gray: '#6b7280'
  },

  // Power zone colors (matching zones page)
  POWER_ZONE_COLORS: {
    'Z1': '#10b981',
    'Z2': '#3b82f6',
    'Z3': '#f59e0b',
    'Z4': '#ef4444',
    'Z5': '#dc2626',
    'Z6': '#991b1b',
    'Z7': '#7f1d1d'
  },

  // HR zone colors (matching hr-zones page)
  HR_ZONE_COLORS: {
    'Z1': '#10b981',
    'Z2': '#3b82f6',
    'Z3': '#f59e0b',
    'Z4': '#ef4444',
    'Z5': '#dc2626'
  },

  // Duration labels for best efforts
  DURATION_LABELS: {
    'max_5sec_power': '5s',
    'max_1min_power': '1m',
    'max_3min_power': '3m',
    'max_5min_power': '5m',
    'max_10min_power': '10m',
    'max_20min_power': '20m',
    'max_30min_power': '30m',
    'max_60min_power': '60m'
  }
};

export default CONFIG;
