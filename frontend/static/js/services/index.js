// ============================================
// FILE: static/js/services/index.js
// UPDATED: Add UploadService and make Services global
// ============================================

// Import all service classes
import { DataService } from './DataService.js';
import { CacheService } from './CacheService.js';
import { ChartService } from './ChartService.js';
import { InsightService } from './InsightService.js';
import { AnalyticsService } from './AnalyticsService.js';
import { UploadService } from './UploadService.js';  // ← NEW
import * as formatters from '../utils/formatters.js';
import * as validators from '../utils/validators.js';

// Import singleton instances
import dataService from './DataService.js';
import cacheService from './CacheService.js';
import chartService from './ChartService.js';
import insightService from './InsightService.js';
import analyticsService from './AnalyticsService.js';
import uploadService from './UploadService.js';  // ← NEW

// ========== NAMED EXPORTS (Classes) ==========
export {
  DataService,
  CacheService,
  ChartService,
  InsightService,
  AnalyticsService,
  UploadService  // ← NEW
};

// ========== DEFAULT EXPORTS (Singleton Instances) ==========
export {
  dataService,
  cacheService,
  chartService,
  insightService,
  analyticsService,
  uploadService  // ← NEW
};

// ========== NAMESPACE EXPORT ==========
export const Services = {
  data: dataService,
  cache: cacheService,
  chart: chartService,
  insight: insightService,
  analytics: analyticsService,
  upload: uploadService  // ← NEW
};

// ========== MAKE SERVICES AVAILABLE GLOBALLY ==========
// This is CRITICAL for upload functionality
if (typeof window !== 'undefined') {
  window.Services = Services;
  console.log('[Services] Global Services object created:', Object.keys(Services));
}

// ========== DEFAULT NAMESPACE EXPORT ==========
export default Services;

// ========== CONVENIENCE RE-EXPORTS ==========
export { API, AnalysisAPI, AuthAPI } from '../core/api.js';
export { eventBus, EVENTS } from '../core/eventBus.js';
export { state } from '../core/state.js';
export { default as CONFIG } from '../core/config.js';
export { notify, setLoading } from '../core/utils.js';
export { formatters, validators };