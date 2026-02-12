// ============================================
// FILE: static/js/core/state.js
// Global state management with reactive updates
// ============================================

import { eventBus } from './eventBus.js';

class AppState {
  constructor() {
    this.state = {
      // User state
      user: null,
      isAuthenticated: false,
      
      // Settings cache
      settings: {
        ftp: null,
        weight: null,
        hr_max: null,
        hr_rest: null,
        age: null,
        gender: null
      },
      
      // Header stats cache
      headerStats: {
        ctl: 0,
        atl: 0,
        tsb: 0,
        recentActivities: 0,
        totalDistance: 0,
        totalTime: 0,
        lastUpdated: null
      },
      
      // Page state
      currentPage: null,
      isLoading: false,
      
      // Data caches
      activities: [],
      activitiesLastFetch: null,
      
      trainingLoad: null,
      trainingLoadLastFetch: null,
      
      powerCurve: null,
      powerCurveLastFetch: null,
      
      // Upload state
      uploadProgress: {
        isUploading: false,
        current: 0,
        total: 0,
        currentFile: null,
        errors: []
      },
      
      // UI state
      sidebarExpanded: false,
      notifications: []
    };
    
    this.subscribers = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }
  
  // ========== GETTER METHODS ==========
  
  get(key) {
    return this.getNestedValue(this.state, key);
  }
  
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
  
  getUser() {
    return this.state.user;
  }
  
  isAuthenticated() {
    return this.state.isAuthenticated;
  }
  
  getSettings() {
    return { ...this.state.settings };
  }
  
  getHeaderStats() {
    return { ...this.state.headerStats };
  }
  
  getCurrentPage() {
    return this.state.currentPage;
  }
  
  getActivities() {
    return [...this.state.activities];
  }
  
  getUploadProgress() {
    return { ...this.state.uploadProgress };
  }
  
  // ========== SETTER METHODS ==========
  
  set(key, value) {
    const oldValue = this.get(key);
    this.setNestedValue(this.state, key, value);
    
    // Notify subscribers
    this.notifySubscribers(key, value, oldValue);
    
    // Emit event
    eventBus.emit('state:change', { key, value, oldValue });
    eventBus.emit(`state:change:${key}`, { value, oldValue });
  }
  
  setNestedValue(obj, path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((current, key) => {
      if (!current[key]) current[key] = {};
      return current[key];
    }, obj);
    target[lastKey] = value;
  }
  
  setUser(user) {
    this.set('user', user);
    this.set('isAuthenticated', !!user);
  }
  
  updateSettings(settings) {
    this.set('settings', { ...this.state.settings, ...settings });
  }
  
  updateHeaderStats(stats) {
    this.set('headerStats', {
      ...this.state.headerStats,
      ...stats,
      lastUpdated: Date.now()
    });
  }
  
  setCurrentPage(page) {
    this.set('currentPage', page);
  }
  
  setLoading(isLoading) {
    this.set('isLoading', isLoading);
  }
  
  // ========== ACTIVITIES MANAGEMENT ==========
  
  setActivities(activities) {
    this.state.activities = activities;
    this.state.activitiesLastFetch = Date.now();
    this.notifySubscribers('activities', activities);
    eventBus.emit('state:activities:updated', activities);
  }
  
  addActivity(activity) {
    this.state.activities.unshift(activity);
    this.notifySubscribers('activities', this.state.activities);
    eventBus.emit('state:activities:added', activity);
  }
  
  needsRefresh(key) {
    const lastFetch = this.state[`${key}LastFetch`];
    if (!lastFetch) return true;
    return (Date.now() - lastFetch) > this.cacheTimeout;
  }
  
  // ========== TRAINING LOAD CACHE ==========
  
  setTrainingLoad(data) {
    this.state.trainingLoad = data;
    this.state.trainingLoadLastFetch = Date.now();
    this.notifySubscribers('trainingLoad', data);
  }
  
  getTrainingLoad() {
    return this.state.trainingLoad;
  }
  
  // ========== POWER CURVE CACHE ==========
  
  setPowerCurve(data) {
    this.state.powerCurve = data;
    this.state.powerCurveLastFetch = Date.now();
    this.notifySubscribers('powerCurve', data);
  }
  
  getPowerCurve() {
    return this.state.powerCurve;
  }
  
  // ========== UPLOAD PROGRESS ==========
  
  updateUploadProgress(progress) {
    this.set('uploadProgress', {
      ...this.state.uploadProgress,
      ...progress
    });
  }
  
  resetUploadProgress() {
    this.set('uploadProgress', {
      isUploading: false,
      current: 0,
      total: 0,
      currentFile: null,
      errors: []
    });
  }
  
  // ========== NOTIFICATIONS ==========
  
  addNotification(notification) {
    const id = Date.now();
    const notif = { id, timestamp: Date.now(), ...notification };
    this.state.notifications.push(notif);
    this.notifySubscribers('notifications', this.state.notifications);
    eventBus.emit('state:notification:added', notif);
    return id;
  }
  
  removeNotification(id) {
    this.state.notifications = this.state.notifications.filter(n => n.id !== id);
    this.notifySubscribers('notifications', this.state.notifications);
  }
  
  // ========== SUBSCRIPTION SYSTEM ==========
  
  subscribe(key, callback) {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    this.subscribers.get(key).add(callback);
    
    // Return unsubscribe function
    return () => {
      const subscribers = this.subscribers.get(key);
      if (subscribers) {
        subscribers.delete(callback);
      }
    };
  }
  
  notifySubscribers(key, value, oldValue) {
    const subscribers = this.subscribers.get(key);
    if (subscribers) {
      subscribers.forEach(callback => {
        try {
          callback(value, oldValue);
        } catch (error) {
          console.error(`[State] Subscriber error for ${key}:`, error);
        }
      });
    }
  }
  
  // ========== RESET & CLEAR ==========
  
  reset() {
    const defaultState = {
      user: null,
      isAuthenticated: false,
      settings: {
        ftp: null,
        weight: null,
        hr_max: null,
        hr_rest: null,
        age: null,
        gender: null
      },
      headerStats: {
        ctl: 0,
        atl: 0,
        tsb: 0,
        recentActivities: 0,
        totalDistance: 0,
        totalTime: 0,
        lastUpdated: null
      },
      currentPage: null,
      isLoading: false,
      activities: [],
      activitiesLastFetch: null,
      trainingLoad: null,
      trainingLoadLastFetch: null,
      powerCurve: null,
      powerCurveLastFetch: null,
      uploadProgress: {
        isUploading: false,
        current: 0,
        total: 0,
        currentFile: null,
        errors: []
      },
      sidebarExpanded: false,
      notifications: []
    };
    
    Object.keys(defaultState).forEach(key => {
      this.set(key, defaultState[key]);
    });
  }
  
  clearCache() {
    this.state.activities = [];
    this.state.activitiesLastFetch = null;
    this.state.trainingLoad = null;
    this.state.trainingLoadLastFetch = null;
    this.state.powerCurve = null;
    this.state.powerCurveLastFetch = null;
    
    console.log('[State] Cache cleared');
    eventBus.emit('state:cache:cleared');
  }
  
  // ========== DEBUG METHODS ==========
  
  getState() {
    return JSON.parse(JSON.stringify(this.state));
  }
  
  debug() {
    console.log('[State] Current State:', this.getState());
    console.log('[State] Subscribers:', Array.from(this.subscribers.keys()));
  }
}

// Create singleton instance
export const state = new AppState();

// Make available globally for debugging
if (typeof window !== 'undefined') {
  window.appState = state;
}

export default state;