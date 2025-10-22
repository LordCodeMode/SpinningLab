// /static/js/coordinator/pages/zones.js - Updated Design
import { API } from '../../core/api.js';

export const zonesPage = {
  _chart: null,

  async load() {
    const root = document.getElementById('page-content');
    root.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:center; min-height:300px;">
        <div style="text-align:center;">
          <div class="spinner" style="width:40px;height:40px;border:3px solid var(--border);border-top-color:#3b82f6;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 16px;"></div>
          <p style="color:var(--text-muted);">Loading Power Zones...</p>
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
      console.error('[Zones] load error:', err);
      root.innerHTML = `
        <div style="padding:40px; text-align:center;">
          <svg style="width:64px; height:64px; opacity:0.3; margin:0 auto 16px; color:var(--error);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <h3 style="color:var(--text); font-size:18px; font-weight:600; margin-bottom:8px;">Error Loading Power Zones</h3>
          <p style="color:var(--text-muted);">${err?.message || 'Unknown error'}</p>
        </div>
      `;
    }
  },

  template() {
    return `
      <style>
        .zones-section { display:grid; gap:20px; }
        .zones-header { 
          display:flex; justify-content:space-between; align-items:start; 
          flex-wrap:wrap; gap:16px; margin-bottom:8px;
        }
        .zones-header-content h1 {
          font-size:32px; font-weight:700; color:var(--text); 
          margin:0 0 6px 0; letter-spacing:-0.02em;
        }
        .zones-header-content p {
          color:var(--text-muted); font-size:14px; line-height:1.5;
        }
        
        .zones-controls { display:flex; gap:12px; align-items:center; }
        .zones-controls label { 
          font-size:13px; font-weight:600; color:var(--text-muted); 
        }
        .zones-controls select {
          padding:8px 14px; border:1.5px solid var(--border); border-radius:8px;
          background:var(--bg); color:var(--text); font-size:14px; font-weight:500;
          transition:all 0.2s; cursor:pointer;
        }
        .zones-controls select:focus {
          outline:none; border-color:#3b82f6; box-shadow:0 0 0 3px rgba(59,130,246,0.1);
        }
        
        .zones-grid { 
          display:grid; grid-template-columns:1fr 1fr; gap:20px; 
        }
        @media (max-width: 1200px) { .zones-grid { grid-template-columns:1fr; } }
        
        .zone-card {
          background:#ffffff; border:2px solid #d1d5db; 
          border-radius:var(--radius); padding:24px; box-shadow:var(--shadow);
          transition:all 0.3s ease;
        }
        .zone-card:hover { 
          transform:translateY(-4px);
          border-color:#3b82f6;
          box-shadow:0 8px 24px rgba(59,130,246,0.15), 0 0 0 1px #3b82f6;
        }
        
        .zone-card-header {
          display:flex; align-items:start; gap:14px; margin-bottom:20px;
        }
        .zone-icon {
          width:44px; height:44px; border-radius:10px; 
          display:flex; align-items:center; justify-content:center;
          background:linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(59,130,246,0.05) 100%);
          flex-shrink:0; transition:all 0.3s ease;
        }
        .zone-card:hover .zone-icon {
          transform:scale(1.05) rotate(3deg);
        }
        .zone-icon svg { width:24px; height:24px; color:#3b82f6; }
        .zone-card-title { 
          font-size:18px; font-weight:700; color:var(--text); 
          margin-bottom:4px; letter-spacing:-0.02em;
        }
        .zone-card-subtitle { font-size:13px; color:var(--text-muted); }
        
        .chart-wrapper { height:380px; position:relative; }
        
        .zones-reference-grid { display:grid; gap:10px; }
        .zone-ref-item {
          display:grid; grid-template-columns:140px 1fr auto; gap:12px;
          align-items:center; padding:12px 14px; border-radius:8px;
          background:var(--bg); border:1px solid transparent;
          transition:all 0.2s;
        }
        .zone-ref-item:hover { 
          background:#ffffff; border-color:var(--border);
          transform:translateX(4px);
          box-shadow:0 2px 8px rgba(0,0,0,0.08);
        }
        
        .zone-badge {
          display:inline-flex; align-items:center; gap:8px;
          padding:6px 12px; border-radius:6px; font-size:13px; font-weight:700;
          white-space:nowrap;
        }
        .zone-badge-dot {
          width:10px; height:10px; border-radius:50%; flex-shrink:0;
        }
        
        /* Zone Colors */
        .zone-z1 { background:#e0f2fe; color:#0369a1; }
        .zone-z1 .zone-badge-dot { background:#0369a1; }
        .zone-z2 { background:#dbeafe; color:#1e40af; }
        .zone-z2 .zone-badge-dot { background:#1e40af; }
        .zone-z3 { background:#d1fae5; color:#047857; }
        .zone-z3 .zone-badge-dot { background:#047857; }
        .zone-z4 { background:#fef3c7; color:#b45309; }
        .zone-z4 .zone-badge-dot { background:#b45309; }
        .zone-z5 { background:#fed7aa; color:#c2410c; }
        .zone-z5 .zone-badge-dot { background:#c2410c; }
        .zone-z6 { background:#fecaca; color:#dc2626; }
        .zone-z6 .zone-badge-dot { background:#dc2626; }
        .zone-z7 { background:#f3e8ff; color:#7c3aed; }
        .zone-z7 .zone-badge-dot { background:#7c3aed; }
        
        .zone-range { 
          font-size:13px; color:var(--text-muted); font-weight:500;
        }
        .zone-watts {
          font-size:14px; font-weight:700; color:var(--text);
          text-align:right;
        }
        
        .zones-breakdown { margin-top:20px; }
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
        
        .zone-insight {
          background:linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(16,185,129,0.1) 100%);
          border:1.5px solid #3b82f6; border-radius:12px; padding:18px;
          margin-top:20px; display:flex; gap:14px;
        }
        .zone-insight svg {
          width:24px; height:24px; color:#3b82f6; flex-shrink:0; margin-top:2px;
        }
        .zone-insight-content { flex:1; }
        .zone-insight-title {
          font-weight:700; font-size:15px; color:var(--text); margin-bottom:6px;
        }
        .zone-insight-text {
          font-size:13px; color:var(--text-muted); line-height:1.6;
        }
        
        .ftp-display {
          display:inline-flex; align-items:center; gap:6px;
          padding:6px 12px; border-radius:6px;
          background:#3b82f6; color:white; font-weight:700; font-size:14px;
        }
        .ftp-display svg { width:16px; height:16px; }
      </style>

      <div class="zones-section">
        <div class="zones-header">
          <div class="zones-header-content">
            <h1>Power Zones Distribution</h1>
            <p>Analyze your training intensity across power zones</p>
          </div>
          <div class="zones-controls">
            <label for="zones-period">Period:</label>
            <select id="zones-period">
              <option value="">All time</option>
              <option value="30">Last 30 days</option>
              <option value="90" selected>Last 90 days</option>
              <option value="180">Last 180 days</option>
              <option value="365">Last year</option>
            </select>
          </div>
        </div>

        <div class="zones-grid">
          <!-- Chart Card -->
          <div class="zone-card">
            <div class="zone-card-header">
              <div class="zone-icon">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                </svg>
              </div>
              <div>
                <div class="zone-card-title">Zone Distribution</div>
                <div class="zone-card-subtitle">Proportional time spent in each zone</div>
              </div>
            </div>
            <div class="chart-wrapper">
              <canvas id="zones-chart" aria-label="Power zones distribution"></canvas>
            </div>
          </div>

          <!-- Reference Card -->
          <div class="zone-card">
            <div class="zone-card-header">
              <div class="zone-icon">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                </svg>
              </div>
              <div style="flex:1;">
                <div class="zone-card-title">Zone Definitions</div>
                <div class="zone-card-subtitle">Based on your current FTP</div>
              </div>
              <div class="ftp-display" id="ftp-badge">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                </svg>
                250 W
              </div>
            </div>
            <div id="zones-reference" class="zones-reference-grid"></div>
            
            <div class="zone-insight">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
              </svg>
              <div class="zone-insight-content">
                <div class="zone-insight-title">Training Zone Purpose</div>
                <div class="zone-insight-text">
                  Each zone targets specific physiological adaptations. Z1-Z2 build aerobic base, Z3-Z4 improve lactate threshold, Z5+ develop VO₂max and neuromuscular power.
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Detailed Breakdown -->
        <div class="zone-card">
          <div class="zone-card-header">
            <div class="zone-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"/>
              </svg>
            </div>
            <div>
              <div class="zone-card-title">Detailed Breakdown</div>
              <div class="zone-card-subtitle">Time and percentage distribution</div>
            </div>
          </div>
          <div id="zones-breakdown" class="zones-breakdown"></div>
        </div>
      </div>
    `;
  },

  async loadData() {
    try {
      const period = (document.getElementById('zones-period')?.value || '').trim();

      const [zonesRaw, settings] = await Promise.all([
        API.getPowerZones({ days: period || undefined }).catch(() => null),
        API.getSettings().catch(() => ({}))
      ]);

      const ftp = Number(settings?.ftp) || 250;
      const zonesData = this._normalizeZones(zonesRaw);

      // Update FTP badge
      const ftpBadge = document.getElementById('ftp-badge');
      if (ftpBadge) {
        ftpBadge.innerHTML = `
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
          </svg>
          ${ftp} W
        `;
      }

      this._renderChart(zonesData);
      this._renderReference(ftp);
      this._renderBreakdown(zonesData);

    } catch (err) {
      console.error('[Zones] loadData error:', err);
    }
  },

  _setupControls() {
    const select = document.getElementById('zones-period');
    if (select) {
      select.addEventListener('change', () => this.loadData());
    }
  },

  _normalizeZones(zonesRaw) {
    if (zonesRaw?.zones && Array.isArray(zonesRaw.zones)) {
      return zonesRaw.zones.map(z => ({
        name: String(z.name ?? z.zone ?? ''),
        seconds: Number(z.seconds ?? 0)
      }));
    }
    if (Array.isArray(zonesRaw)) {
      return zonesRaw.map(z => ({
        name: String(z.name ?? z.zone ?? ''),
        seconds: Number(z.seconds ?? 0)
      }));
    }
    if (zonesRaw && typeof zonesRaw === 'object') {
      const out = [];
      Object.keys(zonesRaw).forEach(k => {
        out.push({ name: k.toUpperCase(), seconds: Number(zonesRaw[k] ?? 0) });
      });
      if (out.length) return out;
    }

    // Demo data
    return [
      { name: 'Z1', seconds: 3.2 * 3600 },
      { name: 'Z2', seconds: 6.8 * 3600 },
      { name: 'Z3', seconds: 2.1 * 3600 },
      { name: 'Z4', seconds: 1.4 * 3600 },
      { name: 'Z5', seconds: 0.6 * 3600 },
      { name: 'Z6', seconds: 0.3 * 3600 },
      { name: 'Z7', seconds: 0.1 * 3600 }
    ];
  },

  _getZoneInfo(zoneNum) {
    const info = {
      1: { name: 'Recovery', color: '#0ea5e9', desc: 'Active recovery, very easy effort' },
      2: { name: 'Endurance', color: '#3b82f6', desc: 'Aerobic base building, comfortable pace' },
      3: { name: 'Tempo', color: '#10b981', desc: 'Moderate effort, sustainable intensity' },
      4: { name: 'Threshold', color: '#f59e0b', desc: 'Hard effort at lactate threshold' },
      5: { name: 'VO₂max', color: '#f97316', desc: 'Very hard, maximal aerobic effort' },
      6: { name: 'Anaerobic', color: '#ef4444', desc: 'Extreme effort, anaerobic capacity' },
      7: { name: 'Neuromuscular', color: '#a855f7', desc: 'All-out sprints, max power' }
    };
    return info[zoneNum] || { name: `Zone ${zoneNum}`, color: '#94a3b8', desc: '' };
  },

  _renderChart(zonesData) {
    try {
      if (this._chart) {
        this._chart.destroy();
        this._chart = null;
      }
      const ctx = document.getElementById('zones-chart');
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
            hoverBorderColor: '#3b82f6'
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
              borderColor: '#3b82f6',
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
      console.error('[Zones] chart error:', err);
    }
  },

  _renderReference(ftp) {
    const ref = document.getElementById('zones-reference');
    if (!ref) return;

    const ranges = [
      { num: 1, min: 0.00, max: 0.55 },
      { num: 2, min: 0.56, max: 0.75 },
      { num: 3, min: 0.76, max: 0.90 },
      { num: 4, min: 0.91, max: 1.05 },
      { num: 5, min: 1.06, max: 1.20 },
      { num: 6, min: 1.21, max: 1.50 },
      { num: 7, min: 1.51, max: Infinity }
    ];

    const items = ranges.map(r => {
      const info = this._getZoneInfo(r.num);
      const minW = Math.round(ftp * r.min);
      const maxW = r.max === Infinity ? '∞' : Math.round(ftp * r.max);
      const band = r.max === Infinity ? `${minW}+ W` : `${minW}–${maxW} W`;
      
      return `
        <div class="zone-ref-item">
          <div class="zone-badge zone-z${r.num}">
            <div class="zone-badge-dot"></div>
            Z${r.num} ${info.name}
          </div>
          <div class="zone-range">
            ${(r.min * 100).toFixed(0)}${r.max === Infinity ? '+' : '–' + (r.max * 100).toFixed(0)}% FTP
          </div>
          <div class="zone-watts">${band}</div>
        </div>
      `;
    }).join('');

    ref.innerHTML = items;
  },

  _renderBreakdown(zonesData) {
    const wrap = document.getElementById('zones-breakdown');
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
          <div class="zone-badge zone-z${num}">
            <div class="zone-badge-dot"></div>
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
    await this.loadData();
  }
};

export default zonesPage;