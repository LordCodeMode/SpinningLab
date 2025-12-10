// ============================================
// FILE: pages/settings/index.js
// Settings Page - COMPLETE FIXED VERSION
// ============================================

import Services from '../../services/index.js';
import CONFIG from './config.js';
import { LoadingSkeleton, ErrorState } from '../../components/ui/States.js';
import { notify, setLoading } from '../../core/utils.js';
import { eventBus } from '../../core/eventBus.js';

const DISPLAY_NAME_STORAGE_KEY = CONFIG.DISPLAY_NAME_STORAGE_KEY || 'training_dashboard_display_name';

class SettingsPage {
  constructor() {
    this.config = CONFIG;
    this.settings = null;
    this.stravaCallbackListener = null;
  }

  async load() {
    try {
      Services.analytics.trackPageView('settings');

      await new Promise(resolve => setTimeout(resolve, 100));

      this.renderLoading();

      this.settings = await Services.data.getSettings();
      this.render();
      this.setupEventListeners();

      // Load Strava status after initial render
      await this.loadStravaStatus();

      // Listen for Strava callback completion from router
      this.stravaCallbackListener = async () => {
        console.log('[Settings] Received strava:callback:complete event');
        await this.loadStravaStatus();
      };
      eventBus.on('strava:callback:complete', this.stravaCallbackListener);
    } catch (error) {
      console.error('[Settings] Load error:', error);
      await new Promise(resolve => setTimeout(resolve, 100));
      this.renderError(error);
    }
  }

  async handleStravaCallback() {
    console.log('[Settings] handleStravaCallback - Full URL:', window.location.href);
    console.log('[Settings] handleStravaCallback - Hash:', window.location.hash);
    console.log('[Settings] handleStravaCallback - Search:', window.location.search);

    const urlParams = this.extractStravaParams();
    const code = urlParams.get('code');
    const scope = urlParams.get('scope');

    console.log('[Settings] handleStravaCallback called', { code, scope, hasCode: !!code, hasScope: !!scope });

    if (code && scope) {
      try {
        console.log('[Settings] Calling Strava callback API with code:', code);
        notify('Connecting to Strava...', 'info');

        const response = await Services.api.stravaCallback(code);
        console.log('[Settings] Strava callback response:', response);

        if (response.success) {
          notify(`Connected to Strava as ${response.athlete.firstname} ${response.athlete.lastname}!`, 'success');

          // Clean up URL
          const [hashPath] = window.location.hash.split('?');
          window.history.replaceState({}, document.title, `${window.location.pathname}${hashPath || ''}`);

          // Reload Strava status to show connected state
          console.log('[Settings] Reloading Strava status...');
          await this.loadStravaStatus();
        }
      } catch (error) {
        console.error('[Settings] Strava callback error:', error);
        notify('Failed to connect to Strava: ' + error.message, 'error');
      }
    } else {
      console.log('[Settings] No Strava callback parameters found');
    }
  }

  extractStravaParams() {
    // Check regular query string first
    if (window.location.search && window.location.search.length > 1) {
      return new URLSearchParams(window.location.search);
    }

    // Hash router case (#/settings?code=...)
    if (window.location.hash && window.location.hash.includes('?')) {
      const [, query] = window.location.hash.split('?');
      return new URLSearchParams(query);
    }

    return new URLSearchParams();
  }

  async loadStravaStatus() {
    try {
      const response = await Services.api.getStravaStatus();
      this.renderStravaSection(response);
    } catch (error) {
      console.error('[Settings] Failed to load Strava status:', error);
      this.renderStravaSection({ connected: false });
    }
  }

