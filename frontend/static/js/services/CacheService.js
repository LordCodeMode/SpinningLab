// ============================================
// FILE: static/js/services/CacheService.js
// In-memory cache with TTL and statistics
// ============================================

class CacheService {
    constructor() {
      this.cache = new Map();
      this.stats = {
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0,
        clears: 0
      };
    }
  
    /**
     * Get item from cache
     * @param {string} key - Cache key
     * @returns {any} Cached value or null
     */
    get(key) {
      if (!this.cache.has(key)) {
        this.stats.misses++;
        return null;
      }
  
      const item = this.cache.get(key);
      
      // Check if expired
      if (item.expiresAt && Date.now() > item.expiresAt) {
        this.delete(key);
        this.stats.misses++;
        return null;
      }
  
      this.stats.hits++;
      return item.value;
    }
  
    /**
     * Set item in cache with optional TTL
     * @param {string} key - Cache key
     * @param {any} value - Value to cache
     * @param {number} ttl - Time to live in milliseconds (optional)
     */
    set(key, value, ttl = null) {
      const item = {
        value,
        createdAt: Date.now(),
        expiresAt: ttl ? Date.now() + ttl : null
      };
  
      this.cache.set(key, item);
      this.stats.sets++;
  
      // Log cache set in debug mode
      if (window.CONFIG?.FEATURES?.debugMode) {
        console.log(`[Cache] Set: ${key} (TTL: ${ttl ? ttl + 'ms' : 'none'})`);
      }
    }
  
    /**
     * Check if key exists and is not expired
     * @param {string} key - Cache key
     * @returns {boolean} True if exists and valid
     */
    has(key) {
      if (!this.cache.has(key)) {
        return false;
      }
  
      const item = this.cache.get(key);
      
      // Check if expired
      if (item.expiresAt && Date.now() > item.expiresAt) {
        this.delete(key);
        return false;
      }
  
      return true;
    }
  
    /**
     * Delete item from cache
     * @param {string} key - Cache key
     * @returns {boolean} True if deleted
     */
    delete(key) {
      const deleted = this.cache.delete(key);
      if (deleted) {
        this.stats.deletes++;
      }
      return deleted;
    }
  
    /**
     * Clear all cached items
     */
    clear() {
      this.cache.clear();
      this.stats.clears++;
      console.log('[Cache] All cache cleared');
    }
  
    /**
     * Clear expired items
     * @returns {number} Number of items cleared
     */
    clearExpired() {
      let cleared = 0;
      const now = Date.now();
  
      for (const [key, item] of this.cache.entries()) {
        if (item.expiresAt && now > item.expiresAt) {
          this.cache.delete(key);
          cleared++;
        }
      }
  
      if (cleared > 0) {
        console.log(`[Cache] Cleared ${cleared} expired item(s)`);
      }
  
      return cleared;
    }
  
    /**
     * Clear items matching a pattern
     * @param {string} pattern - Pattern to match (supports wildcards)
     * @returns {number} Number of items cleared
     */
    clearPattern(pattern) {
      let cleared = 0;
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
  
      for (const key of this.cache.keys()) {
        if (regex.test(key)) {
          this.cache.delete(key);
          cleared++;
        }
      }
  
      if (cleared > 0) {
        console.log(`[Cache] Cleared ${cleared} item(s) matching pattern: ${pattern}`);
      }
  
      return cleared;
    }
  
    /**
     * Get cache statistics
     * @returns {Object} Cache stats
     */
    getStats() {
      const hitRate = this.stats.hits + this.stats.misses > 0
        ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
        : 0;
  
      return {
        size: this.cache.size,
        hits: this.stats.hits,
        misses: this.stats.misses,
        hitRate: `${hitRate}%`,
        sets: this.stats.sets,
        deletes: this.stats.deletes,
        clears: this.stats.clears
      };
    }
  
    /**
     * Get all cache keys
     * @returns {Array<string>} Array of cache keys
     */
    keys() {
      return Array.from(this.cache.keys());
    }
  
    /**
     * Get cache size
     * @returns {number} Number of cached items
     */
    size() {
      return this.cache.size;
    }
  
