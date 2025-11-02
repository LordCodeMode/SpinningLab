// ============================================
// FILE: static/js/core/api.js
// UPDATED: Integrated with config.js + Cache Management
// ============================================

import CONFIG from './config.js';

const BASE_URL = CONFIG.API_BASE_URL;

class APIClient {
  constructor() {
    this.baseURL = BASE_URL;
  }

  getToken() {
    return localStorage.getItem(CONFIG.TOKEN_STORAGE_KEY);
  }

  _mergeHeaders(options) {
    const token = this.getToken();
    const isFormData = options?.body instanceof FormData;
    const headers = {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options?.headers || {})
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      method: options.method || 'GET',
      headers: this._mergeHeaders(options),
      body: options.body ?? null,
      credentials: 'include',
    };

    try {
      const res = await fetch(url, config);

      if (res.status === 204) return null;

      const isJSON = res.headers.get('content-type')?.includes('application/json');
      const payload = isJSON ? await res.json().catch(() => ({})) : await res.text();

      if (!res.ok) {
        const msg = (isJSON && (payload?.detail || payload?.message)) || `HTTP ${res.status}: ${res.statusText}`;
        throw new Error(msg);
      }

      return payload;
    } catch (err) {
      console.error('[API] request failed:', err, { endpoint, options });
      throw err;
    }
  }

  get(endpoint, params) {
    const qs = params ? `?${new URLSearchParams(params).toString()}` : '';
    return this.request(`${endpoint}${qs}`, { method: 'GET' });
  }
  
  post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: data instanceof FormData ? data : JSON.stringify(data)
    });
  }
  
  put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }
  
  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
}

const apiClient = new APIClient();

/* ===========================
   AUTHENTICATION
   =========================== */
export const AuthAPI = {
  async login(username, password) {
    const form = new FormData();
    form.append('username', username);
    form.append('password', password);
    return apiClient.request('/api/auth/login', {
      method: 'POST',
      headers: {},
      body: form
    });
  },
  
  register(username, email, password, name = null) {
    return apiClient.post('/api/auth/register', { username, email, password, name });
  },
  
  me() {
    return apiClient.get('/api/auth/me');
  },
  
  logout() {
    return apiClient.post('/api/auth/logout', {});
  }
};

/* ===========================
   CORE API
   =========================== */
export const API = {
  // Settings
  getSettings() {
    return apiClient.get('/api/settings');
  },
  
  updateSettings(settings) {
    return apiClient.put('/api/settings', settings);
  },

  // Activities
  getActivities(params = {}) {
    return apiClient.get('/api/activities', params);
  },
  
  getActivity(id) {
    return apiClient.get(`/api/activities/${id}`);
  },

  // File Upload
  uploadFitFiles(files) {
    const form = new FormData();
    files.forEach(f => form.append('files', f));
    return apiClient.request('/api/import/fit-files', {
      method: 'POST',
      headers: {},
      body: form
    });
  },

  // ========== CACHE MANAGEMENT (NEW) ==========
  
  /**
   * Manually trigger backend cache rebuild
   * Called after settings changes or when cache needs refreshing
   */
  rebuildCache() {
    return apiClient.post('/api/import/rebuild-cache', {});
  },
  
  /**
   * Get current cache status
   * Returns info about cache files and when cache was last built
   */
  getCacheStatus() {
    return apiClient.get('/api/import/cache-status');
  }
};

/* ===========================
   ANALYSIS API - MATCHES BACKEND EXACTLY
   =========================== */
