// /static/js/coordinator/pages/best-power.js
import { AnalysisAPI, API } from '../../core/api.js';

export const bestPowerPage = {
  _chart: null,
  _data: null,

  async load() {
    console.log('[BestPower] ===== STARTING LOAD =====');
    const root = document.getElementById('page-content');
    root.innerHTML = `<div class="loading" style="padding:80px; text-align:center;"><div style="width:48px; height:48px; border:4px solid var(--border); border-top-color:var(--primary); border-radius:50%; margin:0 auto 24px; animation:spin 1s linear infinite;"></div>Loading best power values...</div><style>@keyframes spin { to { transform: rotate(360deg); } }</style>`;

    try {
      console.log('[BestPower] Fetching data from API...');
      this._data = await AnalysisAPI.getBestPowerValues();
      console.log('[BestPower] API Response:', this._data);
      
      if (!this._data) {
        console.error('[BestPower] ❌ No data returned from API (null/undefined)');
        this.showEmptyState(root);
        return;
      }

      console.log('[BestPower] Checking if data has power values...');
      const hasPower = this._hasAnyPowerData(this._data);
      console.log('[BestPower] Has power data:', hasPower);
      
      if (!hasPower) {
        console.warn('[BestPower] ⚠️ No power data found in response');
        this.showEmptyState(root);
        return;
      }

      console.log('[BestPower] ✅ Data is valid, rendering template...');
      root.innerHTML = this.template();
      
      console.log('[BestPower] Updating metrics...');
      this._updateMetrics();
      
      console.log('[BestPower] Setting up controls...');
      this._setupControls();
      
      console.log('[BestPower] Rendering chart...');
      this._renderChart();
      
      console.log('[BestPower] ✅ Load complete');

    } catch (err) {
      console.error('[BestPower] ❌ Load error:', err);
      console.error('[BestPower] Error stack:', err.stack);
      root.innerHTML = `<div style="padding:80px; text-align:center;"><h3>Error Loading Best Power</h3><p>${err.message}</p></div>`;
    }
  },

  _hasAnyPowerData(data) {
    const keys = ['max_1min_power', 'max_3min_power', 'max_5min_power', 'max_10min_power', 'max_20min_power', 'max_30min_power', 'max_60min_power'];
    return keys.some(k => data[k] != null && data[k] > 0);
  },

  showEmptyState(root) {
    console.log('[BestPower] Showing empty state');
    root.innerHTML = `
      <div style="padding:80px; text-align:center; color:var(--text-muted);">
        <svg style="width:80px; height:80px; opacity:0.3; margin:0 auto 24px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
        </svg>
        <h3 style="font-size:20px; font-weight:600; color:var(--text); margin-bottom:12px;">No Power Data Available</h3>
        <p>Upload activities with power data to see your best efforts across different durations.</p>
      </div>
    `;
  },

  template() {
    return `
      <style>
        .bp-section { display:grid; gap:20px; }
        .bp-header { margin-bottom:8px; }
        .bp-header h1 { 
          font-size:32px; font-weight:700; color:var(--text); 
          margin:0 0 6px 0; letter-spacing:-0.02em;
        }
        .bp-header p { 
          color:var(--text-muted); font-size:14px; line-height:1.5; 
        }
        
        .metrics-grid {
          display:grid; 
          grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); 
          gap:16px;
        }
        .metric-card {
          background:#ffffff;
          border:2px solid #d1d5db;
          border-radius:var(--radius);
          padding:24px;
          box-shadow:var(--shadow);
          transition:all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position:relative;
          overflow:hidden;
          cursor:pointer;
        }
        .metric-card::before {
          content:'';
          position:absolute;
          top:0;
          right:0;
          width:80px;
          height:80px;
          background:radial-gradient(circle at center, rgba(251,191,36,0.08) 0%, transparent 70%);
          border-radius:50%;
          transform:translate(30%, -30%);
          transition:all 0.3s ease;
        }
        .metric-card:hover {
          transform:translateY(-6px);
          box-shadow:0 12px 28px rgba(0,0,0,0.15);
        }
        
        .metric-card:nth-child(1):hover {
          border-color:#fbbf24;
          box-shadow:0 12px 28px rgba(251,191,36,0.2), 0 0 0 1px #fbbf24;
        }
        
        .metric-card:nth-child(2):hover {
          border-color:#f97316;
          box-shadow:0 12px 28px rgba(249,115,22,0.2), 0 0 0 1px #f97316;
        }
        
        .metric-card:nth-child(3):hover {
          border-color:#ef4444;
          box-shadow:0 12px 28px rgba(239,68,68,0.2), 0 0 0 1px #ef4444;
        }
        
        .metric-card:hover::before {
          transform:translate(30%, -30%) scale(1.3);
          opacity:0.6;
        }
        
        .metric-header-row {
          display:flex;
          align-items:center;
          gap:10px;
          margin-bottom:14px;
        }
        .metric-icon {
          width:36px;
          height:36px;
          border-radius:8px;
          display:flex;
          align-items:center;
          justify-content:center;
          flex-shrink:0;
          transition:all 0.3s ease;
        }
        
        .metric-card:hover .metric-icon {
          transform:scale(1.1) rotate(5deg);
        }
        
        .metric-icon svg { width:20px; height:20px; }
        .metric-icon.yellow { background:rgba(251,191,36,0.15); color:#fbbf24; }
        .metric-icon.orange { background:rgba(249,115,22,0.15); color:#f97316; }
        .metric-icon.red { background:rgba(239,68,68,0.15); color:#ef4444; }
        
        .metric-label { 
          font-size:13px; font-weight:700; color:var(--text-muted); 
          text-transform:uppercase; letter-spacing:0.5px;
        }
        .metric-value { 
          font-size:42px; font-weight:800; color:var(--text); line-height:1; 
          margin:10px 0; position:relative; z-index:1;
        }
        .metric-subtitle { 
          font-size:13px; color:var(--text-muted); font-weight:500; 
        }
        
        .chart-card {
          background:#ffffff;
          border:2px solid #d1d5db;
          border-radius:var(--radius);
          padding:24px;
          box-shadow:var(--shadow);
          transition:all 0.3s ease;
        }
        .chart-card:hover {
          border-color:#fbbf24;
          box-shadow:0 8px 24px rgba(251,191,36,0.15), 0 0 0 1px #fbbf24;
        }
        
        .chart-header { 
          display:flex; justify-content:space-between; align-items:start; 
          margin-bottom:20px; flex-wrap:wrap; gap:16px;
        }
        .chart-header-content { flex:1; }
        .chart-title-row {
          display:flex; align-items:center; gap:12px; margin-bottom:6px;
        }
        .chart-icon {
          width:40px; height:40px; border-radius:10px;
          background:linear-gradient(135deg, rgba(251,191,36,0.15) 0%, rgba(249,115,22,0.15) 100%);
          display:flex; align-items:center; justify-content:center;
          flex-shrink:0;
          transition:all 0.3s ease;
        }
        
        .chart-card:hover .chart-icon {
          transform:scale(1.05);
        }
        
        .chart-icon svg { width:22px; height:22px; color:#fbbf24; }
        .chart-title { 
          font-size:20px; font-weight:700; color:var(--text); 
          letter-spacing:-0.02em;
        }
        .chart-subtitle { 
          font-size:13px; color:var(--text-muted); line-height:1.4; 
        }
        
        .chart-controls {
          display:flex; gap:12px; flex-wrap:wrap; align-items:center;
        }
        .chart-controls .toggle-label { 
          display:flex; align-items:center; gap:8px; cursor:pointer;
          padding:8px 12px; border-radius:8px; transition:background 0.15s;
          font-size:13px; font-weight:600; color:var(--text);
        }
        .chart-controls .toggle-label:hover { background:var(--bg); }
        .chart-controls input[type="checkbox"] {
          width:16px; height:16px; accent-color:#fbbf24; cursor:pointer;
        }
        
        .chart-container { 
          position:relative; height:400px; margin-top:8px; 
        }
        
        .info-grid { 
          display:grid; grid-template-columns:1fr 1fr; gap:20px; 
        }
        @media (max-width: 1024px) { 
          .info-grid { grid-template-columns:1fr; } 
        }
        
        .info-card {
          background:#ffffff;
          border:2px solid #d1d5db;
          border-radius:var(--radius);
          padding:24px;
          box-shadow:var(--shadow);
          transition:all 0.3s ease;
        }
        .info-card:hover {
          border-color:#fbbf24;
          box-shadow:0 8px 24px rgba(251,191,36,0.15), 0 0 0 1px #fbbf24;
        }
        .info-card-header {
          display:flex; align-items:center; gap:12px; margin-bottom:16px;
          padding-bottom:14px; border-bottom:2px solid var(--border);
        }
        .info-card-icon {
          width:40px; height:40px; border-radius:10px;
          background:rgba(251,191,36,0.15);
          display:flex; align-items:center; justify-content:center;
          color:#fbbf24; flex-shrink:0;
        }
        .info-card-icon svg { width:22px; height:22px; }
        .info-card-title { 
          font-size:17px; font-weight:700; color:var(--text); 
          letter-spacing:-0.02em;
        }
        
        .duration-grid { display:grid; gap:10px; }
        .duration-item {
          display:flex; align-items:center; justify-content:space-between;
          padding:12px 14px; border-radius:8px; background:var(--bg);
          border:1px solid var(--border-light); transition:all 0.2s;
          cursor:pointer;
        }
        .duration-item:hover { 
          background:var(--bg-secondary); border-color:var(--border); 
          transform:translateX(4px);
        }
        .duration-item.active {
          background:linear-gradient(135deg, rgba(251,191,36,0.1) 0%, rgba(249,115,22,0.1) 100%);
          border-color:#fbbf24;
        }
        .duration-label { 
          font-size:14px; font-weight:600; color:var(--text); 
        }
        .duration-value { 
          font-size:15px; color:var(--text); font-weight:700;
        }
        
        .factor-list { display:grid; gap:10px; }
        .factor-item {
          display:flex; align-items:start; gap:10px;
          padding:10px; border-radius:6px; background:var(--bg);
        }
        .factor-icon {
          width:20px; height:20px; flex-shrink:0; margin-top:2px;
        }
        .factor-icon svg { width:100%; height:100%; color:#fbbf24; }
        .factor-content { flex:1; }
        .factor-title { 
          font-size:13px; font-weight:600; color:var(--text); 
          margin-bottom:2px;
        }
        .factor-text { 
          font-size:12px; color:var(--text-muted); line-height:1.4; 
        }
        
        .bp-insight {
          background:linear-gradient(135deg, rgba(251,191,36,0.1) 0%, rgba(249,115,22,0.1) 100%);
          border:1.5px solid #fbbf24; border-radius:12px; padding:18px;
          display:flex; gap:14px; margin-top:16px;
        }
        .bp-insight svg {
          width:24px; height:24px; color:#fbbf24; flex-shrink:0; margin-top:2px;
        }
        .bp-insight-content { flex:1; }
        .bp-insight-title {
          font-weight:700; font-size:15px; color:var(--text); margin-bottom:6px;
        }
        .bp-insight-text {
          font-size:13px; color:var(--text-muted); line-height:1.6;
        }
        
        @media (max-width: 640px) {
          .metrics-grid { grid-template-columns:repeat(2, 1fr); }
        }
      </style>

      <div class="bp-section">
        <div class="bp-header">
          <h1>Best Power Values</h1>
          <p>Your peak power outputs across different durations</p>
        </div>

        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-header-row">
              <div class="metric-icon yellow">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                </svg>
              </div>
              <div class="metric-label">Best Power</div>
            </div>
            <div class="metric-value" id="bp-power">–</div>
            <div class="metric-subtitle">Watts</div>
          </div>
          
          <div class="metric-card">
            <div class="metric-header-row">
              <div class="metric-icon orange">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"/>
                </svg>
              </div>
              <div class="metric-label">Power to Weight</div>
            </div>
            <div class="metric-value" id="bp-wkg">–</div>
            <div class="metric-subtitle">W/kg</div>
          </div>
          
          <div class="metric-card">
            <div class="metric-header-row">
              <div class="metric-icon red">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <div class="metric-label">Duration</div>
            </div>
            <div class="metric-value" id="bp-duration" style="font-size:34px;">–</div>
            <div class="metric-subtitle">Selected</div>
          </div>
        </div>

        <div class="chart-card">
          <div class="chart-header">
            <div class="chart-header-content">
              <div class="chart-title-row">
                <div class="chart-icon">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                  </svg>
                </div>
                <div>
                  <div class="chart-title">Power Curve</div>
                  <div class="chart-subtitle">Best efforts across all durations</div>
                </div>
              </div>
            </div>
            <div class="chart-controls">
              <label class="toggle-label">
                <input type="checkbox" id="bp-show-wkg">
                <span>Show W/kg</span>
              </label>
            </div>
          </div>
          <div class="chart-container">
            <canvas id="bp-chart" aria-label="Best power curve"></canvas>
          </div>
        </div>

        <div class="info-grid">
          <div class="info-card">
            <div class="info-card-header">
              <div class="info-card-icon">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <div>
                <div class="info-card-title">Duration Breakdown</div>
              </div>
            </div>
            <div class="duration-grid" id="bp-durations"></div>
            
            <div class="bp-insight">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <div class="bp-insight-content">
                <div class="bp-insight-title">What is Best Power?</div>
                <div class="bp-insight-text">
                  Best power values show your peak outputs for specific durations. These help identify your strengths and target areas for improvement in your power profile.
                </div>
              </div>
            </div>
          </div>

          <div class="info-card">
            <div class="info-card-header">
              <div class="info-card-icon">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                </svg>
              </div>
              <div>
                <div class="info-card-title">Improvement Strategies</div>
              </div>
            </div>
            <div class="factor-list">
              <div class="factor-item">
                <div class="factor-icon">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                  </svg>
                </div>
                <div class="factor-content">
                  <div class="factor-title">Sprint Intervals</div>
                  <div class="factor-text">Short, maximal efforts (10-30s) develop neuromuscular power and peak output</div>
                </div>
              </div>
              <div class="factor-item">
                <div class="factor-icon">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </div>
                <div class="factor-content">
                  <div class="factor-title">Threshold Work</div>
                  <div class="factor-text">Sustained efforts at lactate threshold improve longer duration power</div>
                </div>
              </div>
              <div class="factor-item">
                <div class="factor-icon">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                  </svg>
                </div>
                <div class="factor-content">
                  <div class="factor-title">Recovery Balance</div>
                  <div class="factor-text">Adequate rest between hard sessions allows adaptation and prevents overtraining</div>
                </div>
              </div>
              <div class="factor-item">
                <div class="factor-icon">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"/>
                  </svg>
                </div>
                <div class="factor-content">
                  <div class="factor-title">Strength Training</div>
                  <div class="factor-text">Off-bike strength work enhances force production and power capacity</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  _setupControls() {
    console.log('[BestPower] _setupControls called');
    
    const wkgToggle = document.getElementById('bp-show-wkg');
    if (wkgToggle) {
      console.log('[BestPower] W/kg toggle found, attaching listener');
      wkgToggle.addEventListener('change', () => {
        console.log('[BestPower] W/kg toggle changed');
        this._updateMetrics();
        this._renderChart();
      });
    } else {
      console.warn('[BestPower] W/kg toggle not found');
    }
  },

  _updateMetrics(selectedKey = 'max_5min_power') {
    console.log('[BestPower] _updateMetrics called with key:', selectedKey);
    
    const durationMap = {
      max_1min_power: '1 min',
      max_3min_power: '3 min',
      max_5min_power: '5 min',
      max_10min_power: '10 min',
      max_20min_power: '20 min',
      max_30min_power: '30 min',
      max_60min_power: '60 min'
    };

    const value = this._data[selectedKey];
    const weight = this._data.weight || 70;
    const wkg = value ? (value / weight) : null;
    const showWkg = document.getElementById('bp-show-wkg')?.checked || false;

    console.log('[BestPower] Metrics:', { value, weight, wkg, showWkg });

    const powerEl = document.getElementById('bp-power');
    const wkgEl = document.getElementById('bp-wkg');
    const durationEl = document.getElementById('bp-duration');

    if (powerEl) {
      powerEl.textContent = value ? Math.round(value) : '–';
      console.log('[BestPower] Updated power display:', powerEl.textContent);
    }
    if (wkgEl) {
      wkgEl.textContent = wkg ? wkg.toFixed(2) : '–';
      console.log('[BestPower] Updated W/kg display:', wkgEl.textContent);
    }
    if (durationEl) {
      durationEl.textContent = durationMap[selectedKey] || '–';
      console.log('[BestPower] Updated duration display:', durationEl.textContent);
    }

    this._renderDurations(selectedKey);
  },

  _renderDurations(activeKey) {
    console.log('[BestPower] _renderDurations called with activeKey:', activeKey);
    
    const container = document.getElementById('bp-durations');
    if (!container) {
      console.error('[BestPower] Duration container not found');
      return;
    }

    const durationMap = {
      max_1min_power: '1 min',
      max_3min_power: '3 min',
      max_5min_power: '5 min',
      max_10min_power: '10 min',
      max_20min_power: '20 min',
      max_30min_power: '30 min',
      max_60min_power: '60 min'
    };

    const items = Object.entries(durationMap).map(([key, label]) => {
      const value = this._data[key];
      const isActive = key === activeKey;
      
      return `
        <div class="duration-item ${isActive ? 'active' : ''}" data-duration="${key}">
          <span class="duration-label">${label}</span>
          <span class="duration-value">${value ? Math.round(value) + ' W' : '–'}</span>
        </div>
      `;
    }).join('');

    container.innerHTML = items;
    console.log('[BestPower] Rendered', Object.keys(durationMap).length, 'duration items');

    container.querySelectorAll('.duration-item').forEach(item => {
      item.addEventListener('click', () => {
        const duration = item.dataset.duration;
        console.log('[BestPower] Duration clicked:', duration);
        container.querySelectorAll('.duration-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        this._updateMetrics(duration);
      });
    });
  },

  _renderChart() {
    console.log('[BestPower] _renderChart called');
    
    try {
      if (this._chart) {
        console.log('[BestPower] Destroying existing chart');
        this._chart.destroy();
        this._chart = null;
      }
      
      const ctx = document.getElementById('bp-chart');
      console.log('[BestPower] Canvas element:', ctx);
      
      if (!ctx) {
        console.error('[BestPower] ❌ Canvas element not found');
        return;
      }
      
      if (typeof Chart === 'undefined') {
        console.error('[BestPower] ❌ Chart.js not loaded');
        return;
      }

      const showWkg = document.getElementById('bp-show-wkg')?.checked || false;
      const { labels, values } = this._buildSeries(showWkg);
      
      console.log('[BestPower] Chart data:', { labels, values, showWkg });

      this._chart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: showWkg ? 'Best Power (W/kg)' : 'Best Power (W)',
            data: values,
            backgroundColor: 'rgba(251,191,36,0.2)',
            borderColor: '#fbbf24',
            borderWidth: 2,
            borderRadius: 8
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(0, 0, 0, 0.85)',
              padding: 14,
              titleFont: { size: 14, weight: '700' },
              bodyFont: { size: 13 },
              borderColor: '#fbbf24',
              borderWidth: 1,
              callbacks: {
                label: (ctx) => ` ${Math.round(ctx.parsed.y)} ${showWkg ? 'W/kg' : 'W'}`
              }
            }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { font: { size: 11, weight: '500' } }
            },
            y: {
              beginAtZero: true,
              grid: { color: 'rgba(0,0,0,0.04)', drawBorder: false },
              ticks: {
                font: { size: 11, weight: '500' },
                callback: (v) => `${v} ${showWkg ? 'W/kg' : 'W'}`
              }
            }
          }
        }
      });
      
      console.log('[BestPower] ✅ Chart created successfully');
      
    } catch (err) {
      console.error('[BestPower] ❌ Chart error:', err);
      console.error('[BestPower] Error stack:', err.stack);
    }
  },

  _buildSeries(asWkg) {
    console.log('[BestPower] _buildSeries called, asWkg:', asWkg);
    
    const durationMap = {
      max_1min_power: '1 min',
      max_3min_power: '3 min',
      max_5min_power: '5 min',
      max_10min_power: '10 min',
      max_20min_power: '20 min',
      max_30min_power: '30 min',
      max_60min_power: '60 min'
    };

    const keys = Object.keys(durationMap);
    const labels = keys.map(k => durationMap[k]);
    const weight = this._data.weight || 70;
    
    const values = keys.map(k => {
      const v = this._data[k];
      if (!v) return 0;
      return asWkg ? (v / weight) : v;
    });

    console.log('[BestPower] Series built:', { labels, values, weight });
    
    return { labels, values };
  },

  async refresh() {
    console.log('[BestPower] Refresh called');
    await this.load();
  }
};

export default bestPowerPage;