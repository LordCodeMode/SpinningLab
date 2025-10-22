// ============================================
// FILE: pages/upload/index.js
// Upload Page - Enhanced Modern Design
// ============================================

import Services from '../../services/index.js';
import CONFIG from './config.js';

class UploadPage {
  constructor() {
    this.config = CONFIG;
    this.files = [];
    this.isUploading = false;
    this.dragCounter = 0;
  }

  async load() {
    Services.analytics.trackPageView('upload');
    
    // Small delay to ensure router's showLoading() has completed
    await new Promise(resolve => setTimeout(resolve, 50));
    
    this.render();
    this.setupEventListeners();
  }

  render() {
    // CRITICAL: Check both possible IDs to match dashboard behavior
    const container = document.getElementById('pageContent') || document.getElementById('page-content');
    
    if (!container) {
      console.error('[Upload] Page content container not found');
      console.error('[Upload] Tried: pageContent, page-content');
      console.error('[Upload] Available IDs:', Array.from(document.querySelectorAll('[id]')).map(el => el.id));
      return;
    }
    
    console.log('[Upload] Found container with ID:', container.id);
    
    container.innerHTML = `
      <div class="upload-section">
        <!-- Header -->
        <div class="upload-header">
          <h1>Upload Activities</h1>
          <p>Import .FIT files from your cycling computer or training platform</p>
        </div>

        <!-- Drop Zone -->
        <div class="upload-zone" id="uploadZone">
          <input type="file" id="fileInput" accept=".fit" multiple hidden>
          <div class="upload-zone__content">
            <div class="upload-zone__icon-wrapper">
              <svg class="upload-zone__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
              </svg>
            </div>
            <h3 class="upload-zone__title">Drop files here or click to browse</h3>
            <p class="upload-zone__subtitle">Drag and drop your .FIT files anywhere on this area</p>
            <button type="button" class="upload-zone__button" id="browseBtn">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                      d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
              </svg>
              Select Files
            </button>
            <div class="upload-zone__formats">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              Supports .FIT files up to 50MB each
            </div>
          </div>
        </div>

        <!-- File List -->
        <div id="fileListContainer" class="hidden">
          <div class="upload-files-card">
            <div class="upload-files-header">
              <div class="upload-files-title">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
                Selected Files
              </div>
              <span class="upload-files-count" id="filesCount">0 files</span>
            </div>
            <div class="upload-file-list" id="fileList"></div>
          </div>
        </div>

        <!-- Upload Actions -->
        <div id="uploadActions" class="upload-actions hidden">
          <button class="btn btn--primary" id="uploadBtn">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
            </svg>
            Upload Files
          </button>
          <button class="btn btn--secondary" id="clearBtn">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
            Clear All
          </button>
        </div>

        <!-- Progress -->
        <div id="uploadProgress" class="upload-progress hidden">
          <div class="upload-progress-header">
            <div class="upload-progress-text">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
              Uploading...
            </div>
            <div class="upload-progress-percent" id="progressPercent">0%</div>
          </div>
          <div class="upload-progress-bar">
            <div class="upload-progress-fill" id="progressFill" style="width: 0%"></div>
          </div>
        </div>

        <!-- Results -->
        <div id="uploadResults" class="hidden"></div>
      </div>
    `;
    
    if (typeof feather !== 'undefined') feather.replace();
  }