export const AnalysisAPI = {
  
  // GET /api/analysis/training-load?days=90
  // Returns: [{date, ctl, atl, tsb}, ...]
  async getTrainingLoad(params = {}) {
    const response = await apiClient.get('/api/analysis/training-load', params);
    
    // Backend returns array, but pages expect {current, daily}
    // Transform here to maintain backward compatibility
    if (Array.isArray(response) && response.length > 0) {
      const latest = response[response.length - 1];
      return {
        current: {
          ctl: latest.ctl,
          atl: latest.atl,
          tsb: latest.tsb
        },
        daily: response
      };
    }
    
    return { current: { ctl: 0, atl: 0, tsb: 0 }, daily: [] };
  },
  
  // GET /api/analysis/power-curve?weighted=true&start=YYYY-MM-DD&end=YYYY-MM-DD
  // Returns: {durations: [...], powers: [...], weighted: bool}
  async getPowerCurve(params = {}) {
    return apiClient.get('/api/analysis/power-curve', params);
  },
  
  // GET /api/analysis/critical-power
  // Returns: {critical_power, w_prime, durations, actual, predicted}
  async getCriticalPower() {
    return apiClient.get('/api/analysis/critical-power');
  },
  
  // GET /api/analysis/efficiency?days=120
  // Returns: {efficiency_data: [...], trend: {...}}
  async getEfficiency(params = {}) {
    const response = await apiClient.get('/api/analysis/efficiency', params);
    const efficiencyData = Array.isArray(response?.efficiency_data) ? response.efficiency_data : [];
    const trend = response?.trend ?? null;

    if (!efficiencyData.length) {
      return {
        ...response,
        efficiency_data: efficiencyData,
        trend,
        current_ef: response?.current_ef ?? null,
        avg_ef: response?.avg_ef ?? null,
        timeseries: [],
        sessions: []
      };
    }

    const timeseries = efficiencyData.map(item => {
      const date = item.start_time ? new Date(item.start_time) : null;
      const timestamp = date && !Number.isNaN(date.getTime()) ? date.getTime() : null;
      return {
        date: item.start_time,
        ef: item.ef,
        np: item.normalized_power,
        hr: item.avg_heart_rate,
        if: item.intensity_factor,
        intensity_factor: item.intensity_factor,
        duration: item.duration ?? null,
        timestamp
      };
    });

    const currentEf = response?.current_ef ?? (efficiencyData[efficiencyData.length - 1]?.ef ?? null);
    const avgEfCalculated = efficiencyData.reduce((sum, item) => sum + (item.ef ?? 0), 0) / efficiencyData.length;
    const avgEf = response?.avg_ef ?? (Number.isFinite(avgEfCalculated) ? avgEfCalculated : null);

    return {
      ...response,
      efficiency_data: efficiencyData,
      trend,
      current_ef: currentEf,
      avg_ef: avgEf,
      timeseries,
      sessions: response?.sessions ?? timeseries
    };
  },
  
  // GET /api/analysis/fitness-state
  // Returns: {status, status_description, ctl, atl, tsb, ef_trend, recommendations}
  async getFitnessState() {
    return apiClient.get('/api/analysis/fitness-state');
  },
  
  // GET /api/analysis/zone-balance?model=polarized&weeks=4
  // Returns: {model, weeks, zone_balance: [...], recommendations: [...]}
  async getZoneBalance(params = {}) {
    return apiClient.get('/api/analysis/zone-balance', params);
  },
  
  // GET /api/analysis/zones/power?days=90
  // Returns: {zone_data: [...], total_time, period_days}
  async getPowerZones(params = {}) {
    const response = await apiClient.get('/api/analysis/zones/power', params);
    
    // Transform to match zones.js expectations
    if (response.zone_data) {
      return {
        zones: response.zone_data.map(zone => ({
          name: zone.zone_label,
          seconds: zone.seconds_in_zone
        }))
      };
    }
    
    return { zones: [] };
  },
  
  // GET /api/analysis/zones/hr?days=90
  // Returns: {zone_data: [...], total_time, period_days}
  async getHRZones(params = {}) {
    return apiClient.get('/api/analysis/zones/hr', params);
  },
  
  // Alias for Heart Rate Zones (used by hr-zones.js page)
  async getHeartRateZones(params = {}) {
    return this.getHRZones(params);
  },
  
  // GET /api/analysis/best-power-values
  // Returns: {max_5sec_power, max_1min_power, ..., weight}
  async getBestPowerValues() {
    return apiClient.get('/api/analysis/best-power-values');
  },
  
  // GET /api/analysis/vo2max?days=180
  async getVO2Max(params = {}) {
    return apiClient.get('/api/analysis/vo2max', params);
  },
  
  // GET /api/analysis/rider-profile
  async getRiderProfile() {
    return apiClient.get('/api/analysis/rider-profile');
  }
};

/* ===========================
   CONVENIENCE ALIASES
   =========================== */
// Make AnalysisAPI methods available through API namespace for convenience
API.getTrainingLoad = (...args) => AnalysisAPI.getTrainingLoad(...args);
API.getPowerCurve = (...args) => AnalysisAPI.getPowerCurve(...args);
API.getCriticalPower = (...args) => AnalysisAPI.getCriticalPower(...args);
API.getEfficiency = (...args) => AnalysisAPI.getEfficiency(...args);
API.getFitnessState = (...args) => AnalysisAPI.getFitnessState(...args);
API.getZoneBalance = (...args) => AnalysisAPI.getZoneBalance(...args);
API.getPowerZones = (...args) => AnalysisAPI.getPowerZones(...args); 
API.getHRZones = (...args) => AnalysisAPI.getHRZones(...args);
API.getHeartRateZones = (...args) => AnalysisAPI.getHeartRateZones(...args);
API.getBestPowerValues = (...args) => AnalysisAPI.getBestPowerValues(...args);
API.getVO2Max = (...args) => AnalysisAPI.getVO2Max(...args);
API.getRiderProfile = (...args) => AnalysisAPI.getRiderProfile(...args);

export default API;
