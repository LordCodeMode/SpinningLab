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
      
      // Clear frontend caches immediately
      if (window.Services?.data) {
        window.Services.data.clearAllCaches();
        console.log('[Upload] Frontend cache cleared');
      }
      
      // Emit data imported event
      eventBus.emit(EVENTS.DATA_IMPORTED, {
        fileCount: successCount,
        timestamp: Date.now(),
        cacheRebuildTriggered: true
      });
      
      // Show notification
      notify(
        `${successCount} file(s) imported successfully! Analyzing new data in background...`,
        'success',
        5000
      );
      
      // Wait for backend cache rebuild (give it 2-3 seconds)
      setTimeout(() => {
        console.log('[Upload] Backend cache should be ready, prefetching data');
        
        // Prefetch fresh data for current page
        if (window.Services?.data) {
          window.Services.data.prefetchCommonData();
        }
        
        // Refresh current page to show new data
        if (window.router?.refresh) {
          window.router.refresh();
        }
      }, 3000);
    }
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
}

// Create singleton instance
const uploadService = new UploadService();

// Make available globally for debugging
if (typeof window !== 'undefined') {
  window.uploadService = uploadService;
}

export { UploadService };
export default uploadService;