    /**
     * Get cache info for a specific key
     * @param {string} key - Cache key
     * @returns {Object|null} Cache metadata
     */
    getInfo(key) {
      if (!this.cache.has(key)) {
        return null;
      }
  
      const item = this.cache.get(key);
      const now = Date.now();
  
      return {
        key,
        createdAt: new Date(item.createdAt).toISOString(),
        age: now - item.createdAt,
        expiresAt: item.expiresAt ? new Date(item.expiresAt).toISOString() : null,
        ttl: item.expiresAt ? Math.max(0, item.expiresAt - now) : null,
        isExpired: item.expiresAt ? now > item.expiresAt : false
      };
    }
  
    /**
     * Debug: Print all cache contents
     */
    debug() {
      console.log('[Cache] Debug Info:');
      console.log('Stats:', this.getStats());
      console.log('Keys:', this.keys());
      
      for (const key of this.cache.keys()) {
        console.log(`  - ${key}:`, this.getInfo(key));
      }
    }
  
    /**
     * Reset statistics
     */
    resetStats() {
      this.stats = {
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0,
        clears: 0
      };
      console.log('[Cache] Statistics reset');
    }
  
    /**
     * Get memory usage estimate (rough)
     * @returns {Object} Memory usage info
     */
    getMemoryUsage() {
      let totalSize = 0;
  
      for (const [key, item] of this.cache.entries()) {
        // Rough estimate: key length + JSON size of value
        totalSize += key.length;
        try {
          totalSize += JSON.stringify(item.value).length;
        } catch (e) {
          // Skip circular references
          totalSize += 100; // Rough estimate
        }
      }
  
      return {
        items: this.cache.size,
        estimatedBytes: totalSize,
        estimatedKB: (totalSize / 1024).toFixed(2),
        estimatedMB: (totalSize / 1024 / 1024).toFixed(2)
      };
    }
  
    /**
     * Set multiple items at once
     * @param {Object} items - Key-value pairs to cache
     * @param {number} ttl - Time to live in milliseconds (optional)
     */
    setMany(items, ttl = null) {
      for (const [key, value] of Object.entries(items)) {
        this.set(key, value, ttl);
      }
    }
  
    /**
     * Get multiple items at once
     * @param {Array<string>} keys - Array of cache keys
     * @returns {Object} Key-value pairs of cached items
     */
    getMany(keys) {
      const result = {};
      
      for (const key of keys) {
        const value = this.get(key);
        if (value !== null) {
          result[key] = value;
        }
      }
  
      return result;
    }
  
    /**
     * Delete multiple items at once
     * @param {Array<string>} keys - Array of cache keys
     * @returns {number} Number of items deleted
     */
    deleteMany(keys) {
      let deleted = 0;
      
      for (const key of keys) {
        if (this.delete(key)) {
          deleted++;
        }
      }
  
      return deleted;
    }
  
    /**
     * Refresh TTL for existing item
     * @param {string} key - Cache key
     * @param {number} ttl - New TTL in milliseconds
     * @returns {boolean} True if refreshed
     */
    refreshTTL(key, ttl) {
      if (!this.cache.has(key)) {
        return false;
      }
  
      const item = this.cache.get(key);
      item.expiresAt = ttl ? Date.now() + ttl : null;
      this.cache.set(key, item);
  
      return true;
    }
  
    /**
     * Create a namespaced cache instance
     * @param {string} namespace - Namespace prefix
     * @returns {Object} Namespaced cache methods
     */
    namespace(namespace) {
      return {
        get: (key) => this.get(`${namespace}:${key}`),
        set: (key, value, ttl) => this.set(`${namespace}:${key}`, value, ttl),
        has: (key) => this.has(`${namespace}:${key}`),
        delete: (key) => this.delete(`${namespace}:${key}`),
        clear: () => this.clearPattern(`${namespace}:*`)
      };
    }
  }
  
  // Create singleton instance
  const cacheService = new CacheService();
  
  // Make available globally for debugging
  if (typeof window !== 'undefined') {
    window.cacheService = cacheService;
  }
  
  export { CacheService };
  export default cacheService;