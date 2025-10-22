// ============================================
// FILE: static/js/core/eventBus.js
// Global event bus for decoupled component communication
// ============================================

class EventBus {
  constructor() {
    this.events = new Map();
    this.eventHistory = [];
    this.maxHistorySize = 100;
    this.debugMode = false;
  }
  
  // ========== CORE EVENT METHODS ==========
  
  /**
   * Register an event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   * @param {Object} options - Options (once, priority)
   * @returns {Function} Unsubscribe function
   */
  on(event, callback, options = {}) {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    
    const listener = {
      callback,
      once: options.once || false,
      priority: options.priority || 0,
      id: this.generateId()
    };
    
    const listeners = this.events.get(event);
    listeners.push(listener);
    
    // Sort by priority (higher first)
    listeners.sort((a, b) => b.priority - a.priority);
    
    if (this.debugMode) {
      console.log(`[EventBus] Registered listener for "${event}"`, listener);
    }
    
    // Return unsubscribe function
    return () => this.off(event, listener.id);
  }
  
  /**
   * Register a one-time event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  once(event, callback) {
    return this.on(event, callback, { once: true });
  }
  
  /**
   * Unregister an event listener
   * @param {string} event - Event name
   * @param {string|Function} callbackOrId - Callback function or listener ID
   */
  off(event, callbackOrId) {
    if (!this.events.has(event)) return;
    
    const listeners = this.events.get(event);
    const filtered = listeners.filter(listener => {
      if (typeof callbackOrId === 'string') {
        return listener.id !== callbackOrId;
      }
      return listener.callback !== callbackOrId;
    });
    
    if (filtered.length === 0) {
      this.events.delete(event);
    } else {
      this.events.set(event, filtered);
    }
    
    if (this.debugMode) {
      console.log(`[EventBus] Unregistered listener for "${event}"`);
    }
  }
  
  /**
   * Emit an event
   * @param {string} event - Event name
   * @param {*} data - Event data
   * @returns {boolean} Whether any listeners were called
   */
  emit(event, data) {
    if (this.debugMode) {
      console.log(`[EventBus] Emitting "${event}"`, data);
    }
    
    // Store in history
    this.addToHistory(event, data);
    
    if (!this.events.has(event)) {
      return false;
    }
    
    const listeners = this.events.get(event);
    const listenersToRemove = [];
    let callbackCount = 0;
    
    listeners.forEach(listener => {
      try {
        listener.callback(data);
        callbackCount++;
        
        if (listener.once) {
          listenersToRemove.push(listener.id);
        }
      } catch (error) {
        console.error(`[EventBus] Error in listener for "${event}":`, error);
      }
    });
    
    // Remove one-time listeners
    listenersToRemove.forEach(id => this.off(event, id));
    
    return callbackCount > 0;
  }
  
  /**
   * Emit an event asynchronously
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  async emitAsync(event, data) {
    return new Promise(resolve => {
      setTimeout(() => {
        const result = this.emit(event, data);
        resolve(result);
      }, 0);
    });
  }
  
  // ========== UTILITY METHODS ==========
  
  /**
   * Check if an event has listeners
   * @param {string} event - Event name
   * @returns {boolean}
   */
  hasListeners(event) {
    return this.events.has(event) && this.events.get(event).length > 0;
  }
  
  /**
   * Get listener count for an event
   * @param {string} event - Event name
   * @returns {number}
   */
  listenerCount(event) {
    return this.events.has(event) ? this.events.get(event).length : 0;
  }
  
  /**
   * Get all registered event names
   * @returns {string[]}
   */
  eventNames() {
    return Array.from(this.events.keys());
  }
  
  /**
   * Clear all listeners for an event or all events
   * @param {string} [event] - Optional event name
   */
  clear(event) {
    if (event) {
      this.events.delete(event);
      if (this.debugMode) {
        console.log(`[EventBus] Cleared all listeners for "${event}"`);
      }
    } else {
      this.events.clear();
      if (this.debugMode) {
        console.log('[EventBus] Cleared all listeners');
      }
    }
  }
  
  // ========== EVENT HISTORY ==========
  
  addToHistory(event, data) {
    this.eventHistory.unshift({
      event,
      data,
      timestamp: Date.now()
    });
    
    // Limit history size
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(0, this.maxHistorySize);
    }
  }
  
  getHistory(event) {
    if (event) {
      return this.eventHistory.filter(item => item.event === event);
    }
    return [...this.eventHistory];
  }
  
  clearHistory() {
    this.eventHistory = [];
  }
  
  // ========== HELPERS ==========
  
  generateId() {
    return `listener_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  // ========== DEBUG METHODS ==========
  
  enableDebug() {
    this.debugMode = true;
    console.log('[EventBus] Debug mode enabled');
  }
  
  disableDebug() {
    this.debugMode = false;
  }
  
  debug() {
    console.log('[EventBus] Registered Events:', this.eventNames());
    console.log('[EventBus] Total Listeners:', 
      Array.from(this.events.values()).reduce((sum, listeners) => sum + listeners.length, 0)
    );
    
    this.events.forEach((listeners, event) => {
      console.log(`  - ${event}: ${listeners.length} listener(s)`);
    });
  }
  
  stats() {
    const stats = {
      totalEvents: this.events.size,
      totalListeners: 0,
      eventBreakdown: {}
    };
    
    this.events.forEach((listeners, event) => {
      stats.totalListeners += listeners.length;
      stats.eventBreakdown[event] = listeners.length;
    });
    
    return stats;
  }
}

// ========== PREDEFINED EVENTS ==========
// Define standard event names as constants to prevent typos

export const EVENTS = {
  // Auth Events
  AUTH_LOGIN: 'auth:login',
  AUTH_LOGOUT: 'auth:logout',
  AUTH_ERROR: 'auth:error',
  
  // Page Events
  PAGE_LOAD: 'page:load',
  PAGE_UNLOAD: 'page:unload',
  PAGE_REFRESH: 'page:refresh',
  
  // Data Events
  DATA_UPDATED: 'data:updated',
  DATA_ERROR: 'data:error',
  DATA_IMPORTED: 'data:imported',  // NEW: When FIT files are imported
  ACTIVITIES_UPDATED: 'activities:updated',
  SETTINGS_UPDATED: 'settings:updated',
  
  // Upload Events
  UPLOAD_START: 'upload:start',
  UPLOAD_PROGRESS: 'upload:progress',
  UPLOAD_COMPLETE: 'upload:complete',
  UPLOAD_ERROR: 'upload:error',
  
  // UI Events
  NOTIFICATION: 'ui:notification',
  LOADING_START: 'ui:loading:start',
  LOADING_END: 'ui:loading:end',
  SIDEBAR_TOGGLE: 'ui:sidebar:toggle',
  
  // Header Events
  HEADER_STATS_UPDATE: 'header:stats:update',
  
  // Cache Events
  CACHE_CLEAR: 'cache:clear',        // When frontend cache is cleared
  CACHE_REFRESH: 'cache:refresh',    // When cache refresh is requested
  CACHE_REBUILT: 'cache:rebuilt',    // NEW: When backend cache rebuild completes
  
  // State Events
  STATE_CHANGE: 'state:change'
};

// Create singleton instance
export const eventBus = new EventBus();

// Make available globally for debugging
if (typeof window !== 'undefined') {
  window.eventBus = eventBus;
  window.EVENTS = EVENTS;
}

export default eventBus;