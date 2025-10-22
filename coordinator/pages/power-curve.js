// /static/js/coordinator/pages/power-curve.js
import { AnalysisAPI, API } from '../../core/api.js';
import { notify } from '../../core/utils.js';

export const powerCurvePage = {
  state: {
    range: '90',
    start: null,
    end: null,
    weighted: false,
    data: null,
    userWeight: null,
  },

  async load() {
    this.renderLayout();
    await this.hydrateWeight();
    this.applyDefaultRange();
    this.setupEventListeners();
    await this.loadData();
  },

  async refresh() {
    await this.loadData();
  },

  renderLayout() {
    const html = `
      <style>
        .pc-section { display:grid; gap:20px; }
        .pc-header { margin-bottom:16px; }
        .pc-header h1 { 
          font-size:24px; font-weight:600; color:var(--text); 
          margin:0 0 4px 0; letter-spacing:-0.01em;
        }
        .pc-header p { 
          color:var(--text-muted); font-size:13px; line-height:1.5; 
        }
        
        .toolbar { 
          display:flex; align-items:flex-end; gap:16px; flex-wrap:wrap;
          padding:20px; background:#ffffff; border:2px solid #d1d5db;
          border-radius:var(--radius); box-shadow:var(--shadow);
          transition:all 0.3s ease;
        }
        .toolbar:hover {
          border-color:#3b82f6;
          box-shadow:0 8px 24px rgba(59,130,246,0.15), 0 0 0 1px #3b82f6;
        }
        .segmented {
          display:flex; gap:6px; background:var(--bg); border:1px solid var(--border);
          padding:4px; border-radius:8px;
        }
        .segmented .seg-btn {
          border:none; background:transparent; padding:8px 12px; border-radius:6px; 
          font-size:13px; line-height:1; cursor:pointer; color:var(--text-muted);
          font-weight:600; transition:all 0.2s;
        }
        .segmented .seg-btn:hover { 
          background:rgba(59,130,246,0.1); color:#3b82f6; 
        }
        .segmented .seg-btn.active { 
          background:linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); 
          color:white; box-shadow:0 2px 8px rgba(59,130,246,0.25);
        }
        .field { display:grid; gap:6px; min-width:180px; }
        .field label {
          font-size:12px; font-weight:600; letter-spacing:.02em; 
          color:var(--text-muted);
        }
        .field input[type="date"] {
          background:var(--bg); border:1px solid var(--border); color:var(--text);
          padding:8px 10px; border-radius:8px; font-size:14px; 
          transition:border-color 0.15s;
        }
        .field input[type="date"]:focus {
          outline:none; border-color:#3b82f6; 
          box-shadow:0 0 0 3px rgba(59,130,246,0.1);
        }
        .switch {
          display:flex; align-items:center; gap:10px; padding:8px 10px; 
          border:1px solid var(--border); background:var(--bg); 
          border-radius:8px; font-size:13px; color:var(--text);
        }
        .switch input { 
          width:16px; height:16px; accent-color:#3b82f6; cursor:pointer; 
        }
        .toolbar-actions { margin-left:auto; display:flex; gap:8px; }
        .btn-primary {
          background:linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          color:white; border:none; padding:8px 16px; border-radius:8px;
          font-size:13px; font-weight:600; cursor:pointer;
          box-shadow:0 2px 8px rgba(59,130,246,0.25);
          transition:all 0.2s;
        }
        .btn-primary:hover {
          background:linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          transform:translateY(-1px);
          box-shadow:0 4px 12px rgba(59,130,246,0.35);
        }
        .btn-outline {
          background:transparent; border:1.5px solid var(--border); 
          color:var(--text); padding:7px 14px; border-radius:8px; 
          font-size:13px; font-weight:600; cursor:pointer; 
          transition:all 0.15s;
        }
        .btn-outline:hover { 
          background:var(--bg); border-color:#3b82f6; color:#3b82f6; 
        }
        @media (max-width: 800px) {
          .toolbar { align-items:stretch; }
          .toolbar-actions { margin-left:0; width:100%; }
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
          background:radial-gradient(circle at center, rgba(59,130,246,0.08) 0%, transparent 70%);
          border-radius:50%;
          transform:translate(30%, -30%);
          transition:all 0.3s ease;
        }
        .metric-card:hover {
          transform:translateY(-6px);
          box-shadow:0 12px 28px rgba(0,0,0,0.15);
        }
        
        .metric-card:nth-child(1):hover {
          border-color:#3b82f6;
          box-shadow:0 12px 28px rgba(59,130,246,0.2), 0 0 0 1px #3b82f6;
        }
        
        .metric-card:nth-child(2):hover {
          border-color:#8b5cf6;
          box-shadow:0 12px 28px rgba(139,92,246,0.2), 0 0 0 1px #8b5cf6;
        }
        
        .metric-card:nth-child(3):hover {
          border-color:#10b981;
          box-shadow:0 12px 28px rgba(16,185,129,0.2), 0 0 0 1px #10b981;
        }
        
        .metric-card:nth-child(4):hover {
          border-color:#f59e0b;
          box-shadow:0 12px 28px rgba(245,158,11,0.2), 0 0 0 1px #f59e0b;
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
        .metric-icon.primary { background:rgba(59,130,246,0.15); color:#3b82f6; }
        .metric-icon.purple { background:rgba(139,92,246,0.15); color:#8b5cf6; }
        .metric-icon.green { background:rgba(16,185,129,0.15); color:#10b981; }
        .metric-icon.amber { background:rgba(245,158,11,0.15); color:#f59e0b; }
        
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
          min-height:500px;
        }
        .chart-card:hover {
          border-color:#3b82f6;
          box-shadow:0 8px 24px rgba(59,130,246,0.15), 0 0 0 1px #3b82f6;
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
          background:linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(139,92,246,0.15) 100%);
          display:flex; align-items:center; justify-content:center;
          flex-shrink:0;
          transition:all 0.3s ease;
        }
        
        .chart-card:hover .chart-icon {
          transform:scale(1.05);
        }
        
        .chart-icon svg { width:22px; height:22px; color:#3b82f6; }
        .chart-title { 
          font-size:20px; font-weight:700; color:var(--text); 
          letter-spacing:-0.02em;
        }
        .chart-subtitle { 
          font-size:13px; color:var(--text-muted); line-height:1.4; 
        }
        
        .chart-stats {
          display:flex; gap:20px; flex-wrap:wrap;
        }
        .stat-item {
          display:flex; flex-direction:column; gap:4px;
        }
        .stat-label {
          font-size:11px; font-weight:700; color:var(--text-muted);
          text-transform:uppercase; letter-spacing:0.5px;
        }
        .stat-value {
          font-size:20px; font-weight:800; color:#3b82f6;
        }
        
        .chart-container { 
          position:relative; height:420px; margin-top:8px; 
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
          border-color:#3b82f6;
          box-shadow:0 8px 24px rgba(59,130,246,0.15), 0 0 0 1px #3b82f6;
        }
        .info-card-header {
          display:flex; align-items:center; gap:12px; margin-bottom:16px;
          padding-bottom:14px; border-bottom:2px solid var(--border);
        }
        .info-card-icon {
          width:40px; height:40px; border-radius:10px;
          background:rgba(59,130,246,0.15);
          display:flex; align-items:center; justify-content:center;
          color:#3b82f6; flex-shrink:0;
        }
        .info-card-icon svg { width:22px; height:22px; }
        .info-card-title { 
          font-size:17px; font-weight:700; color:var(--text); 
          letter-spacing:-0.02em;
        }
        
        .factor-list { display:grid; gap:10px; }
        .factor-item {
          display:flex; align-items:start; gap:10px;
          padding:10px; border-radius:6px; background:var(--bg);
        }
        .factor-icon {
          width:20px; height:20px; flex-shrink:0; margin-top:2px;
        }
        .factor-icon svg { width:100%; height:100%; color:#3b82f6; }
        .factor-content { flex:1; }
        .factor-title { 
          font-size:13px; font-weight:600; color:var(--text); 
          margin-bottom:2px;
        }
        .factor-text { 
          font-size:12px; color:var(--text-muted); line-height:1.4; 
        }
        
        .pc-insight {
          background:linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(139,92,246,0.1) 100%);
          border:1.5px solid #3b82f6; border-radius:12px; padding:18px;
          display:flex; gap:14px; margin-top:16px;
        }
        .pc-insight svg {
          width:24px; height:24px; color:#3b82f6; flex-shrink:0; margin-top:2px;
        }
        .pc-insight-content { flex:1; }
        .pc-insight-title {
          font-weight:700; font-size:15px; color:var(--text); margin-bottom:6px;
        }
        .pc-insight-text {
          font-size:13px; color:var(--text-muted); line-height:1.6;
        }
        
        .empty-state {
          display:flex; flex-direction:column; align-items:center; 
          justify-content:center; min-height:400px; text-align:center; 
          color:var(--text-muted);
        }
        .empty-state svg { 
          width:64px; height:64px; opacity:0.3; margin-bottom:16px; 
        }
        .empty-state h3 { 
          font-size:18px; font-weight:600; color:var(--text); 
          margin-bottom:8px; 
        }
        .empty-state p { font-size:14px; max-width:400px; }
        
        .loading {
          display:flex; flex-direction:column; align-items:center; 
          justify-content:center; padding:80px 20px; text-align:center;
        }
        .spinner {
          width:40px; height:40px; border:3px solid var(--border);
          border-top-color:#3b82f6; border-radius:50%; 
          animation:spin 0.8s linear infinite; margin:0 auto 16px;
        }
        @keyframes spin { to { transform:rotate(360deg); } }
        
        @media (max-width: 640px) {
          .chart-stats { gap:12px; }
          .stat-item { min-width:80px; }
          .chart-container { height:320px; }
          .metrics-grid { grid-template-columns:repeat(2, 1fr); }
        }
      </style>

      <div class="pc-section">
        <div class="pc-header">
          <h1>Power Curve</h1>
          <p>Analyze your power performance across different durations</p>
        </div>

        <div class="toolbar" id="pc-controls">
          <div class="segmented" id="pc-quick-range" aria-label="Quick ranges">
            <button class="seg-btn" data-range="30">Last 30d</button>
            <button class="seg-btn active" data-range="90">Last 90d</button>
            <button class="seg-btn" data-range="180">Last 180d</button>
            <button class="seg-btn" data-range="365">YTD</button>
            <button class="seg-btn" data-range="all">All</button>
          </div>

          <div class="field">
            <label for="pc-start">From</label>
            <input type="date" id="pc-start" autocomplete="off"/>
          </div>
          <div class="field">
            <label for="pc-end">To</label>
            <input type="date" id="pc-end" autocomplete="off"/>
          </div>

          <label class="switch" title="Show W/kg instead of Watts">
            <input type="checkbox" id="pc-weighted"/>
            <span>Show W/kg</span>
          </label>

          <div class="toolbar-actions">
            <button id="pc-apply" class="btn-primary">Apply</button>
            <button id="pc-clear" class="btn-outline">Clear</button>
            <button id="pc-refresh" class="btn-outline">Refresh</button>
          </div>
        </div>

        <div class="metrics-grid" id="pc-stats-cards" style="display:none;">
          <div class="metric-card">
            <div class="metric-header-row">
              <div class="metric-icon primary">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                </svg>
              </div>
              <div class="metric-label">Peak 5s</div>
            </div>
            <div class="metric-value" id="stat-5s">–</div>
            <div class="metric-subtitle">Sprint power</div>
          </div>
          
          <div class="metric-card">
            <div class="metric-header-row">
              <div class="metric-icon purple">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <div class="metric-label">Peak 1m</div>
            </div>
            <div class="metric-value" id="stat-1m">–</div>
            <div class="metric-subtitle">Anaerobic capacity</div>
          </div>
          
          <div class="metric-card">
            <div class="metric-header-row">
              <div class="metric-icon green">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                </svg>
              </div>
              <div class="metric-label">Peak 5m</div>
            </div>
            <div class="metric-value" id="stat-5m">–</div>
            <div class="metric-subtitle">VO2max power</div>
          </div>
          
          <div class="metric-card">
            <div class="metric-header-row">
              <div class="metric-icon amber">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
              </div>
              <div class="metric-label">Peak 20m</div>
            </div>
            <div class="metric-value" id="stat-20m">–</div>
            <div class="metric-subtitle">FTP estimate</div>
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
                  <div class="chart-title">Power Duration Curve</div>
                  <div class="chart-subtitle" id="pc-meta">—</div>
                </div>
              </div>
            </div>
          </div>
          <div class="chart-container" id="power-curve-chart">
            <div class="loading">
              <div class="spinner"></div>
              <p style="color:var(--text-muted);">Loading power curve...</p>
            </div>
          </div>
        </div>

        <div class="info-grid">
          <div class="info-card">
            <div class="info-card-header">
              <div class="info-card-icon">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                </svg>
              </div>
              <div>
                <div class="info-card-title">Understanding Power Curve</div>
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
                  <div class="factor-title">Maximum Mean Power</div>
                  <div class="factor-text">Shows your best average power for any given duration from seconds to hours</div>
                </div>
              </div>
              <div class="factor-item">
                <div class="factor-icon">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                  </svg>
                </div>
                <div class="factor-content">
                  <div class="factor-title">Power Profile</div>
                  <div class="factor-text">Identifies your strengths - sprinter, time trialist, or all-rounder</div>
                </div>
              </div>
              <div class="factor-item">
                <div class="factor-icon">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
                  </svg>
                </div>
                <div class="factor-content">
                  <div class="factor-title">Track Progress</div>
                  <div class="factor-text">Monitor improvements across different energy systems over time</div>
                </div>
              </div>
            </div>
            
            <div class="pc-insight">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <div class="pc-insight-content">
                <div class="pc-insight-title">Power Curve Analysis</div>
                <div class="pc-insight-text">
                  Your power curve reveals physiological capabilities across all durations. Short efforts (5-30s) indicate neuromuscular power, mid-range (1-5m) shows VO2max capacity, and longer durations (20-60m) reflect threshold and endurance.
                </div>
              </div>
            </div>
          </div>

          <div class="info-card">
            <div class="info-card-header">
              <div class="info-card-icon">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/>
                </svg>
              </div>
              <div>
                <div class="info-card-title">Training Applications</div>
              </div>
            </div>
            <div class="factor-list">
              <div class="factor-item">
                <div class="factor-icon">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </div>
                <div class="factor-content">
                  <div class="factor-title">Identify Weaknesses</div>
                  <div class="factor-text">Dips in your curve reveal areas needing focused training attention</div>
                </div>
              </div>
              <div class="factor-item">
                <div class="factor-icon">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                  </svg>
                </div>
                <div class="factor-content">
                  <div class="factor-title">Set Training Zones</div>
                  <div class="factor-text">Use curve data to establish accurate power zones for structured workouts</div>
                </div>
              </div>
              <div class="factor-item">
                <div class="factor-icon">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </div>
                <div class="factor-content">
                  <div class="factor-title">Race Pacing</div>
                  <div class="factor-text">Inform pacing strategies based on sustainable power for event durations</div>
                </div>
              </div>
              <div class="factor-item">
                <div class="factor-icon">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
                  </svg>
                </div>
                <div class="factor-content">
                  <div class="factor-title">Monitor Fitness</div>
                  <div class="factor-text">Track how your curve shifts upward as fitness improves over training blocks</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    document.getElementById('page-content').innerHTML = html;
  },

  setupEventListeners() {
    const rangeRoot = document.getElementById('pc-quick-range');
    rangeRoot?.querySelectorAll('button[data-range]').forEach(btn => {
      btn.addEventListener('click', async () => {
        rangeRoot.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.state.range = btn.dataset.range || '90';
        this.applyRangeFromState();
        await this.loadData();
      });
    });

    document.getElementById('pc-apply')?.addEventListener('click', async () => {
      this.state.range = 'custom';
      this.readDatesFromInputs();
      await this.loadData();
    });

    document.getElementById('pc-clear')?.addEventListener('click', async () => {
      this.applyDefaultRange(true);
      await this.loadData();
    });

    document.getElementById('pc-refresh')?.addEventListener('click', () => this.loadData());

    document.getElementById('pc-weighted')?.addEventListener('change', async (e) => {
      this.state.weighted = !!e.target.checked;
      await this.loadData();
    });

    document.getElementById('pc-start')?.addEventListener('change', () => {
      const s = this.el('pc-start').value;
      const e = this.el('pc-end').value;
      if (e && s && e < s) this.el('pc-end').value = s;
    });
    
    document.getElementById('pc-end')?.addEventListener('change', () => {
      const s = this.el('pc-start').value;
      const e = this.el('pc-end').value;
      if (e && s && e < s) this.el('pc-start').value = e;
    });
  },

  async hydrateWeight() {
    try {
      const settings = await API.getSettings().catch(() => ({}));
      if (settings && settings.weight) this.state.userWeight = Number(settings.weight);
    } catch { /* noop */ }
  },

  applyDefaultRange(resetToggle = false) {
    if (resetToggle) this.state.range = '90';
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 89);

    this.state.start = start;
    this.state.end = end;

    this.syncInputsFromState();
    const root = document.getElementById('pc-quick-range');
    root?.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.range === this.state.range));
  },

  applyRangeFromState() {
    const end = new Date();
    let start = null;

    switch (this.state.range) {
      case '30':  start = new Date(end); start.setDate(end.getDate() - 29); break;
      case '90':  start = new Date(end); start.setDate(end.getDate() - 89); break;
      case '180': start = new Date(end); start.setDate(end.getDate() - 179); break;
      case '365': start = new Date(end.getFullYear(), 0, 1); break;
      case 'all': start = null; break;
      default:    return;
    }
    this.state.start = start;
    this.state.end = end;
    this.syncInputsFromState();
  },

  syncInputsFromState() {
    const toISO = d => d ? new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,10) : '';
    this.el('pc-start').value = toISO(this.state.start);
    this.el('pc-end').value = toISO(this.state.end);
  },

  readDatesFromInputs() {
    const s = this.el('pc-start').value ? new Date(this.el('pc-start').value) : null;
    const e = this.el('pc-end').value ? new Date(this.el('pc-end').value) : null;
    this.state.start = s;
    this.state.end = e;
  },

  async loadData() {
    const container = document.getElementById('power-curve-chart');
    if (!container) return;
    
    container.innerHTML = '<div class="loading"><div class="spinner"></div><p style="color:var(--text-muted);">Loading...</p></div>';

    try {
      const params = { weighted: this.state.weighted };
      if (this.state.range !== 'all' && this.state.start && this.state.end) {
        params.start = this.state.start.toISOString().slice(0,10);
        params.end = this.state.end.toISOString().slice(0,10);
      }

      const data = await AnalysisAPI.getPowerCurve(params);

      if (!data || !Array.isArray(data.durations) || !Array.isArray(data.powers) || data.durations.length === 0) {
        this.showEmptyState(container);
        return;
      }

      this.state.data = data;
      this.drawChart(data);
      this.updateMeta(data);
      this.updateStats(data);

    } catch (err) {
      console.error('[PowerCurve] loadData failed:', err);
      container.innerHTML = `
        <div class="empty-state">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <h3>Error Loading Data</h3>
          <p>${err.message}</p>
        </div>
      `;
      notify('Failed to load power curve', 'error');
    }
  },

  showEmptyState(container) {
    container.innerHTML = `
      <div class="empty-state">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
        </svg>
        <h3>No Power Data Available</h3>
        <p>Upload some FIT files with power data to see your power duration curve.</p>
      </div>
    `;
    const meta = document.getElementById('pc-meta');
    if (meta) meta.textContent = 'No data';
    const statsCards = document.getElementById('pc-stats-cards');
    if (statsCards) statsCards.style.display = 'none';
  },

  updateMeta(data) {
    const meta = document.getElementById('pc-meta');
    if (!meta) return;
    const rangeLabel = this.state.range === 'custom'
      ? `${this.el('pc-start').value || '…'} → ${this.el('pc-end').value || '…'}`
      : ({'30':'Last 30 days','90':'Last 90 days','180':'Last 180 days','365':'YTD','all':'All time'}[this.state.range] || 'Range');

    const unit = this.state.weighted ? 'W/kg' : 'W';
    meta.textContent = `${rangeLabel} • ${data?.durations?.length || 0} data points • ${unit}`;
  },

  updateStats(data) {
    const statsCards = document.getElementById('pc-stats-cards');
    if (!statsCards) return;

    const findPowerAt = (targetDuration) => {
      const idx = data.durations.findIndex(d => d >= targetDuration);
      if (idx === -1) return null;
      if (idx === 0) return data.powers[0];
      
      const x0 = data.durations[idx - 1];
      const x1 = data.durations[idx];
      const y0 = data.powers[idx - 1];
      const y1 = data.powers[idx];
      const t = (targetDuration - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    };

    const power5s = findPowerAt(5);
    const power1m = findPowerAt(60);
    const power5m = findPowerAt(300);
    const power20m = findPowerAt(1200);

    const unit = this.state.weighted ? ' W/kg' : ' W';
    
    this.el('stat-5s').textContent = power5s ? Math.round(power5s) + unit : '—';
    this.el('stat-1m').textContent = power1m ? Math.round(power1m) + unit : '—';
    this.el('stat-5m').textContent = power5m ? Math.round(power5m) + unit : '—';
    this.el('stat-20m').textContent = power20m ? Math.round(power20m) + unit : '—';

    statsCards.style.display = 'grid';
  },

  drawChart(data) {
    const container = document.getElementById('power-curve-chart');
    if (!container) return;

    container.innerHTML = '';
    
    const x = data.durations;
    const y = data.powers;

    // Helper function to find power at specific duration
    const findPowerAt = (targetDuration) => {
      const idx = data.durations.findIndex(d => d >= targetDuration);
      if (idx === -1) return null;
      if (idx === 0) return data.powers[0];
      
      const x0 = data.durations[idx - 1];
      const x1 = data.durations[idx];
      const y0 = data.powers[idx - 1];
      const y1 = data.powers[idx];
      const t = (targetDuration - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    };

    // Main power curve trace with gradient
    const trace = {
      x, y,
      type: 'scatter',
      mode: 'lines',
      line: { 
        shape: 'spline', 
        smoothing: 0.6,
        color: '#3b82f6',
        width: 4
      },
      fill: 'tozeroy',
      fillcolor: 'rgba(59,130,246,0.15)',
      hovertemplate: '<b>Duration: %{x:.0f}s</b><br>Power: <b>%{y:.1f} ' + (this.state.weighted ? 'W/kg' : 'W') + '</b><extra></extra>',
      name: 'Power Curve',
      hoverlabel: {
        bgcolor: '#1e293b',
        bordercolor: '#3b82f6',
        font: { size: 13, color: '#fff', family: 'Inter' }
      }
    };

    const traces = [trace];
    
    // Add key duration markers
    const keyDurations = [
      { duration: 5, label: '5s', color: '#3b82f6' },
      { duration: 60, label: '1m', color: '#8b5cf6' },
      { duration: 300, label: '5m', color: '#10b981' },
      { duration: 1200, label: '20m', color: '#f59e0b' }
    ];

    const annotations = [];
    keyDurations.forEach(kd => {
      const power = findPowerAt(kd.duration);
      if (power) {
        // Add marker trace
        traces.push({
          x: [kd.duration],
          y: [power],
          type: 'scatter',
          mode: 'markers',
          marker: {
            size: 12,
            color: kd.color,
            line: { color: '#fff', width: 3 },
            symbol: 'circle'
          },
          showlegend: false,
          hovertemplate: `<b>${kd.label}</b><br>${Math.round(power)} ${this.state.weighted ? 'W/kg' : 'W'}<extra></extra>`,
          hoverlabel: {
            bgcolor: '#1e293b',
            bordercolor: kd.color,
            font: { size: 13, color: '#fff', family: 'Inter' }
          }
        });

        // Add annotation
        annotations.push({
          x: Math.log10(kd.duration),
          y: power,
          xref: 'x',
          yref: 'y',
          text: `<b>${kd.label}</b><br>${Math.round(power)}${this.state.weighted ? ' W/kg' : 'W'}`,
          showarrow: true,
          arrowhead: 2,
          arrowsize: 1,
          arrowwidth: 2,
          arrowcolor: kd.color,
          ax: 0,
          ay: -40,
          bgcolor: 'rgba(255,255,255,0.95)',
          bordercolor: kd.color,
          borderwidth: 2,
          borderpad: 6,
          font: { size: 11, color: '#1e293b', family: 'Inter' }
        });
      }
    });
    
    const unitLabel = this.state.weighted ? 'Power (W/kg)' : 'Power (W)';
    const layout = {
      margin: { l: 70, r: 30, t: 30, b: 60 },
      xaxis: {
        title: { 
          text: 'Duration', 
          font: { size: 14, color: '#475569', family: 'Inter', weight: 600 },
          standoff: 15
        },
        type: 'log',
        tickvals: [1, 5, 10, 20, 30, 60, 120, 300, 600, 1200, 1800, 3600],
        ticktext: ['1s','5s','10s','20s','30s','1m','2m','5m','10m','20m','30m','1h'],
        tickfont: { size: 12, color: '#64748b', family: 'Inter' },
        gridcolor: 'rgba(148,163,184,0.15)',
        gridwidth: 1,
        showline: true,
        linecolor: '#cbd5e1',
        linewidth: 2,
        zeroline: false
      },
      yaxis: {
        title: { 
          text: unitLabel, 
          font: { size: 14, color: '#475569', family: 'Inter', weight: 600 },
          standoff: 15
        },
        rangemode: 'tozero',
        tickfont: { size: 12, color: '#64748b', family: 'Inter' },
        gridcolor: 'rgba(148,163,184,0.15)',
        gridwidth: 1,
        showline: true,
        linecolor: '#cbd5e1',
        linewidth: 2,
        zeroline: true,
        zerolinecolor: '#cbd5e1',
        zerolinewidth: 2
      },
      hovermode: 'closest',
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'rgba(248,250,252,0.5)',
      font: { family: 'Inter, sans-serif', size: 12, color: '#64748b' },
      annotations: annotations,
      showlegend: false
    };

    const config = { 
      displayModeBar: false, 
      responsive: true,
      doubleClick: false
    };
    
    if (window.Plotly?.newPlot) {
      window.Plotly.newPlot(container, traces, layout, config);
    } else {
      container.innerHTML = '<div class="empty-state"><h3>Plotly not loaded</h3><p>Chart library failed to load</p></div>';
    }
  },

  el(id) { return document.getElementById(id); }
};

export default powerCurvePage;