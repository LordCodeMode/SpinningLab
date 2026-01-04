import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Services from '../../../static/js/services/index.js';
import { LoadingSkeleton } from '../../../static/js/components/ui/index.js';
import { notify } from '../../../static/js/core/utils.js';
import { eventBus } from '../../../static/js/core/eventBus.js';
import CONFIG from '../../../static/js/pages/settings/config.js';

const DISPLAY_NAME_STORAGE_KEY = CONFIG.DISPLAY_NAME_STORAGE_KEY || 'training_dashboard_display_name';

const buildPowerZones = (ftp) => {
  const ftpNum = Number(ftp);
  if (!Number.isFinite(ftpNum) || ftpNum <= 0) return [];
  return [
    { name: 'Zone 1 - Active Recovery', min: Math.round(ftpNum * 0.0), max: Math.round(ftpNum * 0.55) },
    { name: 'Zone 2 - Endurance', min: Math.round(ftpNum * 0.56), max: Math.round(ftpNum * 0.75) },
    { name: 'Zone 3 - Tempo', min: Math.round(ftpNum * 0.76), max: Math.round(ftpNum * 0.9) },
    { name: 'Zone 4 - Threshold', min: Math.round(ftpNum * 0.91), max: Math.round(ftpNum * 1.05) },
    { name: 'Zone 5 - VO2', min: Math.round(ftpNum * 1.06), max: Math.round(ftpNum * 1.2) },
    { name: 'Zone 6 - Anaerobic', min: Math.round(ftpNum * 1.21), max: Math.round(ftpNum * 1.5) }
  ];
};

const buildHrZones = (hrMax, hrRest) => {
  const hrMaxNum = Number(hrMax);
  const hrRestNum = Number(hrRest);
  if (!Number.isFinite(hrMaxNum) || !Number.isFinite(hrRestNum)) return [];
  const hrReserve = hrMaxNum - hrRestNum;
  return [
    { name: 'Zone 1 - Recovery', min: Math.round(hrRestNum + hrReserve * 0.5), max: Math.round(hrRestNum + hrReserve * 0.6) },
    { name: 'Zone 2 - Aerobic', min: Math.round(hrRestNum + hrReserve * 0.6), max: Math.round(hrRestNum + hrReserve * 0.7) },
    { name: 'Zone 3 - Tempo', min: Math.round(hrRestNum + hrReserve * 0.7), max: Math.round(hrRestNum + hrReserve * 0.8) },
    { name: 'Zone 4 - Threshold', min: Math.round(hrRestNum + hrReserve * 0.8), max: Math.round(hrRestNum + hrReserve * 0.9) },
    { name: 'Zone 5 - Anaerobic', min: Math.round(hrRestNum + hrReserve * 0.9), max: Math.round(hrMaxNum) }
  ];
};

const extractStravaParams = () => {
  if (window.location.search && window.location.search.length > 1) {
    return new URLSearchParams(window.location.search);
  }
  if (window.location.hash && window.location.hash.includes('?')) {
    const [, query] = window.location.hash.split('?');
    return new URLSearchParams(query);
  }
  return new URLSearchParams();
};