  renderStravaSection(status) {
    const container = document.getElementById('stravaSection');
    if (!container) return;

    if (status.connected) {
      container.innerHTML = `
        <div class="settings-field">
          <div style="display: flex; align-items: center; gap: 12px; padding: 16px; background: var(--success-bg, #10b98114); border-radius: 8px; border: 1px solid var(--success-color, #10b981);">
            <svg style="flex-shrink: 0; width: 24px; height: 24px; color: var(--success-color, #10b981);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <div style="flex: 1;">
              <div style="font-weight: 600; color: var(--success-color, #10b981); margin-bottom: 4px;">Connected to Strava</div>
              <div style="font-size: 0.875rem; color: var(--text-secondary);">Athlete ID: ${status.athlete_id}</div>
            </div>
          </div>
        </div>

        <div class="settings-form-row" style="margin-top: 16px;">
          <button type="button" id="syncStravaBtn" class="settings-save-button" style="flex: 1;">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            Sync Activities from Strava
          </button>
          <button type="button" id="disconnectStravaBtn" class="btn btn-secondary" style="flex: 1; padding: 12px 24px; background: var(--error-bg, #ef444414); color: var(--error-color, #ef4444); border: 1px solid var(--error-color, #ef4444);">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width: 20px; height: 20px;">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
            Disconnect
          </button>
        </div>

        <div class="settings-field-help" style="margin-top: 12px;">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          Sync automatically imports all your Strava activities with power, HR, and zone data.
        </div>
      `;

      // Add event listeners
      document.getElementById('syncStravaBtn')?.addEventListener('click', () => this.handleStravaSync());
      document.getElementById('disconnectStravaBtn')?.addEventListener('click', () => this.handleStravaDisconnect());
    } else {
      container.innerHTML = `
        <div class="settings-field">
          <div style="padding: 20px; text-align: center;">
            <svg style="width: 48px; height: 48px; color: var(--text-secondary); margin: 0 auto 16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
            </svg>
            <h4 style="margin-bottom: 8px; font-weight: 600;">Not Connected</h4>
            <p style="color: var(--text-secondary); margin-bottom: 20px;">Connect your Strava account to automatically import activities</p>
            <button type="button" id="connectStravaBtn" class="settings-save-button">
              <svg fill="currentColor" viewBox="0 0 24 24" style="width: 20px; height: 20px;">
                <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169"/>
              </svg>
              Connect with Strava
            </button>
          </div>
        </div>

        <div class="settings-zones-preview" style="margin-top: 16px;">
          <div class="settings-zones-title">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            Benefits of Strava Integration
          </div>
          <div class="settings-zone-item">
            <span class="settings-zone-name">🔄 Auto-Import</span>
            <span class="settings-zone-range">No manual FIT uploads</span>
          </div>
          <div class="settings-zone-item">
            <span class="settings-zone-name">⚡ Full Data</span>
            <span class="settings-zone-range">Power, HR, cadence streams</span>
          </div>
          <div class="settings-zone-item">
            <span class="settings-zone-name">📊 Instant Analysis</span>
            <span class="settings-zone-range">Power curves & zones</span>
          </div>
        </div>
      `;

      // Add connect button listener
      document.getElementById('connectStravaBtn')?.addEventListener('click', () => this.handleStravaConnect());
    }
  }

  async handleStravaConnect() {
    try {
      const response = await Services.api.getStravaConnectUrl();
      if (response.authorization_url) {
        // Save current URL to return to settings after OAuth
        localStorage.setItem('strava_return_url', window.location.href);
        // Redirect to Strava OAuth
        window.location.href = response.authorization_url;
      }
    } catch (error) {
      console.error('[Settings] Strava connect error:', error);
      notify('Failed to connect to Strava: ' + error.message, 'error');
    }
  }

  async handleStravaDisconnect() {
    if (!confirm('Are you sure you want to disconnect from Strava? Your imported activities will not be deleted.')) {
      return;
    }

    try {
      await Services.api.disconnectStrava();
      notify('Disconnected from Strava', 'success');
      await this.loadStravaStatus();
    } catch (error) {
      console.error('[Settings] Strava disconnect error:', error);
      notify('Failed to disconnect from Strava: ' + error.message, 'error');
    }
  }

