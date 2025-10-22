// /static/js/coordinator/pages/settings.js
import { API } from '../../core/api.js';
import { notify } from '../../core/utils.js';

export const settingsPage = {
  async load() {
    const html = `
      <style>
        .settings-wrap { display:grid; gap:20px; }
        .settings-header {
          display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;
        }
        .settings-grid {
          display:grid; gap:20px;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
        }
        .form-card {
          background:#ffffff;
          border:2px solid #d1d5db;
          border-radius:var(--radius);
          padding:24px;
          box-shadow:var(--shadow);
          transition:all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .form-card:hover {
          border-color:#3b82f6;
          box-shadow:0 8px 24px rgba(59,130,246,0.15), 0 0 0 1px #3b82f6;
          transform:translateY(-2px);
        }
        .form-title { 
          font-weight:700; font-size:18px; margin:0 0 6px; color:var(--text);
          display:flex; align-items:center; gap:10px; letter-spacing:-0.02em;
        }
        .form-title svg { color:#3b82f6; }
        .form-sub { 
          color:var(--text-muted); font-size:13px; margin-bottom:20px; line-height:1.5; 
        }
        .form-grid { display:grid; gap:18px; }
        .fg { display:grid; gap:8px; }
        .fg label { 
          font-size:13px; font-weight:600; color:var(--text); 
          display:flex; align-items:center; gap:6px;
        }
        .fg label svg { width:16px; height:16px; color:#3b82f6; }
        .fg small { color:var(--text-muted); font-size:12px; line-height:1.4; }
        .fg input[type="number"] {
          background:#ffffff;
          color:var(--text);
          border:1.5px solid #d1d5db;
          border-radius:8px;
          padding:11px 14px;
          font-size:15px;
          font-weight:500;
          transition:all 0.2s;
        }
        .fg input:hover {
          border-color:#3b82f6;
        }
        .fg input:focus {
          outline:none; 
          border-color:#3b82f6;
          box-shadow:0 0 0 3px rgba(59,130,246,0.15);
          background:#ffffff;
        }
        .actions { display:flex; gap:10px; margin-top:12px; flex-wrap:wrap; }
        .hint {
          background:linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(59,130,246,0.05) 100%);
          border:1.5px solid #3b82f6;
          border-radius:10px;
          padding:14px 16px;
          font-size:13px;
          line-height:1.5;
          display:flex;
          align-items:start;
          gap:12px;
          color:var(--text);
        }
        .hint svg {
          flex-shrink:0;
          width:20px;
          height:20px;
          color:#3b82f6;
          margin-top:2px;
        }
        .btn {
          padding:9px 18px;
          border-radius:8px;
          font-size:14px;
          font-weight:600;
          cursor:pointer;
          transition:all 0.2s;
          border:none;
          display:inline-flex;
          align-items:center;
          gap:8px;
        }
        .btn svg { width:16px; height:16px; }
        .btn-primary {
          background:linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          color:white;
          box-shadow:0 2px 8px rgba(59,130,246,0.25);
        }
        .btn-primary:hover {
          background:linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          transform:translateY(-2px);
          box-shadow:0 4px 12px rgba(59,130,246,0.35);
        }
        .btn-outline {
          background:transparent;
          border:1.5px solid #d1d5db;
          color:var(--text);
        }
        .btn-outline:hover {
          background:#f9fafb;
          border-color:#3b82f6;
          color:#3b82f6;
          transform:translateY(-1px);
        }
        .btn-sm { padding:7px 14px; font-size:13px; }
        .input-unit {
          position:relative;
        }
        .input-unit input {
          padding-right:50px;
        }
        .unit-label {
          position:absolute;
          right:14px;
          top:50%;
          transform:translateY(-50%);
          color:var(--text-muted);
          font-size:13px;
          font-weight:600;
          pointer-events:none;
        }
        .save-section {
          background:linear-gradient(135deg, rgba(16,185,129,0.05) 0%, rgba(59,130,246,0.05) 100%);
          border-color:#3b82f6;
        }
        .save-section:hover {
          border-color:#10b981;
          box-shadow:0 8px 24px rgba(16,185,129,0.15), 0 0 0 1px #10b981;
        }
      </style>

      <div class="settings-wrap">
        <div class="settings-header">
          <h1 id="page-title">Settings</h1>
          <div>
            <button id="settings-refresh" class="btn btn-outline btn-sm">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
              Refresh
            </button>
          </div>
        </div>

        <form id="settings-form" class="settings-grid" novalidate>
          <!-- Training -->
          <div class="form-card">
            <h3 class="form-title">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:24px;height:24px;">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
              </svg>
              Training Parameters
            </h3>
            <p class="form-sub">Core metrics for power calculations and performance analysis</p>
            <div class="form-grid">
              <div class="fg">
                <label for="ftp-input">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                  </svg>
                  FTP (Functional Threshold Power)
                </label>
                <div class="input-unit">
                  <input type="number" id="ftp-input" min="100" max="600" step="5" placeholder="250" inputmode="numeric" />
                  <span class="unit-label">watts</span>
                </div>
                <small>Your 60-minute threshold power - the maximum power you can sustain for an hour</small>
              </div>

              <div class="fg">
                <label for="weight-input">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"/>
                  </svg>
                  Body Weight
                </label>
                <div class="input-unit">
                  <input type="number" id="weight-input" min="40" max="150" step="0.1" placeholder="70.0" inputmode="decimal" />
                  <span class="unit-label">kg</span>
                </div>
                <small>Used for power-to-weight ratio (W/kg) and efficiency calculations</small>
              </div>
            </div>
          </div>

          <!-- Heart Rate -->
          <div class="form-card">
            <h3 class="form-title">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:24px;height:24px;">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
              </svg>
              Heart Rate Zones
            </h3>
            <p class="form-sub">Heart rate parameters for zone calculations and efficiency metrics</p>
            <div class="form-grid">
              <div class="fg">
                <label for="hr-max-input">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
                  </svg>
                  Maximum Heart Rate
                </label>
                <div class="input-unit">
                  <input type="number" id="hr-max-input" min="120" max="220" step="1" placeholder="190" inputmode="numeric" />
                  <span class="unit-label">bpm</span>
                </div>
                <small>Highest heart rate measured during maximum effort - typically found during VO₂max tests</small>
              </div>

              <div class="fg">
                <label for="hr-rest-input">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"/>
                  </svg>
                  Resting Heart Rate
                </label>
                <div class="input-unit">
                  <input type="number" id="hr-rest-input" min="30" max="100" step="1" placeholder="60" inputmode="numeric" />
                  <span class="unit-label">bpm</span>
                </div>
                <small>Measured in the morning while sitting or lying down, averaged over several days</small>
              </div>
            </div>
          </div>

          <!-- Save Section -->
          <div class="form-card save-section">
            <h3 class="form-title">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:24px;height:24px;">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              Save Changes
            </h3>
            <p class="form-sub">Changes take effect immediately and impact all analytics</p>
            <div class="hint">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <div>
                <strong style="display:block;margin-bottom:4px;">Pro Tip:</strong>
                After updating your FTP, refresh the Power Curve and Critical Power pages to see updated W/kg calculations and training zones.
              </div>
            </div>
            <div class="actions">
              <button type="submit" class="btn btn-primary" id="settings-save">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/>
                </svg>
                Save Settings
              </button>
              <button type="button" class="btn btn-outline" id="settings-reset">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                </svg>
                Reset to Saved
              </button>
            </div>
          </div>
        </form>
      </div>
    `;
    document.getElementById('page-content').innerHTML = html;

    this.setupEventListeners();
    await this.loadSettings();
  },

  setupEventListeners() {
    const form = document.getElementById('settings-form');
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.saveSettings();
    });

    document.getElementById('settings-reset')?.addEventListener('click', () => this.loadSettings());
    document.getElementById('settings-refresh')?.addEventListener('click', () => this.loadSettings());
  },

  async loadSettings() {
    try {
      const s = await API.getSettings().catch(() => ({}));

      const setVal = (id, v) => {
        const el = document.getElementById(id);
        if (el) el.value = (v ?? el.placeholder ?? '');
      };

      setVal('ftp-input', s.ftp ?? 250);
      setVal('weight-input', s.weight ?? 70);
      setVal('hr-max-input', s.hr_max ?? 190);
      setVal('hr-rest-input', s.hr_rest ?? 60);
    } catch (err) {
      console.error('[Settings] loadSettings failed:', err);
      notify('Error loading settings', 'error');
    }
  },

  async saveSettings() {
    try {
      const parseNum = (id, fallback = null) => {
        const v = document.getElementById(id)?.value;
        const n = v === '' ? NaN : Number(v);
        return Number.isFinite(n) ? n : fallback;
      };

      const payload = {
        ftp: parseNum('ftp-input'),
        weight: parseNum('weight-input'),
        hr_max: parseNum('hr-max-input'),
        hr_rest: parseNum('hr-rest-input')
      };

      // Validation
      if (payload.ftp && (payload.ftp < 100 || payload.ftp > 600)) {
        notify('FTP must be between 100 and 600 W', 'error'); return;
      }
      if (payload.weight && (payload.weight < 40 || payload.weight > 150)) {
        notify('Weight must be between 40 and 150 kg', 'error'); return;
      }
      if (payload.hr_max && (payload.hr_max < 120 || payload.hr_max > 220)) {
        notify('Max HR must be between 120 and 220 bpm', 'error'); return;
      }
      if (payload.hr_rest && (payload.hr_rest < 30 || payload.hr_rest > 100)) {
        notify('Resting HR must be between 30 and 100 bpm', 'error'); return;
      }

      await API.updateSettings(payload);
      notify('Settings saved successfully', 'success');

    } catch (err) {
      console.error('[Settings] saveSettings failed:', err);
      notify('Error saving settings', 'error');
    }
  },

  async refresh() {
    await this.loadSettings();
  }
};

export default settingsPage;