const SettingsApp = () => {
  const [settings, setSettings] = useState(null);
  const [stravaStatus, setStravaStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [syncState, setSyncState] = useState('idle');

  const [form, setForm] = useState({
    display_name: '',
    ftp: '',
    weight: '',
    hr_max: '',
    hr_rest: '',
    lthr: ''
  });

  const loadStravaStatus = useCallback(async () => {
    try {
      const response = await Services.api.getStravaStatus();
      setStravaStatus(response);
    } catch (err) {
      console.error('[Settings] Failed to load Strava status:', err);
      setStravaStatus({ connected: false });
    }
  }, []);

  const handleStravaCallback = useCallback(async () => {
    const urlParams = extractStravaParams();
    const code = urlParams.get('code');
    const scope = urlParams.get('scope');

    if (code && scope) {
      try {
        notify('Connecting to Strava...', 'info');
        const response = await Services.api.stravaCallback(code);
        if (response.success) {
          notify(`Connected to Strava as ${response.athlete.firstname} ${response.athlete.lastname}!`, 'success');
          const [hashPath] = window.location.hash.split('?');
          window.history.replaceState({}, document.title, `${window.location.pathname}${hashPath || ''}`);
          await loadStravaStatus();
        }
      } catch (err) {
        console.error('[Settings] Strava callback error:', err);
        notify(`Failed to connect to Strava: ${err.message}`, 'error');
      }
    }
  }, [loadStravaStatus]);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      Services.analytics.trackPageView('settings');
      const response = await Services.data.getSettings();
      const displayName = response?.name || localStorage.getItem(DISPLAY_NAME_STORAGE_KEY) || '';
      setSettings(response || {});
      setForm({
        display_name: displayName,
        ftp: response?.ftp ?? '',
        weight: response?.weight ?? '',
        hr_max: response?.hr_max ?? '',
        hr_rest: response?.hr_rest ?? '',
        lthr: response?.lthr ?? ''
      });
      await loadStravaStatus();
      await handleStravaCallback();
    } catch (err) {
      console.error('[Settings] Load error:', err);
      setError(err?.message || 'Unable to load your settings.');
    } finally {
      setLoading(false);
    }
  }, [handleStravaCallback, loadStravaStatus]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    const listener = async () => {
      await loadStravaStatus();
    };
    eventBus.on('strava:callback:complete', listener);
    return () => {
      eventBus.off('strava:callback:complete', listener);
    };
  }, [loadStravaStatus]);

  useEffect(() => {
    if (typeof feather !== 'undefined') feather.replace();
  }, [loading, stravaStatus, settings]);

  const handleChange = (field) => (event) => {
    setForm((prev) => ({
      ...prev,
      [field]: event.target.value
    }));
  };

  const persistDisplayName = (name) => {
    if (!name || !name.trim()) {
      localStorage.removeItem(DISPLAY_NAME_STORAGE_KEY);
      return;
    }
    localStorage.setItem(DISPLAY_NAME_STORAGE_KEY, name.trim());
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const ftpValue = parseFloat(form.ftp);
    const weightValue = parseFloat(form.weight);

    if (!ftpValue || ftpValue < 50 || ftpValue > 600) {
      notify('Please enter a valid FTP (50-600 watts).', 'error');
      return;
    }

    if (!weightValue || weightValue < 30 || weightValue > 200) {
      notify('Please enter a valid weight (30-200 kg).', 'error');
      return;
    }

    const payload = {
      ftp: ftpValue,
      weight: weightValue,
      hr_max: form.hr_max ? parseInt(form.hr_max, 10) : null,
      hr_rest: form.hr_rest ? parseInt(form.hr_rest, 10) : null,
      lthr: form.lthr ? parseInt(form.lthr, 10) : null,
      name: form.display_name ? form.display_name.trim() : null
    };

    try {
      setSaving(true);
      const updatedSettings = await Services.data.updateSettings(payload);
      setSettings((prev) => ({ ...prev, ...updatedSettings }));
      const resolvedName = updatedSettings?.name ?? payload.name ?? null;
      persistDisplayName(resolvedName);
      if (window.dashboard?.updateDisplayName) {
        window.dashboard.updateDisplayName(resolvedName);
      }
      notify('Settings saved successfully!', 'success');
      Services.analytics.trackEvent('settings_saved', { fields: Object.keys(payload) });
      Services.data.clearCache();
      if (window.dashboard) {
        await window.dashboard.forceUpdateHeaderStats();
      }
    } catch (err) {
      console.error('[Settings] Save failed:', err);
      notify(`Failed to save settings: ${err.message}`, 'error');
      Services.analytics.trackError('settings_save', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleStravaConnect = async () => {
    try {
      const response = await Services.api.getStravaConnectUrl();
      if (response.authorization_url) {
        localStorage.setItem('strava_return_url', window.location.href);
        window.location.href = response.authorization_url;
      }
    } catch (err) {
      console.error('[Settings] Strava connect error:', err);
      notify(`Failed to connect to Strava: ${err.message}`, 'error');
    }
  };

  const handleStravaDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect from Strava? Your imported activities will not be deleted.')) {
      return;
    }

    try {
      await Services.api.disconnectStrava();
      notify('Disconnected from Strava', 'success');
      await loadStravaStatus();
    } catch (err) {
      console.error('[Settings] Strava disconnect error:', err);
      notify(`Failed to disconnect from Strava: ${err.message}`, 'error');
    }
  };

  const handleStravaSync = async () => {
    if (syncState === 'syncing') return;
    try {
      setSyncState('syncing');
      const result = await Services.api.syncStravaActivities();
      notify(result.message, 'success');
      Services.data.clearCache();
      if (window.dashboard) {
        await window.dashboard.forceUpdateHeaderStats();
      }
      setSyncState('success');
      setTimeout(() => setSyncState('idle'), 3000);
    } catch (err) {
      console.error('[Settings] Strava sync error:', err);
      notify(`Sync failed: ${err.message}`, 'error');
      setSyncState('idle');
    }
  };

  const powerZones = useMemo(() => buildPowerZones(form.ftp), [form.ftp]);
  const hrZones = useMemo(() => buildHrZones(form.hr_max, form.hr_rest), [form.hr_max, form.hr_rest]);
  const wkg = useMemo(() => {
    const ftpValue = parseFloat(form.ftp);
    const weightValue = parseFloat(form.weight);
    if (!Number.isFinite(ftpValue) || !Number.isFinite(weightValue) || weightValue === 0) return null;
    return (ftpValue / weightValue).toFixed(2);
  }, [form.ftp, form.weight]);

  const completion = useMemo(() => {
    const fields = [form.ftp, form.weight, form.hr_max, form.hr_rest, form.lthr];
    const filled = fields.filter((value) => value !== '' && value != null).length;
    return Math.round((filled / fields.length) * 100);
  }, [form.ftp, form.weight, form.hr_max, form.hr_rest, form.lthr]);

  const syncLabel = syncState === 'syncing'
    ? 'Syncing...'
    : syncState === 'success'
      ? 'Sync Complete!'
      : 'Sync Activities from Strava';

  if (loading) {
    return (
      <div className="settings-shell">
        <div className="settings-hero">
          <div className="settings-hero__eyebrow">Performance calibration</div>
          <h1 className="settings-hero__title">Settings Studio</h1>
          <p className="settings-hero__subtitle">Loading your configuration...</p>
        </div>
        <div className="settings-cards-grid">
          <div dangerouslySetInnerHTML={{ __html: LoadingSkeleton({ type: 'card', count: 3 }) }} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="settings-shell">
        <div className="settings-hero">
          <div className="settings-hero__eyebrow">Performance calibration</div>
          <h1 className="settings-hero__title">Settings Studio</h1>
          <p className="settings-hero__subtitle">We could not load your settings.</p>
        </div>
        <div className="settings-error">
          <h3>Failed to Load Settings</h3>
          <p>{error}</p>
          <button type="button" className="settings-save-button" onClick={() => loadSettings()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const accountEmail = settings?.email || '';

  return (
    <div className="settings-shell">
      <header className="settings-hero">
        <div className="settings-hero__eyebrow">Performance calibration</div>
        <h1 className="settings-hero__title">Settings Studio</h1>
        <p className="settings-hero__subtitle">Tune your profile and training inputs so every chart, zone, and insight stays accurate.</p>
        <div className="settings-hero__chips">
          <span className="settings-chip">FTP {form.ftp || '--'} W</span>
          <span className="settings-chip">Weight {form.weight || '--'} kg</span>
          <span className="settings-chip">HR Max {form.hr_max || '--'} bpm</span>
          <span className="settings-chip">LTHR {form.lthr || '--'} bpm</span>
        </div>
        <div className="settings-hero__note">
          <strong>Why these settings matter:</strong> FTP and weight drive power zones and w/kg, while heart-rate metrics keep training load and intensity tracking precise.
        </div>
      </header>

      <div className="settings-layout">
        <form className="settings-main settings-cards-grid" onSubmit={handleSubmit}>
          <section className="settings-card">
            <div className="settings-card-header">
              <div className="settings-card-icon profile">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.121 17.804A7 7 0 0112 15h0a7 7 0 016.879 2.804M15 11a3 3 0 10-6 0 3 3 0 006 0z" />
                </svg>
              </div>
              <div className="settings-card-title-group">
                <h3 className="settings-card-title">Profile</h3>
                <p className="settings-card-subtitle">Control how your name appears across the dashboard</p>
              </div>
            </div>

            <div className="settings-form-grid">
              <div className="settings-field">
                <label className="settings-field-label" htmlFor="display_name">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.121 17.804A7 7 0 0112 15h0a7 7 0 016.879 2.804M15 11a3 3 0 10-6 0 3 3 0 006 0z" />
                  </svg>
                  Display Name
                </label>
                <input
                  type="text"
                  id="display_name"
                  name="display_name"
                  value={form.display_name}
                  className="settings-field-input"
                  maxLength={100}
                  placeholder="Max Hartwig"
                  autoComplete="name"
                  onChange={handleChange('display_name')}
                />
                <div className="settings-field-help">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Shown in the sidebar footer and Overview welcome banner.
                </div>
              </div>

              <div className="settings-field">
                <label className="settings-field-label" htmlFor="account_email">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8m0 8v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h14a2 2 0 002-2z" />
                  </svg>
                  Account Email
                </label>
                <input
                  type="text"
                  id="account_email"
                  className="settings-field-input"
                  value={accountEmail}
                  readOnly
                />
                <div className="settings-field-help">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Used for login and account recovery.
                </div>
              </div>
            </div>
          </section>

          <section className="settings-card">
            <div className="settings-card-header">
              <div className="settings-card-icon strava-icon">
                <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <rect width="64" height="64" rx="12" fill="#fc4c02" />
                  <path fill="#ffffff" d="M32 6 L17 36 H28 L32 26 L36 36 H47 Z" />
                  <path fill="#ffb08a" d="M36 30 L27 50 H36 L32 58 L46 30 Z" />
                </svg>
              </div>
              <div className="settings-card-title-group">
                <h3 className="settings-card-title">Strava Integration</h3>
                <p className="settings-card-subtitle">Auto-import activities from Strava with full power and HR data</p>
              </div>
            </div>

            <div className="settings-form-grid">
              {stravaStatus?.connected ? (
                <div className="settings-strava-connected">
                  <div className="settings-strava-status">
                    <div>
                      <div className="settings-strava-title">Connected to Strava</div>
                      <div className="settings-strava-meta">Athlete ID: {stravaStatus.athlete_id}</div>
                    </div>
                    <span className="settings-chip settings-chip--success">Active</span>
                  </div>
                  <div className="settings-form-row">
                    <button type="button" className="settings-save-button" onClick={handleStravaSync} disabled={syncState === 'syncing'}>
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className={syncState === 'syncing' ? 'settings-spin' : ''}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      {syncLabel}
                    </button>
                    <button type="button" className="settings-button-secondary" onClick={handleStravaDisconnect}>
                      Disconnect
                    </button>
                  </div>
                  <div className="settings-field-help">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Sync automatically imports activities with power, HR, cadence, and zones.
                  </div>
                </div>
              ) : (
                <div className="settings-strava-disconnected">
                  <div className="settings-strava-empty">
                    <div>
                      <h4>Not Connected</h4>
                      <p>Connect Strava to import rides automatically.</p>
                    </div>
                    <button type="button" className="settings-save-button" onClick={handleStravaConnect}>
                      Connect with Strava
                    </button>
                  </div>
                  <div className="settings-zones-preview">
                    <div className="settings-zones-title">Benefits of Strava Integration</div>
                    <div className="settings-zone-item">
                      <span className="settings-zone-name">Auto-import</span>
                      <span className="settings-zone-range">No manual FIT uploads</span>
                    </div>
                    <div className="settings-zone-item">
                      <span className="settings-zone-name">Full data</span>
                      <span className="settings-zone-range">Power, HR, cadence streams</span>
                    </div>
                    <div className="settings-zone-item">
                      <span className="settings-zone-name">Instant analysis</span>
                      <span className="settings-zone-range">Curves, zones, and insights</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="settings-card">
            <div className="settings-card-header">
              <div className="settings-card-icon power">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="settings-card-title-group">
                <h3 className="settings-card-title">Power Settings</h3>
                <p className="settings-card-subtitle">Configure FTP and power calibration inputs</p>
              </div>
            </div>

            <div className="settings-form-grid">
              <div className="settings-field">
                <label className="settings-field-label" htmlFor="ftp">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  FTP (Functional Threshold Power)
                </label>
                <div className="settings-field-suffix">
                  <input
                    type="number"
                    id="ftp"
                    name="ftp"
                    value={form.ftp}
                    className="settings-field-input"
                    placeholder="250"
                    min="50"
                    max="600"
                    step="1"
                    onChange={handleChange('ftp')}
                    required
                  />
                  <div className="settings-field-unit">watts</div>
                </div>
                <div className="settings-field-help">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Your 1-hour maximum sustainable power output.
                </div>
              </div>
            </div>
          </section>

          <section className="settings-card">
            <div className="settings-card-header">
              <div className="settings-card-icon body">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div className="settings-card-title-group">
                <h3 className="settings-card-title">Physical Parameters</h3>
                <p className="settings-card-subtitle">Body measurements for w/kg calculations</p>
              </div>
            </div>

            <div className="settings-form-grid">
              <div className="settings-field">
                <label className="settings-field-label" htmlFor="weight">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                  </svg>
                  Body Weight
                </label>
                <div className="settings-field-suffix">
                  <input
                    type="number"
                    id="weight"
                    name="weight"
                    value={form.weight}
                    className="settings-field-input"
                    placeholder="70"
                    min="30"
                    max="200"
                    step="0.1"
                    onChange={handleChange('weight')}
                    required
                  />
                  <div className="settings-field-unit">kg</div>
                </div>
                <div className="settings-field-help">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Used to calculate watts per kilogram for relative power metrics.
                </div>
              </div>
            </div>
          </section>

          <section className="settings-card">
            <div className="settings-card-header">
              <div className="settings-card-icon heart">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <div className="settings-card-title-group">
                <h3 className="settings-card-title">Heart Rate Zones</h3>
                <p className="settings-card-subtitle">Configure maximum, resting, and threshold heart rate</p>
              </div>
            </div>

            <div className="settings-form-grid">
              <div className="settings-form-row">
                <div className="settings-field">
                  <label className="settings-field-label" htmlFor="hr_max">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    Maximum Heart Rate
                  </label>
                  <div className="settings-field-suffix">
                    <input
                      type="number"
                      id="hr_max"
                      name="hr_max"
                      value={form.hr_max}
                      className="settings-field-input"
                      placeholder="190"
                      min="120"
                      max="220"
                      step="1"
                      onChange={handleChange('hr_max')}
                    />
                    <div className="settings-field-unit">bpm</div>
                  </div>
                  <div className="settings-field-help">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Highest heart rate achieved during max effort.
                  </div>
                </div>

                <div className="settings-field">
                  <label className="settings-field-label" htmlFor="hr_rest">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" />
                    </svg>
                    Resting Heart Rate
                  </label>
                  <div className="settings-field-suffix">
                    <input
                      type="number"
                      id="hr_rest"
                      name="hr_rest"
                      value={form.hr_rest}
                      className="settings-field-input"
                      placeholder="60"
                      min="30"
                      max="100"
                      step="1"
                      onChange={handleChange('hr_rest')}
                    />
                    <div className="settings-field-unit">bpm</div>
                  </div>
                  <div className="settings-field-help">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Heart rate when completely at rest.
                  </div>
                </div>
              </div>

              <div className="settings-field">
                <label className="settings-field-label" htmlFor="lthr">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Lactate Threshold HR (LTHR)
                </label>
                <div className="settings-field-suffix">
                  <input
                    type="number"
                    id="lthr"
                    name="lthr"
                    value={form.lthr}
                    className="settings-field-input"
                    placeholder="170"
                    min="100"
                    max="210"
                    step="1"
                    onChange={handleChange('lthr')}
                  />
                  <div className="settings-field-unit">bpm</div>
                </div>
                <div className="settings-field-help">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Heart rate at lactate threshold (1-hour max effort).
                </div>
              </div>
            </div>
          </section>

          <div className="settings-save-card">
            <div className="settings-save-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="settings-save-content">
              <div className="settings-save-title">Save Your Settings</div>
              <div className="settings-save-text">Changes apply immediately and refresh all calculations.</div>
            </div>
            <button type="submit" className="settings-save-button" disabled={saving}>
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className={saving ? 'settings-spin' : ''}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>

        <aside className="settings-side">
          <div className="settings-side-card">
            <div className="settings-side-header">
              <h3>Calibration Snapshot</h3>
              <span className="settings-chip settings-chip--muted">{completion}% complete</span>
            </div>
            <div className="settings-metric-grid">
              <div className="settings-metric">
                <span>FTP</span>
                <strong>{form.ftp || '--'} W</strong>
              </div>
              <div className="settings-metric">
                <span>Weight</span>
                <strong>{form.weight || '--'} kg</strong>
              </div>
              <div className="settings-metric">
                <span>W/kg</span>
                <strong>{wkg || '--'}</strong>
              </div>
              <div className="settings-metric">
                <span>HR Max</span>
                <strong>{form.hr_max || '--'} bpm</strong>
              </div>
              <div className="settings-metric">
                <span>LTHR</span>
                <strong>{form.lthr || '--'} bpm</strong>
              </div>
            </div>
            <div className="settings-progress">
              <div className="settings-progress__label">Profile readiness</div>
              <div className="settings-progress__track">
                <div className="settings-progress__fill" style={{ width: `${completion}%` }}></div>
              </div>
            </div>
          </div>

          {powerZones.length > 0 && (
            <div className="settings-side-card">
              <div className="settings-side-header">
                <h3>Power Zones</h3>
                <span className="settings-chip">FTP {form.ftp}W</span>
              </div>
              <div className="settings-zones-list">
                {powerZones.map((zone) => (
                  <div key={zone.name} className="settings-zone-item">
                    <span className="settings-zone-name">{zone.name}</span>
                    <span className="settings-zone-range">{zone.min}-{zone.max}W</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {hrZones.length > 0 && (
            <div className="settings-side-card">
              <div className="settings-side-header">
                <h3>Heart Rate Zones</h3>
                <span className="settings-chip">HR Max {form.hr_max} bpm</span>
              </div>
              <div className="settings-zones-list">
                {hrZones.map((zone) => (
                  <div key={zone.name} className="settings-zone-item">
                    <span className="settings-zone-name">{zone.name}</span>
                    <span className="settings-zone-range">{zone.min}-{zone.max} bpm</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="settings-side-card">
            <div className="settings-side-header">
              <h3>Training Load Rules</h3>
            </div>
            <div className="settings-zones-list">
              <div className="settings-zone-item">
                <span className="settings-zone-name">CTL Time Constant</span>
                <span className="settings-zone-range">42 days</span>
              </div>
              <div className="settings-zone-item">
                <span className="settings-zone-name">ATL Time Constant</span>
                <span className="settings-zone-range">7 days</span>
              </div>
              <div className="settings-zone-item">
                <span className="settings-zone-name">TSB Formula</span>
                <span className="settings-zone-range">CTL - ATL</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default SettingsApp;