  async handleStravaSync() {
    const syncBtn = document.getElementById('syncStravaBtn');
    if (!syncBtn) return;

    try {
      syncBtn.disabled = true;
      syncBtn.innerHTML = `
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="animation: spin 1s linear infinite;">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
        </svg>
        Syncing...
      `;

      const result = await Services.api.syncStravaActivities();

      notify(`${result.message}`, 'success');

      // Refresh data
      Services.data.clearCache();
      if (window.dashboard) {
        await window.dashboard.forceUpdateHeaderStats();
      }

      syncBtn.disabled = false;
      syncBtn.innerHTML = `
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
        </svg>
        Sync Complete!
      `;

      setTimeout(() => {
        syncBtn.innerHTML = `
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
          Sync Activities from Strava
        `;
      }, 3000);

    } catch (error) {
      console.error('[Settings] Strava sync error:', error);
      notify('Sync failed: ' + error.message, 'error');

      syncBtn.disabled = false;
      syncBtn.innerHTML = `
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
        </svg>
        Sync Activities from Strava
      `;
    }
  }

  render() {
    const container = document.getElementById('pageContent') || document.getElementById('page-content');
    if (!container) {
      console.error('[Settings] Cannot render - container not found');
      return;
    }
    
    const ftp = this.settings.ftp || '';
    const weight = this.settings.weight || '';
    const hrMax = this.settings.hr_max || '';
    const hrRest = this.settings.hr_rest || '';
    const lthr = this.settings.lthr || '';
    const displayName = this.getDisplayNameValue();
    const accountEmail = this.settings.email || '';
    
    container.innerHTML = `
      <div class="settings-section">
        <!-- Header -->
        <div class="settings-header">
          <h1>Settings</h1>
          <p>Configure your profile and training parameters for accurate power and heart rate analysis</p>
        </div>

        <!-- Info Banner -->
        <div class="settings-info-banner">
          <svg class="settings-info-banner-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <div class="settings-info-banner-content">
            <div class="settings-info-banner-title">Why These Settings Matter</div>
            <div class="settings-info-banner-text">
              Your FTP and weight determine power zones and w/kg metrics. Heart rate values enable accurate training load and intensity calculations. 
              Keep these updated for the most accurate analysis.
            </div>
          </div>
        </div>

        <form id="settingsForm" class="settings-cards-grid">
          <!-- Profile Card -->
          <div class="settings-card">
            <div class="settings-card-header">
              <div class="settings-card-icon profile">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M5.121 17.804A7 7 0 0112 15h0a7 7 0 016.879 2.804M15 11a3 3 0 10-6 0 3 3 0 006 0z"/>
                </svg>
              </div>
              <div class="settings-card-title-group">
                <h3 class="settings-card-title">Profile</h3>
                <p class="settings-card-subtitle">Control how your name appears across the dashboard</p>
              </div>
            </div>

            <div class="settings-form-grid">
              <div class="settings-field">
                <label class="settings-field-label" for="display_name">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M5.121 17.804A7 7 0 0112 15h0a7 7 0 016.879 2.804M15 11a3 3 0 10-6 0 3 3 0 006 0z"/>
                  </svg>
                  Display Name
                </label>
                <input 
                  type="text"
                  id="display_name"
                  name="display_name"
                  value="${this.escapeHtml(displayName)}"
                  class="settings-field-input"
                  maxlength="100"
                  placeholder="Max Hartwig"
                  autocomplete="name"
                >
                <div class="settings-field-help">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  Shown in the sidebar footer and Overview welcome banner.
                </div>
              </div>

              <div class="settings-field">
                <label class="settings-field-label" for="account_email">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8m0 8v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h14a2 2 0 002-2z"/>
                  </svg>
                  Account Email
                </label>
                <input
                  type="text"
                  id="account_email"
                  class="settings-field-input"
                  value="${this.escapeHtml(accountEmail)}"
                  readonly
                >
                <div class="settings-field-help">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  Used for login and account recovery.
                </div>
              </div>
            </div>
          </div>

          <!-- Strava Integration Card -->
          <div class="settings-card">
            <div class="settings-card-header">
              <div class="settings-card-icon" style="background: linear-gradient(135deg, #fc4c02 0%, #ff6b35 100%);">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
                </svg>
              </div>
              <div class="settings-card-title-group">
                <h3 class="settings-card-title">Strava Integration</h3>
                <p class="settings-card-subtitle">Auto-import activities from Strava with full power and HR data</p>
              </div>
            </div>

            <div class="settings-form-grid" id="stravaSection">
              <div style="text-align: center; padding: 20px;">
                <div class="loading-spinner" style="margin: 0 auto;"></div>
                <p style="margin-top: 10px; color: var(--text-secondary);">Checking Strava connection...</p>
              </div>
            </div>
          </div>

          <!-- Power Settings Card -->
          <div class="settings-card">
            <div class="settings-card-header">
              <div class="settings-card-icon power">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                        d="M13 10V3L4 14h7v7l9-11h-7z"/>
                </svg>
              </div>
              <div class="settings-card-title-group">
                <h3 class="settings-card-title">Power Settings</h3>
                <p class="settings-card-subtitle">Configure FTP and automatically calculate power zones</p>
              </div>
            </div>
            
            <div class="settings-form-grid">
              <div class="settings-field">
                <label class="settings-field-label" for="ftp">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                          d="M13 10V3L4 14h7v7l9-11h-7z"/>
                  </svg>
                  FTP (Functional Threshold Power)
                </label>
                <div class="settings-field-suffix">
                  <input type="number" id="ftp" name="ftp" value="${ftp}" 
                         class="settings-field-input"
                         placeholder="250" min="50" max="600" step="1" required>
                  <div class="settings-field-unit">watts</div>
                </div>
                <div class="settings-field-help">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  Your 1-hour maximum sustainable power output
                </div>
              </div>

              <!-- Power Zones Preview Container -->
              <div id="powerZonesPreview">
                ${ftp ? this.renderPowerZones(ftp) : ''}
              </div>
            </div>
          </div>

          <!-- Physical Parameters Card -->
          <div class="settings-card">
            <div class="settings-card-header">
              <div class="settings-card-icon body">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                </svg>
              </div>
              <div class="settings-card-title-group">
                <h3 class="settings-card-title">Physical Parameters</h3>
                <p class="settings-card-subtitle">Body measurements for w/kg calculations</p>
              </div>
            </div>
            
            <div class="settings-form-grid">
              <div class="settings-field">
                <label class="settings-field-label" for="weight">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"/>
                  </svg>
                  Body Weight
                </label>
                <div class="settings-field-suffix">
                  <input type="number" id="weight" name="weight" value="${weight}" 
                         class="settings-field-input"
                         placeholder="70" min="30" max="200" step="0.1" required>
                  <div class="settings-field-unit">kg</div>
                </div>
                <div class="settings-field-help">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  Used to calculate watts per kilogram (w/kg) for relative power metrics
                </div>
              </div>

              <!-- W/kg Preview Container -->
              <div id="wkgPreview">
                ${ftp && weight ? this.renderWkgPreview(ftp, weight) : ''}
              </div>
            </div>
          </div>

          <!-- Heart Rate Settings Card -->
          <div class="settings-card">
            <div class="settings-card-header">
              <div class="settings-card-icon heart">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                </svg>
              </div>
              <div class="settings-card-title-group">
                <h3 class="settings-card-title">Heart Rate Zones</h3>
                <p class="settings-card-subtitle">Configure maximum, resting, and threshold heart rate</p>
              </div>
            </div>
            
            <div class="settings-form-grid">
              <div class="settings-form-row">
                <div class="settings-field">
                  <label class="settings-field-label" for="hr_max">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
                    </svg>
                    Maximum Heart Rate
                  </label>
                  <div class="settings-field-suffix">
                    <input type="number" id="hr_max" name="hr_max" value="${hrMax}" 
                           class="settings-field-input"
                           placeholder="190" min="120" max="220" step="1">
                    <div class="settings-field-unit">bpm</div>
                  </div>
                  <div class="settings-field-help">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    Highest heart rate achieved during max effort
                  </div>
                </div>

                <div class="settings-field">
                  <label class="settings-field-label" for="hr_rest">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"/>
                    </svg>
                    Resting Heart Rate
                  </label>
                  <div class="settings-field-suffix">
                    <input type="number" id="hr_rest" name="hr_rest" value="${hrRest}" 
                           class="settings-field-input"
                           placeholder="60" min="30" max="100" step="1">
                    <div class="settings-field-unit">bpm</div>
                  </div>
                  <div class="settings-field-help">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    Heart rate when completely at rest
                  </div>
                </div>
              </div>

              <div class="settings-field">
                <label class="settings-field-label" for="lthr">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                  </svg>
                  Lactate Threshold HR (LTHR)
                </label>
                <div class="settings-field-suffix">
                  <input type="number" id="lthr" name="lthr" value="${lthr}" 
                         class="settings-field-input"
                         placeholder="170" min="100" max="210" step="1">
                  <div class="settings-field-unit">bpm</div>
                </div>
                <div class="settings-field-help">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  Heart rate at lactate threshold (1-hour max effort)
                </div>
              </div>

              <!-- HR Zones Preview Container -->
              <div id="hrZonesPreview">
                ${hrMax && hrRest ? this.renderHRZones(hrMax, hrRest) : ''}
              </div>
            </div>
          </div>

          <!-- Training Load Settings Card -->
          <div class="settings-card">
            <div class="settings-card-header">
              <div class="settings-card-icon training">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                </svg>
              </div>
              <div class="settings-card-title-group">
                <h3 class="settings-card-title">Training Load Parameters</h3>
                <p class="settings-card-subtitle">Advanced metrics for CTL, ATL, and TSB calculations</p>
              </div>
            </div>
            
            <div class="settings-form-grid">
              <div class="settings-zones-preview">
                <div class="settings-zones-title">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  Training Load Info
                </div>
                <div class="settings-zone-item">
                  <span class="settings-zone-name">CTL Time Constant</span>
                  <span class="settings-zone-range">42 days</span>
                </div>
                <div class="settings-zone-item">
                  <span class="settings-zone-name">ATL Time Constant</span>
                  <span class="settings-zone-range">7 days</span>
                </div>
                <div class="settings-zone-item">
                  <span class="settings-zone-name">TSB Formula</span>
                  <span class="settings-zone-range">CTL - ATL</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Save Button Card -->
          <div class="settings-save-card">
            <div class="settings-save-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                      d="M5 13l4 4L19 7"/>
              </svg>
            </div>
            <div class="settings-save-content">
              <div class="settings-save-title">Save Your Settings</div>
              <div class="settings-save-text">Changes will be applied immediately and update all calculations across the app</div>
            </div>
            <button type="submit" class="settings-save-button" id="saveBtn">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                      d="M5 13l4 4L19 7"/>
              </svg>
              Save Settings
            </button>
          </div>
        </form>
      </div>
    `;
    
    if (typeof feather !== 'undefined') feather.replace();
  }

