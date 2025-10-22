// ============================================
// FILE: static/js/core/upload.js
// File upload utilities and validation
// ============================================

import CONFIG from './config.js';
import { eventBus, EVENTS } from './eventBus.js';
import { state } from './state.js';
import { notify } from './utils.js';
import { API } from './api.js';

class UploadManager {
  constructor() {
    this.maxFileSize = CONFIG.UPLOAD_MAX_SIZE;
    this.maxFiles = CONFIG.UPLOAD_MAX_FILES;
    this.supportedFormats = CONFIG.SUPPORTED_FORMATS;
    this.currentUploads = [];
    this.uploadQueue = [];
    this.isUploading = false;
  }
  
  // ========== FILE VALIDATION ==========
  
  /**
   * Validate a single file
   * @param {File} file - File to validate
   * @returns {Object} Validation result {valid, error}
   */
  validateFile(file) {
    // Check if file exists
    if (!file) {
      return { valid: false, error: 'No file provided' };
    }
    
    // Check file size
    if (file.size > this.maxFileSize) {
      const maxSizeMB = (this.maxFileSize / (1024 * 1024)).toFixed(1);
      return { 
        valid: false, 
        error: `File "${file.name}" exceeds maximum size of ${maxSizeMB}MB` 
      };
    }
    
    // Check file format
    const extension = this.getFileExtension(file.name);
    if (!this.supportedFormats.includes(extension)) {
      return {
        valid: false,
        error: `File "${file.name}" has unsupported format. Supported: ${this.supportedFormats.join(', ')}`
      };
    }
    
    return { valid: true, error: null };
  }
  
  /**
   * Validate multiple files
   * @param {FileList|File[]} files - Files to validate
   * @returns {Object} Validation result {valid, errors}
   */
  validateFiles(files) {
    const fileArray = Array.from(files);
    
    // Check file count
    if (fileArray.length === 0) {
      return { valid: false, errors: ['No files selected'] };
    }
    
    if (fileArray.length > this.maxFiles) {
      return { 
        valid: false, 
        errors: [`Maximum ${this.maxFiles} files allowed. You selected ${fileArray.length}.`] 
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
  
  // ========== FILE UPLOAD ==========
  
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
      
      throw error;
    }
  }
  
  /**
   * Perform the actual upload to the API
   * @param {File[]} files - Valid files to upload
   * @param {Object} options - Upload options
   * @returns {Promise<Object>} Upload result
   */
  async performUpload(files, options = {}) {
    const { 
      onProgress,
      onFileComplete 
    } = options;
    
    try {
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
  
  // ========== DRAG & DROP ==========
  
  /**
   * Setup drag and drop on an element
   * @param {HTMLElement} element - Element to enable drag & drop
   * @param {Function} onDrop - Callback when files are dropped
   */
  setupDragDrop(element, onDrop) {
    if (!element) return;
    
    const handleDragOver = (e) => {
      e.preventDefault();
      e.stopPropagation();
      element.classList.add('drag-over');
    };
    
    const handleDragLeave = (e) => {
      e.preventDefault();
      e.stopPropagation();
      element.classList.remove('drag-over');
    };
    
    const handleDrop = (e) => {
      e.preventDefault();
      e.stopPropagation();
      element.classList.remove('drag-over');
      
      const files = e.dataTransfer.files;
      if (files.length > 0 && onDrop) {
        onDrop(files);
      }
    };
    
    element.addEventListener('dragover', handleDragOver);
    element.addEventListener('dragleave', handleDragLeave);
    element.addEventListener('drop', handleDrop);
    
    // Return cleanup function
    return () => {
      element.removeEventListener('dragover', handleDragOver);
      element.removeEventListener('dragleave', handleDragLeave);
      element.removeEventListener('drop', handleDrop);
    };
  }
  
  // ========== FILE UTILITIES ==========
  
  /**
   * Get file extension
   * @param {string} filename - Filename
   * @returns {string} Extension including dot (e.g., '.fit')
   */
  getFileExtension(filename) {
    const lastDot = filename.lastIndexOf('.');
    return lastDot > -1 ? filename.substring(lastDot).toLowerCase() : '';
  }
  
  /**
   * Format file size for display
   * @param {number} bytes - File size in bytes
   * @returns {string} Formatted size
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }
  
  /**
   * Check if file is a supported format
   * @param {File} file - File to check
   * @returns {boolean}
   */
  isSupportedFormat(file) {
    const extension = this.getFileExtension(file.name);
    return this.supportedFormats.includes(extension);
  }
  
  /**
   * Create a file input element
   * @param {Object} options - Input options
   * @returns {HTMLInputElement}
   */
  createFileInput(options = {}) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = this.supportedFormats.join(',');
    input.multiple = options.multiple !== false;
    input.style.display = 'none';
    
    if (options.onChange) {
      input.addEventListener('change', (e) => {
        const files = e.target.files;
        if (files.length > 0) {
          options.onChange(files);
        }
      });
    }
    
    return input;
  }
  
  /**
   * Trigger file selection dialog
   * @param {Object} options - Selection options
   * @returns {Promise<FileList>}
   */
  selectFiles(options = {}) {
    return new Promise((resolve) => {
      const input = this.createFileInput({
        ...options,
        onChange: (files) => {
          resolve(files);
          input.remove();
        }
      });
      
      document.body.appendChild(input);
      input.click();
    });
  }
  
  // ========== QUEUE MANAGEMENT ==========
  
  /**
   * Add files to upload queue
   * @param {FileList|File[]} files - Files to queue
   */
  queueFiles(files) {
    const fileArray = Array.from(files);
    fileArray.forEach(file => {
      const validation = this.validateFile(file);
      if (validation.valid) {
        this.uploadQueue.push(file);
      }
    });
  }
  
  /**
   * Process the upload queue
   */
  async processQueue() {
    if (this.isUploading || this.uploadQueue.length === 0) {
      return;
    }
    
    const files = [...this.uploadQueue];
    this.uploadQueue = [];
    
    await this.uploadFiles(files);
  }
  
  /**
   * Clear the upload queue
   */
  clearQueue() {
    this.uploadQueue = [];
  }
  
  // ========== STATE GETTERS ==========
  
  getUploadProgress() {
    return state.getUploadProgress();
  }
  
  isCurrentlyUploading() {
    return this.isUploading;
  }
  
  getQueueLength() {
    return this.uploadQueue.length;
  }
}

// Create singleton instance
export const uploadManager = new UploadManager();

// Export helper functions
export const validateFile = (file) => uploadManager.validateFile(file);
export const validateFiles = (files) => uploadManager.validateFiles(files);
export const uploadFiles = (files, options) => uploadManager.uploadFiles(files, options);
export const setupDragDrop = (element, onDrop) => uploadManager.setupDragDrop(element, onDrop);
export const selectFiles = (options) => uploadManager.selectFiles(options);
export const formatFileSize = (bytes) => uploadManager.formatFileSize(bytes);

export default uploadManager;