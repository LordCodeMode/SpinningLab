// ============================================
// FILE: static/js/services/DataService.js
// API calls with caching and data transformation
// ============================================

import { API, AnalysisAPI } from '../core/api.js';
import { CacheService } from './CacheService.js';
import { eventBus, EVENTS } from '../core/eventBus.js';
import CONFIG from '../core/config.js';

class DataService {
  constructor() {
    this.cache = new CacheService();
    this.setupEventListeners();
  }

  /**
   * Setup event listeners for cache management
   */
  setupEventListeners() {
    // Clear frontend cache when data is imported
    eventBus.on(EVENTS.DATA_IMPORTED, () => {
      this.clearAllCaches();
      console.log('[DataService] Frontend cache cleared due to data import');
    });
  }

  // ========== CACHE MANAGEMENT ==========
  
  /**
   * Clear all analysis caches
   * Called after data import to ensure fresh data is fetched
   */
  clearAllCaches() {
    const patterns = [
      'training_load*',
      'power_curve*',
      'critical_power*',
      'efficiency*',
      'power_zones*',
      'hr_zones*',
      'fitness_state*',
      'vo2max*',
      'best_power*',
      'rider_profile*',
      'zone_balance*',
      'activity_summary*',
      'activities*',
      'user_settings'
    ];
    
    patterns.forEach(pattern => this.cache.clearPattern(pattern));
    console.log('[DataService] All analysis caches cleared');
    
    // Emit event for other components
    eventBus.emit(EVENTS.CACHE_CLEAR);
  }

  /**
   * Clear specific cache pattern
   */
  clearCache(keyPattern) {
    this.cache.clearPattern(`${keyPattern}*`);
    console.log(`[DataService] Cleared cache for: ${keyPattern}`);
  }

  /**
   * Trigger backend cache rebuild manually
   */
  async rebuildBackendCache() {
    try {
      console.log('[DataService] Triggering backend cache rebuild...');
      const result = await API.rebuildCache();
      
      // Clear frontend cache too
      this.clearAllCaches();
      
      return result;
    } catch (error) {
      console.error('[DataService] Failed to trigger cache rebuild:', error);
      throw error;
    }
  }

  /**
   * Prefetch commonly used data to warm the cache
   * Called after cache rebuild or on app initialization
   */
  async prefetchCommonData() {
    console.log('[DataService] Prefetching common data...');
    
    try {
      // Prefetch in parallel (non-blocking)
      const prefetchPromises = [
        this.getTrainingLoad({ days: 90 }).catch(e => console.warn('Prefetch training load failed:', e)),
        this.getPowerCurve({ weighted: false }).catch(e => console.warn('Prefetch power curve failed:', e)),
        this.getFitnessState().catch(e => console.warn('Prefetch fitness state failed:', e)),
        this.getSettings().catch(e => console.warn('Prefetch settings failed:', e))
      ];
      
      await Promise.allSettled(prefetchPromises);
      console.log('[DataService] Prefetch completed');
      
    } catch (error) {
      console.error('[DataService] Prefetch failed:', error);
    }
  }

  /**
   * Check cache status from backend
   */
  async getCacheStatus() {
    try {
      const response = await API.getCacheStatus();
      console.log('[DataService] Cache status:', response);
      return response;
    } catch (error) {
      console.error('[DataService] Failed to get cache status:', error);
      throw error;
    }
  }

  // ========== TRAINING LOAD ==========
  
