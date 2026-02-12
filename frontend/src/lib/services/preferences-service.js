// ============================================
// FILE: static/js/services/preferences-service.js
// Dashboard layout preferences stored in localStorage
// ============================================

const STORAGE_KEY = 'training_dashboard_preferences';
const DASHBOARD_KEY = 'dashboard_layout';

const PRESETS = {
  athlete: {
    order: ['hero', 'quick-stats', 'main-content', 'coach-summary', 'recent-activities', 'insights'],
    hidden: []
  },
  coach: {
    order: ['hero', 'recent-activities', 'main-content', 'coach-summary', 'quick-stats', 'insights'],
    hidden: ['insights']
  },
  'data-geek': {
    order: ['hero', 'main-content', 'quick-stats', 'coach-summary', 'insights', 'recent-activities'],
    hidden: []
  }
};

function readStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    console.warn('[PreferencesService] Failed to read preferences', error);
    return {};
  }
}

function writeStorage(payload) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function mergeOrder(order = [], defaults = []) {
  const normalized = Array.isArray(order) ? order.slice() : [];
  const missing = defaults.filter(id => !normalized.includes(id));
  return [...normalized, ...missing];
}

export function getDashboardPreferences(defaultOrder = []) {
  const store = readStorage();
  const storedPrefs = store[DASHBOARD_KEY] || {};
  const preset = PRESETS[storedPrefs.preset] || PRESETS.athlete;

  const order = mergeOrder(storedPrefs.order || preset.order, defaultOrder);
  const hidden = Array.isArray(storedPrefs.hidden) ? storedPrefs.hidden : preset.hidden;

  return {
    preset: storedPrefs.preset || 'athlete',
    order,
    hidden: hidden.filter(Boolean)
  };
}

export function saveDashboardPreferences(preferences) {
  const store = readStorage();
  store[DASHBOARD_KEY] = {
    preset: preferences.preset,
    order: preferences.order,
    hidden: preferences.hidden
  };
  writeStorage(store);
}

export function getDashboardPresets() {
  return PRESETS;
}

export function applyDashboardPreset(name, defaultOrder = []) {
  const preset = PRESETS[name] || PRESETS.athlete;
  return {
    preset: name,
    order: mergeOrder(preset.order, defaultOrder),
    hidden: preset.hidden.slice()
  };
}

export default {
  getDashboardPreferences,
  saveDashboardPreferences,
  getDashboardPresets,
  applyDashboardPreset
};
