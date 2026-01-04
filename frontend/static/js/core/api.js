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

  patch(endpoint, data) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
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
    return apiClient.get('/api/activities/', params);
  },
  
  getActivity(id) {
    return apiClient.get(`/api/activities/${id}`);
  },

  getActivityStreams(id) {
    return apiClient.get(`/api/activities/${id}/streams`);
  },

  deleteActivity(id) {
    return apiClient.delete(`/api/activities/${id}`);
  },

  renameActivity(id, name) {
    return apiClient.patch(`/api/activities/${id}`, { name });
  },

  updateActivity(id, updates) {
    return apiClient.patch(`/api/activities/${id}`, updates);
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
  },

  // ========== STRAVA INTEGRATION (NEW) ==========

  /**
   * Get Strava authorization URL
   */
  getStravaConnectUrl() {
    return apiClient.get('/api/strava/connect');
  },

  /**
   * Get Strava connection status
   */
  getStravaStatus() {
    return apiClient.get('/api/strava/status');
  },

  /**
   * Handle Strava OAuth callback
   */
  stravaCallback(code) {
    return apiClient.post(`/api/strava/callback?code=${code}`, {});
  },

  /**
   * Sync activities from Strava
   */
  syncStravaActivities(params = {}) {
    return apiClient.post('/api/strava/sync', params);
  },

  /**
   * Disconnect Strava account
   */
  disconnectStrava() {
    return apiClient.post('/api/strava/disconnect', {});
  },

  // ========== WORKOUT PLANNING (NEW) ==========

  /**
   * Get all workouts
   */
  getWorkouts(params = {}) {
    return apiClient.get('/api/workouts', params);
  },

  /**
   * Get a specific workout by ID
   */
  getWorkout(id) {
    return apiClient.get(`/api/workouts/${id}`);
  },

  /**
   * Create a new workout
   */
  createWorkout(workout) {
    return apiClient.post('/api/workouts', workout);
  },

  /**
   * Update an existing workout
   */
  updateWorkout(id, workout) {
    return apiClient.put(`/api/workouts/${id}`, workout);
  },

  /**
   * Delete a workout
   */
  deleteWorkout(id) {
    return apiClient.delete(`/api/workouts/${id}`);
  },

  /**
   * Duplicate a workout
   */
  duplicateWorkout(id) {
    return apiClient.post(`/api/workouts/${id}/duplicate`, {});
  },

  // ========== CALENDAR & PLANNED WORKOUTS (NEW) ==========

  /**
   * Get planned workouts for a date range
   */
  getPlannedWorkouts(params = {}) {
    return apiClient.get('/api/calendar', params);
  },

  /**
   * Get calendar view for a specific week
   */
  getCalendarWeek(params = {}) {
    return apiClient.get('/api/calendar/week', params);
  },

  /**
   * Schedule a workout on a specific date
   */
  scheduleWorkout(plannedWorkout) {
    return apiClient.post('/api/calendar', plannedWorkout);
  },

  /**
   * Get a specific planned workout
   */
  getPlannedWorkout(id) {
    return apiClient.get(`/api/calendar/${id}`);
  },

  /**
   * Update a planned workout (reschedule, mark completed, etc.)
   */
  updatePlannedWorkout(id, updates) {
    return apiClient.put(`/api/calendar/${id}`, updates);
  },

  /**
   * Delete a planned workout
   */
  deletePlannedWorkout(id) {
    return apiClient.delete(`/api/calendar/${id}`);
  },

  /**
   * Swap two planned workouts
   */
  swapPlannedWorkouts(sourceId, targetId) {
    return apiClient.post('/api/calendar/swap', { source_id: sourceId, target_id: targetId });
  },

  /**
   * Move a planned workout to a new date
   */
  movePlannedWorkout(id, newDate) {
    return apiClient.post(`/api/calendar/${id}/move`, { new_date: newDate });
  },

  // ========== TRAINING PLANS (NEW) ==========

  getTrainingPlanTemplates() {
    return apiClient.get('/api/training-plans/templates');
  },

  getTrainingPlans() {
    return apiClient.get('/api/training-plans/');
  },

  createTrainingPlan(plan) {
    return apiClient.post('/api/training-plans/', plan);
  },

  updateTrainingPlan(id, updates) {
    return apiClient.put(`/api/training-plans/${id}`, updates);
  },

  deleteTrainingPlan(id) {
    return apiClient.delete(`/api/training-plans/${id}`);
  },

  regenerateTrainingPlan(id, payload = {}) {
    return apiClient.post(`/api/training-plans/${id}/regenerate`, payload);
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

  async getComparisons(params = {}) {
    return apiClient.get('/api/analysis/comparisons', params);
  },

  // POST /api/analysis/predict-ftp?days=90
  async predictFtp(params = {}) {
    const qs = params && Object.keys(params).length
      ? `?${new URLSearchParams(params).toString()}`
      : '';
    return apiClient.post(`/api/analysis/predict-ftp${qs}`, {});
  },

  // GET /api/analysis/insights?days=14
  async getInsights(params = {}) {
    return apiClient.get('/api/analysis/insights', params);
  },

  // GET /api/analysis/insights/weekly-summary?days=7
  async getWeeklySummary(params = {}) {
    return apiClient.get('/api/analysis/insights/weekly-summary', params);
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
  async getBestPowerValues(params = {}) {
    return apiClient.get('/api/analysis/best-power-values', params);
  },

  // GET /api/analysis/best-power-values/record?duration=300
  // Returns: {activity_id, duration_seconds, power_value, ...}
  async getBestPowerRecord(params = {}) {
    return apiClient.get('/api/analysis/best-power-values/record', params);
  },
  
  // GET /api/analysis/vo2max?days=180
  async getVO2Max(params = {}) {
    return apiClient.get('/api/analysis/vo2max', params);
  },
  
  // GET /api/analysis/rider-profile
  async getRiderProfile() {
    return apiClient.get('/api/analysis/rider-profile');
  },

  // GET /api/analysis/metrics/fatigue-resistance?activity_id=123
  async getFatigueResistance(params = {}) {
    return apiClient.get('/api/analysis/metrics/fatigue-resistance', params);
  },

  // GET /api/analysis/metrics/w-prime-balance?activity_id=123
  async getWPrimeBalance(params = {}) {
    return apiClient.get('/api/analysis/metrics/w-prime-balance', params);
  },

  // GET /api/analysis/metrics/variability-index?activity_id=123
  async getVariabilityIndex(params = {}) {
    return apiClient.get('/api/analysis/metrics/variability-index', params);
  },

  // GET /api/analysis/metrics/decoupling?activity_id=123
  async getDecoupling(params = {}) {
    return apiClient.get('/api/analysis/metrics/decoupling', params);
  },

  // GET /api/analysis/metrics/polarized-distribution?days=30
  async getPolarizedDistribution(params = {}) {
    return apiClient.get('/api/analysis/metrics/polarized-distribution', params);
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
API.getBestPowerRecord = (...args) => AnalysisAPI.getBestPowerRecord(...args);
API.getVO2Max = (...args) => AnalysisAPI.getVO2Max(...args);
API.getRiderProfile = (...args) => AnalysisAPI.getRiderProfile(...args);
API.getFtpPrediction = (...args) => AnalysisAPI.predictFtp(...args);
API.getInsights = (...args) => AnalysisAPI.getInsights(...args);
API.getWeeklySummary = (...args) => AnalysisAPI.getWeeklySummary(...args);
API.getFatigueResistance = (...args) => AnalysisAPI.getFatigueResistance(...args);
API.getWPrimeBalance = (...args) => AnalysisAPI.getWPrimeBalance(...args);
API.getVariabilityIndex = (...args) => AnalysisAPI.getVariabilityIndex(...args);
API.getDecoupling = (...args) => AnalysisAPI.getDecoupling(...args);
API.getPolarizedDistribution = (...args) => AnalysisAPI.getPolarizedDistribution(...args);

export default API;
