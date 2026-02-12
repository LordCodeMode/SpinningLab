// ============================================
// FILE: static/js/services/UploadService.js
// Updated upload handling with cache management
// ============================================

import { API } from '../core/api.js';
import { eventBus, EVENTS } from '../core/eventBus.js';
import { notify } from '../utils/notifications.js';
import state from '../core/state.js';
import CONFIG from '../core/config.js';

class UploadService {
  constructor() {
    this.isUploading = false;
    this.uploadStartedAt = null;
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Listen for upload complete to clear caches
    eventBus.on(EVENTS.UPLOAD_COMPLETE, (result) => {
      this.handleUploadComplete(result);
    });
  }

  /**
   * Handle successful upload completion
   */
  handleUploadComplete(result) {
    // Check if any files were successfully imported
    const successCount = result.results?.filter(r => r.success).length || 0;

    if (successCount > 0 && result.cache_rebuild_triggered) {
      console.log(`[Upload] ${successCount} files imported, backend cache rebuild triggered`);
      this.postImportRefresh(successCount).catch(err => {
        console.error('[Upload] Post-import refresh failed:', err);
      });
    }
  }

  async postImportRefresh(successCount) {
    notify(`${successCount} file(s) imported. Rebuilding analytics...`, 'info', 4000);

    const targetTime = this.uploadStartedAt || Date.now();
    const rebuilt = await this.waitForCacheRebuild(targetTime);

    if (!rebuilt) {
      notify('Cache rebuild is taking longer than expected. Data will update shortly.', 'warning', 6000);
    }

    // Emit DATA_IMPORTED event which will trigger cache clearing via DataService listener
    eventBus.emit(EVENTS.DATA_IMPORTED, {
      fileCount: successCount,
      timestamp: Date.now(),
      cacheRebuildTriggered: true
    });

    // Small delay to ensure event handlers complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Refresh the current page to load fresh data
    // The page's load() method will fetch data with forceRefresh=true
    if (window.router?.refresh) {
      try {
        console.log('[Upload] Refreshing current page after import...');
        await window.router.refresh();
      } catch (err) {
        console.error('[Upload] Router refresh failed:', err);
      }
    }

    notify('Analytics updated with your latest activities!', 'success', 4000);
    this.uploadStartedAt = null;
  }

  /**
   * Upload files to the server
   * @param {FileList|File[]} files - Files to upload
   * @param {Object} options - Upload options
   * @returns {Promise<Object>} Upload result
   */
  async uploadFiles(files, options = {}) {
    const validation = this.validateFiles(files);
    
    // Show validation errors
    if (!validation.valid) {
      validation.errors.forEach(error => notify(error, 'error'));
      throw new Error('File validation failed');
    }
    
    // Show any warnings about skipped files
    if (validation.invalidCount > 0) {
      notify(`${validation.invalidCount} file(s) skipped due to validation errors`, 'warning');
    }
    
    try {
      // Update state
      this.isUploading = true;
      this.uploadStartedAt = Date.now();
      state.updateUploadProgress({
        isUploading: true,
        total: validation.validFiles.length,
        current: 0,
        errors: []
      });
      
      eventBus.emit(EVENTS.UPLOAD_START, {
        fileCount: validation.validFiles.length
      });
      
      // Perform upload
      const result = await this.performUpload(validation.validFiles, options);
      
      // Update state on success
      state.resetUploadProgress();
      this.isUploading = false;
      
      eventBus.emit(EVENTS.UPLOAD_COMPLETE, result);
      
      return result;
      
    } catch (error) {
      // Update state on error
      state.updateUploadProgress({
        isUploading: false,
        errors: [error.message]
      });
      this.isUploading = false;
      
      eventBus.emit(EVENTS.UPLOAD_ERROR, error);
      notify(`Upload failed: ${error.message}`, 'error');
      
      throw error;
    }
  }

  /**
   * Perform the actual upload to the API
   */
  async performUpload(files, options = {}) {
    const { onProgress, onFileComplete } = options;
    
    try {
      console.log(`[Upload] Uploading ${files.length} files...`);
      
      // Call API upload endpoint
      const result = await API.uploadFitFiles(files);
      
      // Update progress
      state.updateUploadProgress({
        current: files.length,
        total: files.length
      });
      
      // Trigger callbacks
      if (onProgress) {
        onProgress(files.length, files.length);
      }
      
      return result;
      
    } catch (error) {
      console.error('[Upload] Upload failed:', error);
      throw new Error(`Upload failed: ${error.message}`);
    }
  }

  /**
   * Validate files before upload
   */
  validateFiles(files) {
    const fileArray = Array.from(files);
    
    // Check file count
    if (fileArray.length > CONFIG.UPLOAD_MAX_FILES) {
      return { 
        valid: false, 
        errors: [`Maximum ${CONFIG.UPLOAD_MAX_FILES} files allowed. You selected ${fileArray.length}.`] 
      };
    }
    
    // Validate each file
    const errors = [];
    const validFiles = [];
    
    fileArray.forEach(file => {
      const result = this.validateFile(file);
      if (result.valid) {
        validFiles.push(file);
      } else {
        errors.push(result.error);
      }
    });
    
    return {
      valid: errors.length === 0,
      errors,
      validFiles,
      invalidCount: errors.length
    };
  }

  /**
   * Validate single file
   */
  validateFile(file) {
    // Check file type
    if (!file.name.toLowerCase().endsWith('.fit')) {
      return {
        valid: false,
        error: `${file.name}: Invalid file type. Only .fit files are allowed.`
      };
    }
    
    // Check file size
    if (file.size > CONFIG.UPLOAD_MAX_SIZE) {
      return {
        valid: false,
        error: `${file.name}: File too large. Maximum size is ${CONFIG.UPLOAD_MAX_SIZE / 1024 / 1024}MB.`
      };
    }
    
    // Check file is not empty
    if (file.size === 0) {
      return {
        valid: false,
        error: `${file.name}: File is empty.`
      };
    }
    
    return { valid: true };
  }

  async waitForCacheRebuild(targetTime, { timeoutMs = 120000, intervalMs = 3000 } = {}) {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      try {
        const status = await API.getCacheStatus();
        const importBuiltAt = status?.cache_built_after_import
          ? Date.parse(status.cache_built_after_import)
          : null;
        const fullBuiltAt = status?.cache_built_at ? Date.parse(status.cache_built_at) : null;
        const builtAt = importBuiltAt || fullBuiltAt;

        if (builtAt && builtAt >= targetTime) {
          const label = importBuiltAt ? status.cache_built_after_import : status.cache_built_at;
          console.log('[Upload] Cache rebuild completed at', label);
          return true;
        }
      } catch (err) {
        console.warn('[Upload] Cache status check failed:', err.message);
      }

      await this.sleep(intervalMs);
    }

    return false;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Create singleton instance
const uploadService = new UploadService();

// Make available globally for debugging
if (typeof window !== 'undefined') {
  window.uploadService = uploadService;
}

export { UploadService };
export default uploadService;