  /**
   * Get training load data with caching
   * @param {Object} options - Query options
   * @param {number} options.days - Number of days (default: 90)
   * @param {boolean} options.forceRefresh - Skip cache
   * @returns {Promise<Object>} Training load data
   */
  async getTrainingLoad({ days = CONFIG.DEFAULT_DAYS.trainingLoad, forceRefresh = false } = {}) {
    const cacheKey = `training_load_${days}`;
    
    if (!forceRefresh) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        console.log('[DataService] Using cached training load');
        return cached;
      }
    }
    
    try {
      console.log(`[DataService] Fetching training load (${days} days)...`);
      const data = await AnalysisAPI.getTrainingLoad({ days });
      
      // Cache the result
      this.cache.set(cacheKey, data, CONFIG.CACHE_DURATION);
      
      return data;
    } catch (error) {
      console.error('[DataService] Error fetching training load:', error);
      throw error;
    }
  }

  // ========== POWER CURVE ==========
  
  /**
   * Get power curve data with caching
   * @param {Object} options - Query options
   * @param {boolean} options.weighted - Return watts/kg instead of absolute
   * @param {string} options.start - Start date (YYYY-MM-DD)
   * @param {string} options.end - End date (YYYY-MM-DD)
   * @param {boolean} options.forceRefresh - Skip cache
   * @returns {Promise<Object>} Power curve data
   */
  async getPowerCurve({ weighted = false, start = null, end = null, forceRefresh = false } = {}) {
    // Build cache key including date range
    let cacheKey = `power_curve_${weighted ? 'weighted' : 'absolute'}`;
    if (start && end) {
      cacheKey += `_${start}_${end}`;
    }
    
    if (!forceRefresh) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        console.log('[DataService] Using cached power curve');
        return cached;
      }
    }
    
    try {
      console.log(`[DataService] Fetching power curve (weighted: ${weighted})...`);
      
      const params = { weighted };
      if (start && end) {
        params.start = start;
        params.end = end;
      }
      
      const data = await AnalysisAPI.getPowerCurve(params);
      
      // Cache the result
      this.cache.set(cacheKey, data, CONFIG.CACHE_DURATION);
      
      return data;
    } catch (error) {
      console.error('[DataService] Error fetching power curve:', error);
      throw error;
    }
  }

  // ========== CRITICAL POWER ==========
  
  /**
   * Get critical power data with caching
   * @param {Object} options - Query options
   * @param {boolean} options.forceRefresh - Skip cache
   * @returns {Promise<Object>} Critical power data
   */
  async getCriticalPower({ forceRefresh = false } = {}) {
    const cacheKey = 'critical_power';
    
    if (!forceRefresh) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        console.log('[DataService] Using cached critical power');
        return cached;
      }
    }
    
    try {
      console.log('[DataService] Fetching critical power...');
      const data = await AnalysisAPI.getCriticalPower();
      
      // Cache the result
      this.cache.set(cacheKey, data, CONFIG.CACHE_DURATION);
      
      return data;
    } catch (error) {
      console.error('[DataService] Error fetching critical power:', error);
      throw error;
    }
  }

  // ========== EFFICIENCY ==========
  
  /**
   * Get efficiency analysis data with caching
   * @param {Object} options - Query options
   * @param {number} options.days - Number of days (default: 120)
   * @param {boolean} options.forceRefresh - Skip cache
   * @returns {Promise<Object>} Efficiency data
   */
  async getEfficiency({ days = CONFIG.DEFAULT_DAYS.efficiency, forceRefresh = false } = {}) {
    const cacheKey = `efficiency_${days}`;
    
    if (!forceRefresh) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        console.log('[DataService] Using cached efficiency');
        return cached;
      }
    }
    
    try {
      console.log(`[DataService] Fetching efficiency (${days} days)...`);
      const data = await AnalysisAPI.getEfficiency({ days });
      
      // Cache the result
      this.cache.set(cacheKey, data, CONFIG.CACHE_DURATION);
      
      return data;
    } catch (error) {
      console.error('[DataService] Error fetching efficiency:', error);
      throw error;
    }
  }

  // ========== FITNESS STATE ==========
  
  /**
   * Get fitness state analysis with caching
   * @param {Object} options - Query options
   * @param {boolean} options.forceRefresh - Skip cache
   * @returns {Promise<Object>} Fitness state data
   */
  async getFitnessState({ forceRefresh = false } = {}) {
    const cacheKey = 'fitness_state';
    
    if (!forceRefresh) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        console.log('[DataService] Using cached fitness state');
        return cached;
      }
    }
    
    try {
      console.log('[DataService] Fetching fitness state...');
      const data = await AnalysisAPI.getFitnessState();
      
      // Cache the result (shorter duration for dynamic data)
      this.cache.set(cacheKey, data, CONFIG.STATS_CACHE_DURATION);
      
      return data;
    } catch (error) {
      console.error('[DataService] Error fetching fitness state:', error);
      throw error;
    }
  }

  // ========== ZONE BALANCE ==========
  
  /**
   * Get zone balance analysis with caching
   * @param {Object} options - Query options
   * @param {string} options.model - Training model (polarized, pyramidal, threshold)
   * @param {number} options.weeks - Number of weeks to analyze
   * @param {boolean} options.forceRefresh - Skip cache
   * @returns {Promise<Object>} Zone balance data
   */
  async getZoneBalance({ model = 'polarized', weeks = 4, forceRefresh = false } = {}) {
    const cacheKey = `zone_balance_${model}_${weeks}`;
    
    if (!forceRefresh) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        console.log('[DataService] Using cached zone balance');
        return cached;
      }
    }
    
    try {
      console.log(`[DataService] Fetching zone balance (${model}, ${weeks} weeks)...`);
      const data = await AnalysisAPI.getZoneBalance({ model, weeks });
      
      // Cache the result
      this.cache.set(cacheKey, data, CONFIG.CACHE_DURATION);
      
      return data;
    } catch (error) {
      console.error('[DataService] Error fetching zone balance:', error);
      throw error;
    }
  }

  // ========== POWER ZONES ==========
  
  /**
   * Get power zones distribution with caching
   * @param {Object} options - Query options
   * @param {number} options.days - Number of days (default: 90)
   * @param {boolean} options.forceRefresh - Skip cache
   * @returns {Promise<Object>} Power zones data
   */
  async getPowerZones({ days = CONFIG.DEFAULT_DAYS.trainingLoad, forceRefresh = false } = {}) {
    const cacheKey = `power_zones_${days}`;
    
    if (!forceRefresh) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        console.log('[DataService] Using cached power zones');
        return cached;
      }
    }
    
    try {
      console.log(`[DataService] Fetching power zones (${days} days)...`);
      const data = await AnalysisAPI.getPowerZones({ days });
      
      // Cache the result
      this.cache.set(cacheKey, data, CONFIG.CACHE_DURATION);
      
      return data;
    } catch (error) {
      console.error('[DataService] Error fetching power zones:', error);
      throw error;
    }
  }

  // ========== HEART RATE ZONES ==========
  
  /**
   * Get HR zones distribution with caching
   * @param {Object} options - Query options
   * @param {number} options.days - Number of days (default: 90)
   * @param {boolean} options.forceRefresh - Skip cache
   * @returns {Promise<Object>} HR zones data
   */
  async getHRZones({ days = CONFIG.DEFAULT_DAYS.hrZones, forceRefresh = false } = {}) {
    const cacheKey = `hr_zones_${days}`;
    
    if (!forceRefresh) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        console.log('[DataService] Using cached HR zones');
        return cached;
      }
    }
    
    try {
      console.log(`[DataService] Fetching HR zones (${days} days)...`);
      const data = await AnalysisAPI.getHRZones({ days });
      
      // Cache the result
      this.cache.set(cacheKey, data, CONFIG.CACHE_DURATION);
      
      return data;
    } catch (error) {
      console.error('[DataService] Error fetching HR zones:', error);
      throw error;
    }
  }

  // ========== BEST POWER VALUES ==========
  
  /**
   * Get best power values with caching
   * @param {Object} options - Query options
   * @param {boolean} options.forceRefresh - Skip cache
   * @returns {Promise<Object>} Best power values
   */
  async getBestPowerValues({ forceRefresh = false } = {}) {
    const cacheKey = 'best_power_values';
    
    if (!forceRefresh) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        console.log('[DataService] Using cached best power values');
        return cached;
      }
    }
    
    try {
      console.log('[DataService] Fetching best power values...');
      const data = await AnalysisAPI.getBestPowerValues();
      
      // Cache the result
      this.cache.set(cacheKey, data, CONFIG.CACHE_DURATION);
      
      return data;
    } catch (error) {
      console.error('[DataService] Error fetching best power values:', error);
      throw error;
    }
  }

  // ========== VO2MAX ==========
  
  /**
   * Get VO2Max estimation with caching
   * @param {Object} options - Query options
   * @param {number} options.days - Number of days to analyze
   * @param {boolean} options.forceRefresh - Skip cache
   * @returns {Promise<Object>} VO2Max data
   */
  async getVO2Max({ days = CONFIG.DEFAULT_DAYS.vo2max, forceRefresh = false } = {}) {
    const cacheKey = `vo2max_${days}`;
    
    if (!forceRefresh) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        console.log('[DataService] Using cached VO2Max');
        return cached;
      }
    }
    
    try {
      console.log(`[DataService] Fetching VO2Max (${days} days)...`);
      const data = await AnalysisAPI.getVO2Max({ days });
      
      // Cache the result
      this.cache.set(cacheKey, data, CONFIG.CACHE_DURATION);
      
      return data;
    } catch (error) {
      console.error('[DataService] Error fetching VO2Max:', error);
      throw error;
    }
  }

  // ========== RIDER PROFILE ==========
  
  /**
   * Get rider profile analysis with caching
   * @param {Object} options - Query options
   * @param {boolean} options.forceRefresh - Skip cache
   * @returns {Promise<Object>} Rider profile data
   */
  async getRiderProfile({ forceRefresh = false } = {}) {
    const cacheKey = 'rider_profile';
    
    if (!forceRefresh) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        console.log('[DataService] Using cached rider profile');
        return cached;
      }
    }
    
    try {
      console.log('[DataService] Fetching rider profile...');
      const data = await AnalysisAPI.getRiderProfile();
      
      // Cache the result
      this.cache.set(cacheKey, data, CONFIG.CACHE_DURATION);
      
      return data;
    } catch (error) {
      console.error('[DataService] Error fetching rider profile:', error);
      throw error;
    }
  }

  // ========== ACTIVITIES ==========
  
  /**
   * Get activities list with caching
   * @param {Object} options - Query options
   * @param {number} options.limit - Number of activities
   * @param {number} options.offset - Pagination offset
   * @param {boolean} options.forceRefresh - Skip cache
   * @returns {Promise<Array>} Activities array
   */
  async getActivities({ limit = 20, offset = 0, forceRefresh = false } = {}) {
    const cacheKey = `activities_${limit}_${offset}`;
    
    if (!forceRefresh) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        console.log('[DataService] Using cached activities');
        return cached;
      }
    }
    
    try {
      console.log(`[DataService] Fetching activities (limit: ${limit}, offset: ${offset})...`);
      const data = await API.getActivities({ limit, offset });
      
      // Cache the result
      this.cache.set(cacheKey, data, CONFIG.CACHE_DURATION);
      
      return data;
    } catch (error) {
      console.error('[DataService] Error fetching activities:', error);
      throw error;
    }
  }

  /**
   * Get single activity with caching
   * @param {number} id - Activity ID
   * @param {Object} options - Query options
   * @param {boolean} options.forceRefresh - Skip cache
   * @returns {Promise<Object>} Activity data
   */
  async getActivity(id, { forceRefresh = false } = {}) {
    const cacheKey = `activity_${id}`;
    
    if (!forceRefresh) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        console.log('[DataService] Using cached activity');
        return cached;
      }
    }
    
    try {
      console.log(`[DataService] Fetching activity ${id}...`);
      const data = await API.getActivity(id);
      
      // Cache the result
      this.cache.set(cacheKey, data, CONFIG.CACHE_DURATION);
      
      return data;
    } catch (error) {
      console.error('[DataService] Error fetching activity:', error);
      throw error;
    }
  }

  // ========== SETTINGS ==========
  
  /**
   * Get user settings with caching
   * @param {Object} options - Query options
   * @param {boolean} options.forceRefresh - Skip cache
   * @returns {Promise<Object>} Settings data
   */
  async getSettings({ forceRefresh = false } = {}) {
    const cacheKey = 'user_settings';
    
    if (!forceRefresh) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        console.log('[DataService] Using cached settings');
        return cached;
      }
    }
    
    try {
      console.log('[DataService] Fetching settings...');
      const data = await API.getSettings();
      
      // Cache the result
      this.cache.set(cacheKey, data, CONFIG.CACHE_DURATION);
      
      return data;
    } catch (error) {
      console.error('[DataService] Error fetching settings:', error);
      throw error;
    }
  }

  /**
   * Update user settings and clear cache
   * @param {Object} settings - Settings to update
   * @returns {Promise<Object>} Updated settings
   */
  async updateSettings(settings) {
    try {
      console.log('[DataService] Updating settings...');
      const data = await API.updateSettings(settings);
      
      // Clear settings cache
      this.cache.delete('user_settings');
      
      // Clear all analysis caches since FTP/weight affects calculations
      this.clearAllCaches();
      
      // Trigger backend cache rebuild
      await this.rebuildBackendCache();
      
      // Emit event
      eventBus.emit(EVENTS.SETTINGS_UPDATED, data);
      
      return data;
    } catch (error) {
      console.error('[DataService] Error updating settings:', error);
      throw error;
    }
  }

  // ========== LEGACY CACHE MANAGEMENT ==========
  
  /**
   * Clear all cached data (legacy method)
   */
  clearCache() {
    console.log('[DataService] Clearing all cache...');
    this.cache.clear();
    eventBus.emit(EVENTS.CACHE_CLEAR);
  }

  /**
   * Clear specific cache key (legacy method)
   * @param {string} key - Cache key to clear
   */
  clearCacheKey(key) {
    console.log(`[DataService] Clearing cache key: ${key}`);
    this.cache.delete(key);
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getCacheStats() {
    return this.cache.getStats();
  }
}

// Create singleton instance
const dataService = new DataService();

// Make available globally for debugging
if (typeof window !== 'undefined') {
  window.dataService = dataService;
  
  // Debug helper
  window.checkCacheStatus = async function() {
    try {
      const status = await dataService.getCacheStatus();
      console.log('=== Backend Cache Status ===');
      console.log('User ID:', status.user_id);
      console.log('Last built:', status.cache_built_at);
      console.log('Is valid:', status.is_valid);
      console.log('Total files:', status.total_files);
      console.log('Total size:', (status.total_size_bytes / 1024).toFixed(2), 'KB');
      console.log('Files:', status.files);
      return status;
    } catch (error) {
      console.error('Failed to get cache status:', error);
    }
  };
}

export { DataService };
export default dataService;