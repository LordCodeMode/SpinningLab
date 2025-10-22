// /static/js/coordinator/pages/hr_zones.js - Updated Design
import { API } from '../../core/api.js';

export const hrZonesPage = {
  _chart: null,

  async load() {
    const root = document.getElementById('page-content');
    root.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:center; min-height:300px;">
        <div style="text-align:center;">
          <div class="spinner" style="width:40px;height:40px;border:3px solid var(--border);border-top-color:#ef4444;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 16px;"></div>
          <p style="color:var(--text-muted);">Loading Heart Rate Zones...</p>
        </div>
      </div>
      <style>
        @keyframes spin { to { transform: rotate(360deg); } }
      </style>
    `;

    try {
      root.innerHTML = this.template();
      await this.loadData();
      this._setupControls();

    } catch (err) {
      console.error('[HR Zones] load error:', err);
      root.innerHTML = `
        <div style="padding:40px; text-align:center;">
          <svg style="width:64px; height:64px; opacity:0.3; margin:0 auto 16px; color:var(--error);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <h3 style="color:var(--text); font-size:18px; font-weight:600; margin-bottom:8px;">Error Loading Heart Rate Zones</h3>
          <p style="color:var(--text-muted);">${err?.message || 'Unknown error'}</p>
        </div>
      `;
    }
  },

  template() {
    return `
      <style>
        .hrz-section { display:grid; gap:20px; }
        .hrz-header { 
          display:flex; justify-content:space-between; align-items:start; 
          flex-wrap:wrap; gap:16px; margin-bottom:8px;
        }
        .hrz-header-content h1 {
          font-size:32px; font-weight:700; color:var(--text); 
          margin:0 0 6px 0; letter-spacing:-0.02em;
        }
        .hrz-header-content p {
          color:var(--text-muted); font-size:14px; line-height:1.5;
        }
        
        .hrz-controls { display:flex; gap:12px; align-items:center; }
        .hrz-controls label { 
          font-size:13px; font-weight:600; color:var(--text-muted); 
        }
        .hrz-controls select {
          padding:8px 14px; border:1.5px solid var(--border); border-radius:8px;
          background:var(--bg); color:var(--text); font-size:14px; font-weight:500;
          transition:all 0.2s; cursor:pointer;
        }
        .hrz-controls select:focus {
          outline:none; border-color:#ef4444; box-shadow:0 0 0 3px rgba(239,68,68,0.1);
        }
        
        .hrz-grid { 
          display:grid; grid-template-columns:1fr 1fr; gap:20px; 
        }
        @media (max-width: 1200px) { .hrz-grid { grid-template-columns:1fr; } }
        
        .hrz-card {
          background:#ffffff; border:2px solid #d1d5db; 
          border-radius:var(--radius); padding:24px; box-shadow:var(--shadow);
          transition:all 0.3s ease;
        }
        .hrz-card:hover { 
          transform:translateY(-4px);
          border-color:#ef4444;
          box-shadow:0 8px 24px rgba(239,68,68,0.15), 0 0 0 1px #ef4444;
        }
        
        .hrz-card-header {
          display:flex; align-items:start; gap:14px; margin-bottom:20px;
        }
        .hrz-icon {
          width:44px; height:44px; border-radius:10px; 
          display:flex; align-items:center; justify-content:center;
          background:linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(239,68,68,0.05) 100%);
          flex-shrink:0; transition:all 0.3s ease;
        }
        .hrz-card:hover .hrz-icon {
          transform:scale(1.05) rotate(3deg);
        }
        .hrz-icon svg { width:24px; height:24px; color:#ef4444; }
        .hrz-card-title { 
          font-size:18px; font-weight:700; color:var(--text); 
          margin-bottom:4px; letter-spacing:-0.02em;
        }
        .hrz-card-subtitle { font-size:13px; color:var(--text-muted); }
        
        .chart-wrapper { height:380px; position:relative; }
        
        .hrz-reference-grid { display:grid; gap:10px; }
        .hrz-ref-item {
          display:grid; grid-template-columns:140px 1fr auto; gap:12px;
          align-items:center; padding:12px 14px; border-radius:8px;
          background:var(--bg); border:1px solid transparent;
          transition:all 0.2s;
        }
        .hrz-ref-item:hover { 
          background:#ffffff; border-color:var(--border);
          transform:translateX(4px);
          box-shadow:0 2px 8px rgba(0,0,0,0.08);
        }
        
        .hrz-badge {
          display:inline-flex; align-items:center; gap:8px;
          padding:6px 12px; border-radius:6px; font-size:13px; font-weight:700;
          white-space:nowrap;
        }
        .hrz-badge-dot {
          width:10px; height:10px; border-radius:50%; flex-shrink:0;
        }
        
        /* HR Zone Colors */
        .hrz-z1 { background:#dbeafe; color:#1e40af; }
        .hrz-z1 .hrz-badge-dot { background:#1e40af; }
        .hrz-z2 { background:#d1fae5; color:#047857; }
        .hrz-z2 .hrz-badge-dot { background:#047857; }
        .hrz-z3 { background:#fef3c7; color:#b45309; }
        .hrz-z3 .hrz-badge-dot { background:#b45309; }
        .hrz-z4 { background:#fed7aa; color:#c2410c; }
        .hrz-z4 .hrz-badge-dot { background:#c2410c; }
        .hrz-z5 { background:#fecaca; color:#dc2626; }
        .hrz-z5 .hrz-badge-dot { background:#dc2626; }
        
        .hrz-range { 
          font-size:13px; color:var(--text-muted); font-weight:500;
        }
        .hrz-bpm {
          font-size:14px; font-weight:700; color:var(--text);
          text-align:right;
        }
        
        .hrz-breakdown { margin-top:20px; }
        .breakdown-header {
          display:flex; justify-content:space-between; align-items:center;
          margin-bottom:16px; padding-bottom:14px; border-bottom:2px solid var(--border);
        }
        .breakdown-title { 
          font-size:17px; font-weight:700; color:var(--text);
          letter-spacing:-0.02em;
        }
        .breakdown-total { 
          font-size:13px; color:var(--text-muted); font-weight:600;
        }
        
        .breakdown-grid { display:grid; gap:12px; }
        .breakdown-item {
          display:grid; grid-template-columns:160px 1fr auto; gap:16px;
          align-items:center; padding:14px 16px; border-radius:10px;
          background:var(--bg); border:1px solid transparent;
          transition:all 0.2s;
        }
        .breakdown-item:hover { 
          background:#ffffff; border-color:var(--border);
          box-shadow:0 2px 8px rgba(0,0,0,0.08);
        }
        
        .breakdown-bar-wrapper { flex:1; }
        .breakdown-bar {
          height:12px; border-radius:6px; background:#f1f5f9; 
          overflow:hidden; position:relative;
        }
        .breakdown-bar-fill {
          height:100%; border-radius:6px; transition:width 0.6s ease;
        }
        .breakdown-stats {
          display:flex; justify-content:space-between; margin-top:6px;
          font-size:12px;
        }
        .breakdown-time { color:var(--text); font-weight:600; }
        .breakdown-pct { color:var(--text-muted); }
        
        .breakdown-value {
          text-align:right; min-width:80px;
        }
        .breakdown-value-main { 
          font-size:20px; font-weight:800; color:var(--text); line-height:1;
        }
        .breakdown-value-sub { 
          font-size:11px; color:var(--text-muted); margin-top:2px; font-weight:600;
        }
        
        .hrz-insight {
          background:linear-gradient(135deg, rgba(239,68,68,0.1) 0%, rgba(16,185,129,0.1) 100%);
          border:1.5px solid #ef4444; border-radius:12px; padding:18px;
          margin-top:20px; display:flex; gap:14px;
        }
        .hrz-insight svg {
          width:24px; height:24px; color:#ef4444; flex-shrink:0; margin-top:2px;
        }
        .hrz-insight-content { flex:1; }
        .hrz-insight-title {
          font-weight:700; font-size:15px; color:var(--text); margin-bottom:6px;
        }
        .hrz-insight-text {
          font-size:13px; color:var(--text-muted); line-height:1.6;
        }
        
        .maxhr-display {
          display:inline-flex; align-items:center; gap:6px;
          padding:6px 12px; border-radius:6px;
          background:#ef4444; color:white; font-weight:700; font-size:14px;
        }
        .maxhr-display svg { width:16px; height:16px; }
      </style>

      <div class="hrz-section">
        <div class="hrz-header">
          <div class="hrz-header-content">
            <h1>Heart Rate Zones Distribution</h1>
            <p>Analyze your training intensity across heart rate zones</p>
          </div>
          <div class="hrz-controls">
            <label for="hrz-period">Period:</label>
            <select id="hrz-period">
              <option value="">All time</option>
              <option value="30">Last 30 days</option>
              <option value="90" selected>Last 90 days</option>
              <option value="180">Last 180 days</option>
              <option value="365">Last year</option>
            </select>
          </div>
        </div>

        <div class="hrz-grid">
          <!-- Chart Card -->
          <div class="hrz-card">
            <div class="hrz-card-header">
              <div class="hrz-icon">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                </svg>
              </div>
              <div>
                <div class="hrz-card-title">Zone Distribution</div>
                <div class="hrz-card-subtitle">Proportional time spent in each zone</div>
              </div>
            </div>
            <div class="chart-wrapper">
              <canvas id="hrz-chart" aria-label="Heart rate zones distribution"></canvas>
            </div>
          </div>

          <!-- Reference Card -->
          <div class="hrz-card">
            <div class="hrz-card-header">
              <div class="hrz-icon">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                </svg>
              </div>
              <div style="flex:1;">
                <div class="hrz-card-title">Zone Definitions</div>
                <div class="hrz-card-subtitle">Based on your maximum heart rate</div>
              </div>
              <div class="maxhr-display" id="maxhr-badge">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                </svg>
                190 bpm
              </div>
            </div>
            <div id="hrz-reference" class="hrz-reference-grid"></div>
            
            <div class="hrz-insight">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
              </svg>
              <div class="hrz-insight-content">
                <div class="hrz-insight-title">Training Zone Purpose</div>
                <div class="hrz-insight-text">
                  Zone 1-2 develop aerobic base and recovery, Zone 3 improves tempo endurance, Zone 4 targets lactate threshold, Zone 5 builds maximum aerobic capacity.
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Detailed Breakdown -->
        <div class="hrz-card">
          <div class="hrz-card-header">
            <div class="hrz-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"/>
              </svg>
            </div>
            <div>
              <div class="hrz-card-title">Detailed Breakdown</div>
              <div class="hrz-card-subtitle">Time and percentage distribution</div>
            </div>
          </div>
          <div id="hrz-breakdown" class="hrz-breakdown"></div>
        </div>
      </div>
    `;
  },

  async loadData() {
    try {
      const period = (document.getElementById('hrz-period')?.value || '').trim();

      const [zonesRaw, settings] = await Promise.all([
        API.getHeartRateZones({ days: period || undefined }).catch(err => {
          console.error('[HR Zones] API error:', err);
          return null;
        }),
        API.getSettings().catch(() => ({}))
      ]);

      const zonesData = this._normalizeZones(zonesRaw);

      // Show empty state if no data
      if (zonesData.length === 0 || zonesData.every(z => z.seconds === 0)) {
        this.showEmptyState();
        return;
      }
      
      const maxHR = Number(settings?.hr_max) || 190;

      // Update max HR badge
      const maxhrBadge = document.getElementById('maxhr-badge');
      if (maxhrBadge) {
        maxhrBadge.innerHTML = `
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
          </svg>
          ${maxHR} bpm
        `;
      }

      this._renderChart(zonesData);
      this._renderReference(maxHR);
      this._renderBreakdown(zonesData);

    } catch (err) {
      console.error('[HR Zones] loadData error:', err);
    }
  },

  showEmptyState() {
    const root = document.getElementById('page-content');
    root.innerHTML = `
      <div style="padding:80px; text-align:center; color:var(--text-muted);">
        <svg style="width:80px; height:80px; opacity:0.3; margin:0 auto 24px; color:#ef4444;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
        </svg>
        <h3 style="font-size:20px; font-weight:600; color:var(--text); margin-bottom:12px;">No Heart Rate Zone Data</h3>
        <p>Upload activities with heart rate data to see your training intensity distribution.</p>
      </div>
    `;
  },

  _setupControls() {
    const select = document.getElementById('hrz-period');
    if (select) {
      select.addEventListener('change', () => this.loadData());
    }
  },

  _normalizeZones(zonesRaw) {
    // Handle backend response format first (zone_data array)
    if (zonesRaw?.zone_data && Array.isArray(zonesRaw.zone_data)) {
      return zonesRaw.zone_data.map(z => ({
        name: String(z.zone_label || ''),
        seconds: Number(z.seconds_in_zone || 0)
      }));
    }
    
    // Fallback: Handle transformed format (zones array with name/seconds)
    if (zonesRaw?.zones && Array.isArray(zonesRaw.zones)) {
      return zonesRaw.zones.map(z => ({
        name: String(z.name || z.zone || ''),
        seconds: Number(z.seconds || 0)
      }));
    }
    
    // Fallback: Handle direct array
    if (Array.isArray(zonesRaw)) {
      return zonesRaw.map(z => ({
        name: String(z.name || z.zone || z.zone_label || ''),
        seconds: Number(z.seconds || z.seconds_in_zone || 0)
      }));
    }

    return [];
  },

  _getZoneInfo(zoneNum) {
    const info = {
      1: { name: 'Recovery', color: '#3b82f6', desc: 'Very light effort, 50-60% max HR' },
      2: { name: 'Aerobic', color: '#10b981', desc: 'Easy pace, 60-70% max HR' },
      3: { name: 'Tempo', color: '#f59e0b', desc: 'Moderate effort, 70-80% max HR' },
      4: { name: 'Threshold', color: '#f97316', desc: 'Hard effort, 80-90% max HR' },
      5: { name: 'VO₂max', color: '#ef4444', desc: 'Maximum effort, 90-100% max HR' }
    };
    return info[zoneNum] || { name: `Zone ${zoneNum}`, color: '#94a3b8', desc: '' };
  },

  _renderChart(zonesData) {
    try {
      if (this._chart) {
        this._chart.destroy();
        this._chart = null;
      }
      
      const ctx = document.getElementById('hrz-chart');
      if (!ctx || typeof Chart === 'undefined') return;

      const labels = zonesData.map((z, i) => {
        const num = this._extractZoneNum(z.name);
        const info = this._getZoneInfo(num);
        return `Z${num} ${info.name}`;
      });
      
      const values = zonesData.map(z => z.seconds);
      
      const colors = zonesData.map((z, i) => {
        const num = this._extractZoneNum(z.name);
        return this._getZoneInfo(num).color;
      });

      this._chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{
            data: values,
            backgroundColor: colors,
            borderWidth: 3,
            borderColor: '#ffffff',
            hoverBorderWidth: 4,
            hoverBorderColor: '#ef4444'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '65%',
          plugins: {
            legend: {
              position: 'bottom',
              labels: { 
                padding: 16,
                usePointStyle: true,
                pointStyle: 'circle',
                font: { size: 12, weight: '600' },
                color: 'var(--text)'
              }
            },
            tooltip: {
              backgroundColor: 'rgba(0, 0, 0, 0.85)',
              padding: 14,
              titleFont: { size: 14, weight: '700' },
              bodyFont: { size: 13 },
              borderColor: '#ef4444',
              borderWidth: 1,
              callbacks: {
                label: (ctx) => {
                  const secs = ctx.raw || 0;
                  const pct = this._pct(values, secs);
                  return ` ${this._fmtHMS(secs)} (${pct})`;
                }
              }
            }
          }
        }
      });
    } catch (err) {
      console.error('[HR Zones] chart error:', err);
    }
  },

  _renderReference(maxHR) {
    const ref = document.getElementById('hrz-reference');
    if (!ref) return;

    const ranges = [
      { num: 1, min: 0.50, max: 0.60 },
      { num: 2, min: 0.60, max: 0.70 },
      { num: 3, min: 0.70, max: 0.80 },
      { num: 4, min: 0.80, max: 0.90 },
      { num: 5, min: 0.90, max: 1.00 }
    ];

    const items = ranges.map(r => {
      const info = this._getZoneInfo(r.num);
      const minBPM = Math.round(maxHR * r.min);
      const maxBPM = Math.round(maxHR * r.max);
      const band = `${minBPM}–${maxBPM} bpm`;
      
      return `
        <div class="hrz-ref-item">
          <div class="hrz-badge hrz-z${r.num}">
            <div class="hrz-badge-dot"></div>
            Z${r.num} ${info.name}
          </div>
          <div class="hrz-range">
            ${(r.min * 100).toFixed(0)}–${(r.max * 100).toFixed(0)}% max HR
          </div>
          <div class="hrz-bpm">${band}</div>
        </div>
      `;
    }).join('');

    ref.innerHTML = items;
  },

  _renderBreakdown(zonesData) {
    const wrap = document.getElementById('hrz-breakdown');
    if (!wrap) return;

    const total = zonesData.reduce((s, z) => s + (z.seconds || 0), 0) || 1;

    const header = `
      <div class="breakdown-header">
        <div class="breakdown-title">Zone Analysis</div>
        <div class="breakdown-total">Total: ${this._fmtHMS(total)}</div>
      </div>
    `;

    const items = zonesData.map((z, i) => {
      const num = this._extractZoneNum(z.name);
      const info = this._getZoneInfo(num);
      const pct = (z.seconds / total) * 100;
      
      return `
        <div class="breakdown-item">
          <div class="hrz-badge hrz-z${num}">
            <div class="hrz-badge-dot"></div>
            Z${num} ${info.name}
          </div>
          <div class="breakdown-bar-wrapper">
            <div class="breakdown-bar">
              <div class="breakdown-bar-fill" style="width:${pct.toFixed(1)}%; background:${info.color};"></div>
            </div>
            <div class="breakdown-stats">
              <span class="breakdown-time">${this._fmtHMS(z.seconds)}</span>
              <span class="breakdown-pct">${pct.toFixed(1)}%</span>
            </div>
          </div>
          <div class="breakdown-value">
            <div class="breakdown-value-main">${pct.toFixed(0)}%</div>
            <div class="breakdown-value-sub">of total</div>
          </div>
        </div>
      `;
    }).join('');

    wrap.innerHTML = header + '<div class="breakdown-grid">' + items + '</div>';
  },

  _extractZoneNum(name) {
    const match = String(name).match(/\d+/);
    return match ? parseInt(match[0], 10) : 1;
  },

  _fmtHMS(secs) {
    const s = Math.max(0, Math.round(secs || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${ss}s`;
    return `${ss}s`;
  },

  _pct(allValues, v) {
    const total = allValues.reduce((s, x) => s + (x || 0), 0) || 1;
    return `${((v || 0) * 100 / total).toFixed(1)}%`;
  },

  async refresh() {
    await this.load();
  }
};

export default hrZonesPage;