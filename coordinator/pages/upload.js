// /static/js/coordinator/pages/upload.js
import { API } from '../../core/api.js';
import { notify } from '../../core/utils.js';

export const uploadPage = {
  files: [],
  selectedFiles: [],
  maxFiles: 50,
  acceptExt: ['.fit'],

  async load() {
    this.injectStyles();

    const el = document.getElementById('page-content');
    el.innerHTML = `
      <div class="page-section">
        <div class="section-header">
          <h1 id="page-title">Upload Files</h1>
        </div>

        <div class="upload-layout">
          <!-- LEFT: Dropzone -->
          <section class="card dropzone-card">
            <header class="card-header">
              <div class="card-title">
                <svg class="i-20"><use href="#ic-upload"/></svg>
                <span>Import your training data</span>
              </div>
              <span class="badge" id="file-count">0 files</span>
            </header>

            <div id="dropzone" class="dropzone" tabindex="0" role="button" aria-label="Upload FIT files">
              <div class="dropzone-inner">
                <div class="dz-icon">
                  <svg class="i-48" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
                  </svg>
                </div>
                <div class="dz-text">
                  <div class="dz-title">Drag &amp; drop FIT files here</div>
                  <div class="dz-sub">or <button class="link" id="browse-btn" type="button">browse your computer</button></div>
                  <div class="dz-hint">Accepted: .fit files • Maximum ${this.maxFiles} files</div>
                </div>
              </div>
              <input id="file-input" type="file" accept="${this.acceptExt.join(',')}" multiple hidden />
            </div>

            <footer class="dz-actions">
              <button id="clear-btn" class="btn btn-outline btn-sm" disabled>
                <svg style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:4px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                </svg>
                Clear All
              </button>
              <div class="spacer"></div>
              <button id="upload-btn" class="btn btn-primary btn-sm" disabled>
                <svg style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:4px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3v-8"/>
                </svg>
                Upload Files
              </button>
            </footer>
          </section>

          <!-- RIGHT: File list -->
          <section class="card list-card">
            <header class="card-header">
              <div class="card-title"><span>Selected files</span></div>
              <div class="muted" id="total-size">0 MB</div>
            </header>

            <div id="file-list" class="file-list empty">
              <div class="empty-state">
                <svg style="width:48px;height:48px;opacity:0.3;margin:0 auto 12px;color:var(--text-muted);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
                <p>No files selected yet</p>
                <p style="font-size:12px;opacity:0.7;">Choose files to see them here</p>
              </div>
            </div>
          </section>
        </div>

        <!-- Results -->
        <section id="result-card" class="card" style="display:none;margin-top:16px">
          <header class="card-header">
            <div class="card-title">
              <svg class="i-20" style="color:var(--success);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <span>Upload Results</span>
            </div>
          </header>
          <div id="results" class="results"></div>
        </section>
      </div>
    `;

    this.setupEventListeners();
  },

  injectStyles() {
    if (document.getElementById('upload-styles')) return;
    const style = document.createElement('style');
    style.id = 'upload-styles';
    style.textContent = `
      .upload-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
      @media (max-width: 1024px) { .upload-layout { grid-template-columns: 1fr; } }
      
      .card { 
        background: #ffffff;
        border: 2px solid #d1d5db;
        border-radius: var(--radius);
        box-shadow: var(--shadow);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .card:hover {
        border-color: #3b82f6;
        box-shadow: 0 8px 24px rgba(59,130,246,0.15), 0 0 0 1px #3b82f6;
        transform: translateY(-2px);
      }
      
      .card-header { 
        display:flex; align-items:center; justify-content:space-between; 
        padding:14px 16px; border-bottom:2px solid #e5e7eb; 
      }
      .card-title { 
        display:flex; gap:10px; align-items:center; font-weight:600; 
        color:var(--text); letter-spacing:-0.02em;
      }
      .i-20 { width:20px;height:20px; }
      .i-48 { width:48px;height:48px; color:#3b82f6; }
      .badge { 
        display:inline-flex; align-items:center; padding:4px 10px; 
        border-radius:999px; font-size:12px; font-weight:600; 
        border:1.5px solid #3b82f6; background:rgba(59,130,246,0.1); color:#3b82f6; 
      }
      
      /* Dropzone Styling with Blue Accents */
      .dropzone { 
        margin:16px; 
        border:2.5px dashed #3b82f6; 
        border-radius:14px; 
        background:linear-gradient(135deg, rgba(59,130,246,0.03) 0%, rgba(59,130,246,0.08) 100%); 
        min-height:240px; 
        display:flex; 
        align-items:center; 
        justify-content:center; 
        transition:all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        cursor:pointer; 
        position:relative;
        overflow:hidden;
      }
      .dropzone::before {
        content: '';
        position: absolute;
        inset: 0;
        background: radial-gradient(circle at 50% 50%, rgba(59,130,246,0.1) 0%, transparent 70%);
        opacity: 0;
        transition: opacity 0.3s;
      }
      .dropzone:hover::before {
        opacity: 1;
      }
      .dropzone:hover { 
        border-color: #2563eb;
        background:linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(59,130,246,0.12) 100%);
        transform: translateY(-2px);
        box-shadow: 0 8px 20px rgba(59,130,246,0.15);
      }
      .dropzone.is-over { 
        border-color: #1d4ed8;
        border-width: 3px;
        background:linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(59,130,246,0.25) 100%);
        box-shadow: 0 0 0 4px rgba(59,130,246,0.15), 0 12px 30px rgba(59,130,246,0.25);
        transform: scale(1.02);
      }
      .dropzone.is-over .i-48 {
        transform: scale(1.15);
        color: #1d4ed8;
      }
      .dropzone-inner { 
        display:flex; 
        flex-direction:column; 
        gap:14px; 
        align-items:center; 
        text-align:center; 
        padding:24px;
        position: relative;
        z-index: 1;
      }
      .dz-icon { 
        display:flex; 
        align-items:center; 
        justify-content:center;
        transition: transform 0.3s ease;
      }
      .dz-title { font-weight:700; font-size:18px; color:var(--text); letter-spacing:-0.02em; }
      .dz-sub { color:var(--text-muted); margin-top:4px; font-size:14px; }
      .dz-hint { color:var(--text-light); font-size:12px; margin-top:8px; font-weight:500; }
      .link { 
        border:0; 
        background:none; 
        color:#3b82f6; 
        cursor:pointer; 
        text-decoration:none; 
        padding:0; 
        font-weight:700;
        border-bottom: 2px solid transparent;
        transition: border-color 0.2s;
      }
      .link:hover { 
        color:#2563eb;
        border-bottom-color: #2563eb;
      }
      
      .dz-actions { display:flex; align-items:center; gap:8px; padding:0 16px 14px 16px; }
      .dz-actions .spacer { flex:1; }
      .file-list { padding:8px 12px 16px; max-height:400px; overflow-y:auto; }
      .file-list.empty { padding:28px 16px; }
      .empty-state { 
        color: var(--text-muted); 
        text-align:center; 
        padding:40px 24px; 
        border:2px dashed #e5e7eb; 
        border-radius:12px; 
        background: #f9fafb;
      }
      .file-row { 
        display:grid; 
        grid-template-columns: minmax(160px,1fr) 100px auto; 
        gap:12px; 
        align-items:center; 
        padding:12px 10px; 
        border-bottom:1px solid #f3f4f6;
        border-radius:6px;
        transition: background 0.15s;
      }
      .file-row:hover {
        background: #f9fafb;
      }
      .file-row:last-child { border-bottom:none; }
      .file-meta .name { 
        font-weight:600; 
        color:var(--text); 
        overflow:hidden; 
        text-overflow:ellipsis; 
        white-space:nowrap; 
      }
      .file-meta .size { font-size:13px; color:var(--text-muted); text-align:right; font-weight:500; }
      .file-actions { display:flex; justify-content:flex-end; }
      
      .btn { 
        padding:7px 16px; 
        border-radius:8px; 
        font-size:13px; 
        font-weight:600; 
        cursor:pointer; 
        transition:all 0.2s ease;
        border:none;
        display:inline-flex;
        align-items:center;
        justify-content:center;
      }
      .btn-outline { 
        background:transparent; 
        border:1.5px solid #d1d5db; 
        color:var(--text); 
      }
      .btn-outline:hover:not(:disabled) { 
        background:#f9fafb; 
        border-color:#ef4444; 
        color:#ef4444;
        transform: translateY(-1px);
      }
      .btn-primary { 
        background:linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
        color:white;
        border:none;
        box-shadow: 0 2px 8px rgba(59,130,246,0.25);
      }
      .btn-primary:hover:not(:disabled) { 
        background:linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(59,130,246,0.35);
      }
      .btn-primary:disabled, .btn-outline:disabled { 
        opacity:0.5; 
        cursor:not-allowed;
        transform: none !important;
      }
      .btn-sm { padding:6px 14px; font-size:12px; }
      
      .results { padding:16px; }
      .result-item { 
        padding:14px 16px; 
        margin-bottom:10px; 
        border-radius:8px; 
        background:#f9fafb; 
        border:1.5px solid #e5e7eb;
        display:flex;
        align-items:start;
        gap:12px;
      }
      .result-item svg { flex-shrink:0; margin-top:2px; }
    `;
    document.head.appendChild(style);
  },

  setupEventListeners() {
    const fileInput = document.getElementById('file-input');
    const dropzone = document.getElementById('dropzone');
    const browseBtn = document.getElementById('browse-btn');
    const uploadBtn = document.getElementById('upload-btn');
    const clearBtn = document.getElementById('clear-btn');

    const openPicker = () => fileInput?.click();
    
    browseBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      openPicker();
    });
    
    dropzone?.addEventListener('click', (e) => {
      if (e.target === browseBtn || browseBtn?.contains(e.target)) return;
      openPicker();
    });
    
    dropzone?.addEventListener('keydown', (e) => { 
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openPicker();
      }
    });

    fileInput?.addEventListener('change', (e) => {
      this.handleFiles(e.target.files);
      fileInput.value = '';
    });

    ['dragover', 'drop'].forEach(evt =>
      document.addEventListener(evt, (e) => { e.preventDefault(); })
    );

    dropzone?.addEventListener('dragenter', (e) => {
      e.preventDefault();
      dropzone.classList.add('is-over');
    });
    dropzone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('is-over');
    });
    dropzone?.addEventListener('dragleave', (e) => {
      if (e.target === dropzone) {
        dropzone.classList.remove('is-over');
      }
    });
    dropzone?.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('is-over');
      this.handleFiles(e.dataTransfer?.files);
    });

    uploadBtn?.addEventListener('click', () => this.startUpload());
    clearBtn?.addEventListener('click', () => {
      this.selectedFiles = [];
      this.renderFileList();
    });
  },

  handleFiles(files) {
    if (!files?.length) return;

    const newFiles = Array.from(files)
      .filter(f => f.name.toLowerCase().endsWith('.fit'))
      .filter(f => !this.selectedFiles.some(sf => sf.name === f.name && sf.size === f.size));

    if (newFiles.length === 0) {
      if (files.length > 0) {
        notify('No valid .fit files found or files already selected', 'warning');
      }
      return;
    }

    if (this.selectedFiles.length + newFiles.length > this.maxFiles) {
      notify(`Cannot add more than ${this.maxFiles} files`, 'error');
      return;
    }

    this.selectedFiles = [...this.selectedFiles, ...newFiles];
    this.renderFileList();
    notify(`Added ${newFiles.length} file${newFiles.length > 1 ? 's' : ''}`, 'success');
  },

  renderFileList() {
    const container = document.getElementById('file-list');
    const uploadBtn = document.getElementById('upload-btn');
    const clearBtn = document.getElementById('clear-btn');
    const fileCount = document.getElementById('file-count');
    const totalSize = document.getElementById('total-size');

    if (!container) return;

    const totalBytes = this.selectedFiles.reduce((sum, f) => sum + f.size, 0);
    const totalMB = (totalBytes / 1024 / 1024).toFixed(2);
    
    if (fileCount) fileCount.textContent = `${this.selectedFiles.length} file${this.selectedFiles.length !== 1 ? 's' : ''}`;
    if (totalSize) totalSize.textContent = `${totalMB} MB`;

    if (uploadBtn) uploadBtn.disabled = this.selectedFiles.length === 0;
    if (clearBtn) clearBtn.disabled = this.selectedFiles.length === 0;

    if (this.selectedFiles.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg style="width:48px;height:48px;opacity:0.3;margin:0 auto 12px;color:var(--text-muted);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          <p>No files selected yet</p>
          <p style="font-size:12px;opacity:0.7;">Choose files to see them here</p>
        </div>
      `;
      container.classList.add('empty');
      return;
    }

    container.classList.remove('empty');
    container.innerHTML = this.selectedFiles.map((file, idx) => `
      <div class="file-row" data-index="${idx}">
        <div class="file-meta">
          <div class="name" title="${file.name}">${file.name}</div>
        </div>
        <div class="file-meta">
          <div class="size">${(file.size / 1024 / 1024).toFixed(2)} MB</div>
        </div>
        <div class="file-actions">
          <button class="btn btn-outline btn-sm" data-remove="${idx}" aria-label="Remove ${file.name}">
            <svg style="width:12px;height:12px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('button[data-remove]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const i = Number(e.currentTarget.getAttribute('data-remove'));
        this.selectedFiles.splice(i, 1);
        this.renderFileList();
      });
    });
  },

  async startUpload() {
    if (this.selectedFiles.length === 0) return;

    const uploadBtn = document.getElementById('upload-btn');
    const originalHTML = uploadBtn?.innerHTML;
    
    if (uploadBtn) {
      uploadBtn.disabled = true;
      uploadBtn.innerHTML = `
        <svg style="width:14px;height:14px;animation:spin 0.8s linear infinite;margin-right:6px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
        </svg>
        Uploading...
      `;
    }

    try {
      notify('Uploading files…', 'info');

      const result = await API.uploadFitFiles(this.selectedFiles);

      notify(`Successfully uploaded ${this.selectedFiles.length} file${this.selectedFiles.length > 1 ? 's' : ''}!`, 'success');

      const resultsCard = document.getElementById('result-card');
      const resultsContent = document.getElementById('results');
      if (resultsCard && resultsContent) {
        const successCount = result?.uploaded?.length || this.selectedFiles.length;
        resultsContent.innerHTML = `
          <div class="result-item" style="border-color:#10b981;">
            <svg style="width:24px;height:24px;color:#10b981;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <div>
              <strong style="color:#10b981;font-size:15px;">Upload Complete</strong>
              <p style="margin:4px 0 0;color:var(--text-muted);">${successCount} file${successCount !== 1 ? 's' : ''} processed successfully</p>
            </div>
          </div>
        `;
        resultsCard.style.display = 'block';
      }

      this.selectedFiles = [];
      this.renderFileList();

    } catch (error) {
      console.error('Upload error:', error);
      notify(`Upload failed: ${error.message}`, 'error');
      
      const resultsCard = document.getElementById('result-card');
      const resultsContent = document.getElementById('results');
      if (resultsCard && resultsContent) {
        resultsContent.innerHTML = `
          <div class="result-item" style="border-color:#ef4444;">
            <svg style="width:24px;height:24px;color:#ef4444;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <div>
              <strong style="color:#ef4444;font-size:15px;">Upload Failed</strong>
              <p style="margin:4px 0 0;color:var(--text-muted);">${error.message}</p>
            </div>
          </div>
        `;
        resultsCard.style.display = 'block';
      }
    } finally {
      if (uploadBtn) {
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = originalHTML || 'Upload Files';
      }
    }
  },

  async refresh() {}
};

export default uploadPage;