  renderPowerZones(ftp) {
    const ftpNum = parseFloat(ftp);
    const zones = [
      { name: 'Zone 1 - Active Recovery', min: Math.round(ftpNum * 0.00), max: Math.round(ftpNum * 0.55) },
      { name: 'Zone 2 - Endurance', min: Math.round(ftpNum * 0.56), max: Math.round(ftpNum * 0.75) },
      { name: 'Zone 3 - Tempo', min: Math.round(ftpNum * 0.76), max: Math.round(ftpNum * 0.90) },
      { name: 'Zone 4 - Threshold', min: Math.round(ftpNum * 0.91), max: Math.round(ftpNum * 1.05) },
      { name: 'Zone 5 - VO2Max', min: Math.round(ftpNum * 1.06), max: Math.round(ftpNum * 1.20) },
      { name: 'Zone 6 - Anaerobic', min: Math.round(ftpNum * 1.21), max: Math.round(ftpNum * 1.50) }
    ];

    return `
      <div class="settings-zones-preview">
        <div class="settings-zones-title">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
          </svg>
          Your Power Zones
        </div>
        <div class="settings-zones-list">
          ${zones.map(zone => `
            <div class="settings-zone-item">
              <span class="settings-zone-name">${zone.name}</span>
              <span class="settings-zone-range">${zone.min}-${zone.max}W</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  renderWkgPreview(ftp, weight) {
    return `
      <div class="settings-zones-preview">
        <div class="settings-zones-title">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
          </svg>
          Power-to-Weight Ratio
        </div>
        <div class="settings-zone-item">
          <span class="settings-zone-name">Your FTP per kg</span>
          <span class="settings-zone-range">${(ftp / weight).toFixed(2)} w/kg</span>
        </div>
      </div>
    `;
  }

  renderHRZones(hrMax, hrRest) {
    const hrMaxNum = parseFloat(hrMax);
    const hrRestNum = parseFloat(hrRest);
    const hrReserve = hrMaxNum - hrRestNum;

    const zones = [
      { name: 'Zone 1 - Recovery', min: Math.round(hrRestNum + hrReserve * 0.50), max: Math.round(hrRestNum + hrReserve * 0.60) },
      { name: 'Zone 2 - Aerobic', min: Math.round(hrRestNum + hrReserve * 0.60), max: Math.round(hrRestNum + hrReserve * 0.70) },
      { name: 'Zone 3 - Tempo', min: Math.round(hrRestNum + hrReserve * 0.70), max: Math.round(hrRestNum + hrReserve * 0.80) },
      { name: 'Zone 4 - Threshold', min: Math.round(hrRestNum + hrReserve * 0.80), max: Math.round(hrRestNum + hrReserve * 0.90) },
      { name: 'Zone 5 - Anaerobic', min: Math.round(hrRestNum + hrReserve * 0.90), max: hrMaxNum }
    ];

    return `
      <div class="settings-zones-preview">
        <div class="settings-zones-title">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
          </svg>
          Your Heart Rate Zones
        </div>
        <div class="settings-zones-list">
          ${zones.map(zone => `
            <div class="settings-zone-item">
              <span class="settings-zone-name">${zone.name}</span>
              <span class="settings-zone-range">${zone.min}-${zone.max} bpm</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  setupEventListeners() {
    const form = document.getElementById('settingsForm');
    if (!form) return;
    
    form.addEventListener('submit', (e) => this.handleSubmit(e));

    // Live zone updates - ONLY update preview sections
    const ftpInput = document.getElementById('ftp');
    const weightInput = document.getElementById('weight');
    const hrMaxInput = document.getElementById('hr_max');
    const hrRestInput = document.getElementById('hr_rest');

    ftpInput?.addEventListener('input', (e) => {
      const value = e.target.value;
      const powerZonesContainer = document.getElementById('powerZonesPreview');
      if (powerZonesContainer && value) {
        powerZonesContainer.innerHTML = this.renderPowerZones(value);
      }
      
      // Update w/kg if weight is available
      const weight = weightInput?.value;
      if (weight && value) {
        const wkgContainer = document.getElementById('wkgPreview');
        if (wkgContainer) {
          wkgContainer.innerHTML = this.renderWkgPreview(value, weight);
        }
      }
    });

    weightInput?.addEventListener('input', (e) => {
      const value = e.target.value;
      const ftp = ftpInput?.value;
      
      if (ftp && value) {
        const wkgContainer = document.getElementById('wkgPreview');
        if (wkgContainer) {
          wkgContainer.innerHTML = this.renderWkgPreview(ftp, value);
        }
      }
    });

    hrMaxInput?.addEventListener('input', (e) => {
      const hrMax = e.target.value;
      const hrRest = hrRestInput?.value;
      
      if (hrMax && hrRest) {
        const hrZonesContainer = document.getElementById('hrZonesPreview');
        if (hrZonesContainer) {
          hrZonesContainer.innerHTML = this.renderHRZones(hrMax, hrRest);
        }
      }
    });

    hrRestInput?.addEventListener('input', (e) => {
      const hrRest = e.target.value;
      const hrMax = hrMaxInput?.value;
      
      if (hrMax && hrRest) {
        const hrZonesContainer = document.getElementById('hrZonesPreview');
        if (hrZonesContainer) {
          hrZonesContainer.innerHTML = this.renderHRZones(hrMax, hrRest);
        }
      }
    });
  }

  async handleSubmit(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const settings = {
      ftp: parseFloat(formData.get('ftp')),
      weight: parseFloat(formData.get('weight')),
      hr_max: formData.get('hr_max') ? parseInt(formData.get('hr_max')) : null,
      hr_rest: formData.get('hr_rest') ? parseInt(formData.get('hr_rest')) : null,
      lthr: formData.get('lthr') ? parseInt(formData.get('lthr')) : null
    };
    const displayNameInput = formData.get('display_name');
    const displayName = displayNameInput ? displayNameInput.trim() : '';
    settings.name = displayName || null;
    
    // Validate
    if (!settings.ftp || settings.ftp < 50 || settings.ftp > 600) {
      notify('Please enter a valid FTP (50-600 watts)', 'error');
      return;
    }
    
    if (!settings.weight || settings.weight < 30 || settings.weight > 200) {
      notify('Please enter a valid weight (30-200 kg)', 'error');
      return;
    }
    
    try {
      const saveBtn = document.getElementById('saveBtn');
      saveBtn.disabled = true;
      saveBtn.innerHTML = `
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="animation: spin 1s linear infinite;">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
        </svg>
        Saving...
      `;
      
      const updatedSettings = await Services.data.updateSettings(settings);
      this.settings = { ...this.settings, ...updatedSettings };
      const resolvedName = updatedSettings?.name ?? settings.name ?? null;
      this.persistDisplayName(resolvedName);
      if (window.dashboard?.updateDisplayName) {
        window.dashboard.updateDisplayName(resolvedName);
      }
      
      notify('Settings saved successfully!', 'success');
      Services.analytics.trackEvent('settings_saved', { fields: Object.keys(settings) });
      
      // Clear cache to force refresh
      Services.data.clearCache();
      
      // Update header stats
      if (window.dashboard) {
        await window.dashboard.forceUpdateHeaderStats();
      }
      
      saveBtn.disabled = false;
      saveBtn.innerHTML = `
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
        </svg>
        Save Settings
      `;
      
    } catch (error) {
      console.error('[Settings] Save failed:', error);
      notify('Failed to save settings: ' + error.message, 'error');
      Services.analytics.trackError('settings_save', error.message);
      
      const saveBtn = document.getElementById('saveBtn');
      saveBtn.disabled = false;
      saveBtn.innerHTML = `
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
        </svg>
        Save Settings
      `;
    }
  }

  getDisplayNameValue() {
    if (this.settings?.name) {
      return this.settings.name;
    }
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(DISPLAY_NAME_STORAGE_KEY);
      if (stored && stored.trim()) {
        return stored.trim();
      }
    }
    return '';
  }

  persistDisplayName(name) {
    if (typeof window === 'undefined') return;
    if (name && name.trim()) {
      localStorage.setItem(DISPLAY_NAME_STORAGE_KEY, name.trim());
    } else {
      localStorage.removeItem(DISPLAY_NAME_STORAGE_KEY);
    }
  }

  escapeHtml(text) {
    if (text == null) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  renderLoading() {
    const container = document.getElementById('pageContent') || document.getElementById('page-content');
    if (!container) return;
    
    container.innerHTML = `
      <div class="settings-section">
        <div class="settings-header">
          <h1>Settings</h1>
          <p>Loading your configuration...</p>
        </div>
        <div class="settings-cards-grid">
          ${LoadingSkeleton({ type: 'card', count: 3 })}
        </div>
      </div>
    `;
  }

  renderError(error) {
    const container = document.getElementById('pageContent') || document.getElementById('page-content');
    if (!container) return;
    
    container.innerHTML = ErrorState({
      title: 'Failed to Load Settings',
      message: error.message || 'Unable to load your settings. Please try again.',
      action: `
        <button onclick="window.router.refresh()" class="btn btn-primary">
          <i data-feather="refresh-cw"></i>
          Try Again
        </button>
      `
    });
    
    // Re-initialize feather icons after rendering
    if (typeof feather !== 'undefined') {
      feather.replace();
    }
  }

  onUnload() {
    this.settings = null;
    // Clean up event listener
    if (this.stravaCallbackListener) {
      eventBus.off('strava:callback:complete', this.stravaCallbackListener);
      this.stravaCallbackListener = null;
    }
  }
}

const settingsPage = new SettingsPage();
export default settingsPage;