  setupEventListeners() {
    const uploadZone = document.getElementById('uploadZone');
    const fileInput = document.getElementById('fileInput');
    const browseBtn = document.getElementById('browseBtn');
    const uploadBtn = document.getElementById('uploadBtn');
    const clearBtn = document.getElementById('clearBtn');
    
    // Browse button click
    browseBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput?.click();
    });
    
    // Upload zone click
    uploadZone?.addEventListener('click', () => {
      fileInput?.click();
    });
    
    // File input change
    fileInput?.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        this.handleFileSelect(e.target.files);
      }
    });
    
    // Drag and drop events
    uploadZone?.addEventListener('dragenter', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.dragCounter++;
      uploadZone.classList.add('drag-over');
    });
    
    uploadZone?.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.dragCounter--;
      if (this.dragCounter === 0) {
        uploadZone.classList.remove('drag-over');
      }
    });
    
    uploadZone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    
    uploadZone?.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.dragCounter = 0;
      uploadZone.classList.remove('drag-over');
      
      if (e.dataTransfer.files.length > 0) {
        this.handleFileSelect(e.dataTransfer.files);
      }
    });
    
    // Upload button
    uploadBtn?.addEventListener('click', () => this.handleUpload());
    
    // Clear button
    clearBtn?.addEventListener('click', () => this.clearFiles());
  }

  handleFileSelect(files) {
    // Filter only .FIT files
    const fitFiles = Array.from(files).filter(f => 
      f.name.toLowerCase().endsWith('.fit')
    );
    
    if (fitFiles.length === 0) {
      this.showNotification('Please select .FIT files', 'error');
      return;
    }
    
    // Add to existing files
    this.files = [...this.files, ...fitFiles];
    
    // Remove duplicates based on name and size
    this.files = this.files.filter((file, index, self) =>
      index === self.findIndex(f => f.name === file.name && f.size === file.size)
    );
    
    this.renderFileList();
    this.showFileList();
    
    console.log(`[Upload] ${fitFiles.length} file(s) added`);
  }

  renderFileList() {
    const container = document.getElementById('fileList');
    const countEl = document.getElementById('filesCount');
    
    if (!container) return;
    
    // Update count
    if (countEl) {
      countEl.textContent = `${this.files.length} file${this.files.length !== 1 ? 's' : ''}`;
    }
    
    // Render file items
    container.innerHTML = this.files.map((file, index) => `
      <div class="upload-file-item">
        <div class="upload-file-icon">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
        </div>
        <div class="upload-file-info">
          <div class="upload-file-name" title="${file.name}">${file.name}</div>
          <div class="upload-file-size">${this.formatFileSize(file.size)}</div>
        </div>
        <button class="upload-file-remove" onclick="uploadPage.removeFile(${index})" title="Remove file">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
    `).join('');
  }

  showFileList() {
    document.getElementById('fileListContainer')?.classList.remove('hidden');
    document.getElementById('uploadActions')?.classList.remove('hidden');
  }

  hideFileList() {
    document.getElementById('fileListContainer')?.classList.add('hidden');
    document.getElementById('uploadActions')?.classList.add('hidden');
  }

  removeFile(index) {
    this.files.splice(index, 1);
    
    if (this.files.length === 0) {
      this.clearFiles();
    } else {
      this.renderFileList();
    }
  }

  clearFiles() {
    this.files = [];
    this.hideFileList();
    
    const fileInput = document.getElementById('fileInput');
    if (fileInput) fileInput.value = '';
    
    console.log('[Upload] Files cleared');
  }

  async handleUpload() {
    if (this.files.length === 0 || this.isUploading) return;

    this.isUploading = true;

    // Hide actions, show progress
    document.getElementById('uploadActions')?.classList.add('hidden');
    const progressContainer = document.getElementById('uploadProgress');
    progressContainer?.classList.remove('hidden');

    try {
      console.log(`[Upload] Starting upload of ${this.files.length} file(s)`);

      // Actually upload files to the API
      const result = await Services.upload.uploadFiles(this.files);

      // Show results based on actual response
      const successCount = result.successful || 0;
      const failedCount = result.failed || 0;

      if (successCount > 0) {
        let message = `Successfully uploaded ${successCount} file(s)!`;
        if (failedCount > 0) {
          message += ` (${failedCount} failed)`;
        }
        this.showResults('success', message);

        // Clear files and redirect after delay
        setTimeout(() => {
          this.clearFiles();
          progressContainer?.classList.add('hidden');

          // Redirect to activities page to see new data
          if (window.router) {
            window.router.navigateTo('activities');
          }
        }, 2000);
      } else {
        // All files failed
        this.showResults('error', `Upload failed: ${failedCount} file(s) could not be processed`);
        document.getElementById('uploadActions')?.classList.remove('hidden');
        progressContainer?.classList.add('hidden');
      }

    } catch (error) {
      console.error('[Upload] Upload failed:', error);
      this.showResults('error', `Upload failed: ${error.message}`);

      // Show actions again
      document.getElementById('uploadActions')?.classList.remove('hidden');
      progressContainer?.classList.add('hidden');

    } finally {
      this.isUploading = false;
    }
  }


  showResults(type, message) {
    const container = document.getElementById('uploadResults');
    if (!container) return;
    
    const iconPath = type === 'success'
      ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>'
      : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>';
    
    const resultClass = type === 'success' ? 'upload-result-success' : 'upload-result-error';
    
    container.innerHTML = `
      <div class="upload-results-card">
        <div class="${resultClass}">
          <div class="upload-result-icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              ${iconPath}
            </svg>
          </div>
          <div class="upload-result-content">
            <div class="upload-result-title">${type === 'success' ? 'Upload Complete' : 'Upload Failed'}</div>
            <div class="upload-result-text">${message}</div>
          </div>
        </div>
      </div>
    `;
    
    container.classList.remove('hidden');
    
    // Auto-hide after delay
    setTimeout(() => {
      container.classList.add('hidden');
    }, 5000);
  }

  showNotification(message, type = 'info') {
    // Use Services.notify if available, otherwise console
    if (Services.notify) {
      Services.notify(message, type);
    } else {
      console.log(`[Upload] ${type.toUpperCase()}: ${message}`);
    }
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  onUnload() {
    this.clearFiles();
    this.isUploading = false;
    this.dragCounter = 0;
  }
}

const uploadPage = new UploadPage();
export default uploadPage;

// Make available globally for inline onclick handlers
if (typeof window !== 'undefined') {
  window.uploadPage = uploadPage;
}