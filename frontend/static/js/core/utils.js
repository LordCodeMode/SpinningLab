// ============================================
// FILE: static/js/core/utils.js
// UPDATED: Integrated with config.js and eventBus.js
// ============================================

import CONFIG from './config.js';
import { eventBus, EVENTS } from './eventBus.js';

/**
 * Display a notification message
 * @param {string} message - Message to display
 * @param {string} type - Type: 'info', 'success', 'error', 'warning'
 * @param {number} duration - Duration in milliseconds
 */
export function notify(message, type = 'info', duration = CONFIG.NOTIFICATION_DURATION) {
  const notification = document.getElementById('notification');
  if (!notification) {
    console.warn('[Utils] Notification element not found');
    return;
  }

  notification.innerHTML = `
      <span class="notification-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'}</span>
      <span class="notification-message">${message}</span>
  `;
  
  notification.className = `notification ${type} show`;
  
  setTimeout(() => {
      notification.classList.remove('show');
  }, duration);
  
  // Emit event
  eventBus.emit(EVENTS.NOTIFICATION, { message, type, duration });
}

/**
 * Show or hide loading overlay
 * @param {boolean} isLoading - Whether to show loading
 */
export function setLoading(isLoading) {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
      overlay.style.display = isLoading ? 'flex' : 'none';
  }
  
  // Emit event
  if (isLoading) {
    eventBus.emit(EVENTS.LOADING_START);
  } else {
    eventBus.emit(EVENTS.LOADING_END);
  }
}

/**
 * Format seconds into human-readable duration
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration
 */
export function formatDuration(seconds) {
  if (!seconds || seconds < 0) return '--';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
      return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
  } else if (minutes > 0) {
      return `${minutes}m ${secs.toString().padStart(2, '0')}s`;
  } else {
      return `${secs}s`;
  }
}

/**
 * Format date string into readable format
 * @param {string|Date} dateString - Date to format
 * @returns {string} Formatted date
 */
export function formatDate(dateString) {
  if (!dateString) return '--';
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '--';
  
  return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
  });
}

/**
 * Format date with time
 * @param {string|Date} dateString - Date to format
 * @returns {string} Formatted date with time
 */
export function formatDateTime(dateString) {
  if (!dateString) return '--';
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '--';
  
  return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
  });
}

/**
 * Format power value with unit
 * @param {number} watts - Power in watts
 * @returns {string} Formatted power
 */
export function formatPower(watts) {
  if (!watts || watts < 0) return '--';
  return `${Math.round(watts)} W`;
}

/**
 * Format distance (meters to km)
 * @param {number} meters - Distance in meters
 * @returns {string} Formatted distance
 */
export function formatDistance(meters) {
  if (!meters || meters < 0) return '--';
  
  const km = meters / 1000;
  return `${km.toFixed(1)} km`;
}

/**
 * Format speed (m/s to km/h)
 * @param {number} metersPerSecond - Speed in m/s
 * @returns {string} Formatted speed
 */
export function formatSpeed(metersPerSecond) {
  if (!metersPerSecond || metersPerSecond < 0) return '--';
  
  const kmh = metersPerSecond * 3.6;
  return `${kmh.toFixed(1)} km/h`;
}

/**
 * Format heart rate
 * @param {number} bpm - Heart rate in BPM
 * @returns {string} Formatted heart rate
 */
export function formatHeartRate(bpm) {
  if (!bpm || bpm < 0) return '--';
  return `${Math.round(bpm)} bpm`;
}

/**
 * Format cadence
 * @param {number} rpm - Cadence in RPM
 * @returns {string} Formatted cadence
 */
export function formatCadence(rpm) {
  if (!rpm || rpm < 0) return '--';
  return `${Math.round(rpm)} rpm`;
}

/**
 * Format percentage
 * @param {number} value - Percentage value
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted percentage
 */
export function formatPercentage(value, decimals = 0) {
  if (value === null || value === undefined || isNaN(value)) return '--';
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format number with commas
 * @param {number} value - Number to format
 * @returns {string} Formatted number
 */
export function formatNumber(value) {
  if (value === null || value === undefined || isNaN(value)) return '--';
  return value.toLocaleString('en-US');
}

/**
 * Debounce function execution
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in ms
 * @returns {Function} Debounced function
 */
export function debounce(func, wait = CONFIG.LOADING_DEBOUNCE) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function execution
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in ms
 * @returns {Function} Throttled function
 */
export function throttle(func, limit = CONFIG.LOADING_DEBOUNCE) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Sleep/delay function
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} Promise that resolves after delay
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Clone object deeply
 * @param {Object} obj - Object to clone
 * @returns {Object} Cloned object
 */
export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Check if value is empty
 * @param {*} value - Value to check
 * @returns {boolean} Whether value is empty
 */
export function isEmpty(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

/**
 * Get relative time string (e.g., "2 days ago")
 * @param {string|Date} dateString - Date to compare
 * @returns {string} Relative time string
 */
export function getRelativeTime(dateString) {
  if (!dateString) return '--';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;
  return formatDate(dateString);
}

/**
 * Calculate TSB status description
 * @param {number} tsb - Training Stress Balance
 * @returns {Object} Status object with description and color
 */
export function getTSBStatus(tsb) {
  const thresholds = CONFIG.TSB_THRESHOLDS;
  
  if (tsb >= thresholds.veryFresh) {
    return { status: 'Very Fresh', color: CONFIG.CHART_COLORS.success, description: 'Well recovered, ready for hard training' };
  } else if (tsb >= thresholds.fresh) {
    return { status: 'Fresh', color: CONFIG.CHART_COLORS.info, description: 'Good recovery, maintain intensity' };
  } else if (tsb >= thresholds.neutral) {
    return { status: 'Neutral', color: CONFIG.CHART_COLORS.primary, description: 'Balanced training state' };
  } else if (tsb >= thresholds.fatigued) {
    return { status: 'Fatigued', color: CONFIG.CHART_COLORS.warning, description: 'Some fatigue, consider easier training' };
  } else {
    return { status: 'Very Fatigued', color: CONFIG.CHART_COLORS.danger, description: 'Significant fatigue, prioritize recovery' };
  }
}

// Export all utilities as default object
export default {
  notify,
  setLoading,
  formatDuration,
  formatDate,
  formatDateTime,
  formatPower,
  formatDistance,
  formatSpeed,
  formatHeartRate,
  formatCadence,
  formatPercentage,
  formatNumber,
  debounce,
  throttle,
  sleep,
  deepClone,
  isEmpty,
  getRelativeTime,
  getTSBStatus
};