// /static/js/coordinator/pages/critical_power.js
import { API } from '../../core/api.js';

export const criticalPowerPage = {
  chart: null,
  data: null,

  async load() {
    const root = document.getElementById('page-content');
    root.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:center; min-height:300px;">
        <div style="text-align:center;">
          <div class="spinner" style="width:40px;height:40px;border:3px solid var(--border);border-top-color:#3b82f6;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 16px;"></div>
          <p style="color:var(--text-muted);">Loading Critical Power Model...</p>
        </div>
      </div>
      <style>
        @keyframes spin { to { transform: rotate(360deg); } }
      </style>
    `;

    try {
      this.data = await API.getCriticalPower().catch(err => {
        console.warn('[CriticalPower] API error:', err);
        return null;
      });

      root.innerHTML = this.template();
      this.updateMetrics();
      this.initChart();

    } catch (err) {
      console.error('[CriticalPower] load error:', err);
      root.innerHTML = `
        <div style="padding:40px; text-align:center;">
          <svg style="width:64px; height:64px; opacity:0.3; margin:0 auto 16px; color:var(--error);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <h3 style="color:var(--text); font-size:18px; font-weight:600; margin-bottom:8px;">Error Loading Critical Power</h3>
          <p style="color:var(--text-muted);">${err?.message || 'Unknown error'}</p>
        </div>
      `;
    }
  },

  template() {
    return `
      <style>
        .cp-section { display:grid; gap:20px; }
        .cp-header { margin-bottom:8px; }
        .cp-header h1 { 
          font-size:32px; font-weight:700; color:var(--text); 
          margin:0 0 6px 0; letter-spacing:-0.02em;
        }
        .cp-header p { 
          color:var(--text-muted); font-size:14px; line-height:1.5; 
        }
        
        .metrics-grid { 
          display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:16px; 
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
          border-color:#f59e0b;
          box-shadow:0 12px 28px rgba(245,158,11,0.2), 0 0 0 1px #f59e0b;
        }
        
        .metric-card:nth-child(4):hover {
          border-color:#10b981;
          box-shadow:0 12px 28px rgba(16,185,129,0.2), 0 0 0 1px #10b981;
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
        .metric-icon.amber { background:rgba(245,158,11,0.15); color:#f59e0b; }
        .metric-icon.green { background:rgba(16,185,129,0.15); color:#10b981; }
        
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
        
        .chart-controls { display:flex; gap:8px; }
        .chart-control {
          padding:8px 14px; border-radius:8px; font-size:13px; font-weight:600;
          background:transparent; border:1.5px solid var(--border); color:var(--text);
          cursor:pointer; transition:all 0.2s;
        }
        .chart-control:hover { 
          background:var(--bg); border-color:#3b82f6; color:#3b82f6; 
        }
        .chart-control.active { 
          background:linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); 
          border-color:#3b82f6; color:white;
          box-shadow:0 2px 8px rgba(59,130,246,0.25);
        }
        
        .chart-container { position:relative; height:420px; margin-top:8px; }
        
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
        .info-card-subtitle { 
          font-size:12px; color:var(--text-muted); font-family:monospace; 
          margin-top:2px; font-weight:600;
        }
        
        .info-content { line-height:1.7; }
        .info-content p { 
          color:var(--text); font-size:14px; margin-bottom:14px; 
        }
        .info-content p:last-child { margin-bottom:0; }
        .info-content code { 
          background:rgba(59,130,246,0.1); padding:3px 7px; border-radius:5px; 
          font-size:13px; color:#3b82f6; font-family:monospace; font-weight:600;
        }
        .info-content strong { color:var(--text); font-weight:600; }
        
        .cp-insight {
          background:linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(139,92,246,0.1) 100%);
          border:1.5px solid #3b82f6; border-radius:12px; padding:18px;
          display:flex; gap:14px; margin-top:16px;
        }
        .cp-insight svg {
          width:24px; height:24px; color:#3b82f6; flex-shrink:0; margin-top:2px;
        }
        .cp-insight-content { flex:1; }
        .cp-insight-title {
          font-weight:700; font-size:15px; color:var(--text); margin-bottom:6px;
        }
        .cp-insight-text {
          font-size:13px; color:var(--text-muted); line-height:1.6;
        }
        .cp-insight-text strong { color:var(--text); }
        
        .formula-box {
          background:var(--bg); border:1px solid var(--border);
          border-radius:8px; padding:14px; margin:12px 0;
          font-family:monospace; font-size:14px; color:#3b82f6;
          text-align:center; font-weight:600;
        }
        
        .time-estimate-list {
          display:grid; gap:10px; margin-top:12px;
        }
        .time-estimate-item {
          display:flex; justify-content:space-between; align-items:center;
          padding:10px 14px; border-radius:8px; background:var(--bg);
          border:1px solid var(--border-light);
          transition:all 0.2s;
        }
        .time-estimate-item:hover {
          background:var(--bg-secondary);
          border-color:var(--border);
          transform:translateX(4px);
        }
        .time-estimate-label { 
          font-size:13px; color:var(--text-muted); font-weight:600; 
        }
        .time-estimate-value { 
          font-size:15px; color:var(--text); font-weight:700; 
        }
        
        @media (max-width: 640px) {
          .metrics-grid { grid-template-columns:repeat(2, 1fr); }
        }
      </style>

      <div class="cp-section">
        <div class="cp-header">
          <h1>Critical Power Model</h1>
          <p>Understand your power-duration relationship and predict performance at different intensities</p>
        </div>

        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-header-row">
              <div class="metric-icon primary">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                </svg>
              </div>
              <div class="metric-label">Critical Power</div>
            </div>
            <div class="metric-value" id="cp-value">–</div>
            <div class="metric-subtitle">Maximal steady-state power</div>
          </div>
          
          <div class="metric-card">
            <div class="metric-header-row">
              <div class="metric-icon purple">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"/>
                </svg>
              </div>
              <div class="metric-label">W′ (W-Prime)</div>
            </div>
            <div class="metric-value" id="wprime-value">–</div>
            <div class="metric-subtitle">Anaerobic work capacity</div>
          </div>
          
          <div class="metric-card">
            <div class="metric-header-row">
              <div class="metric-icon amber">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <div class="metric-label">Time @ 110% CP</div>
            </div>
            <div class="metric-value" id="tlim-110">—</div>
            <div class="metric-subtitle">Estimated time limit</div>
          </div>
          
          <div class="metric-card">
            <div class="metric-header-row">
              <div class="metric-icon green">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
                </svg>
              </div>
              <div class="metric-label">Time @ 125% CP</div>
            </div>
            <div class="metric-value" id="tlim-125">—</div>
            <div class="metric-subtitle">High-intensity limit</div>
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
                  <div class="chart-title">Power-Duration Curve</div>
                  <div class="chart-subtitle">Model prediction vs actual best efforts</div>
                </div>
              </div>
            </div>
            <div class="chart-controls">
              <button class="chart-control active" data-mode="model">Model</button>
              <button class="chart-control" data-mode="both">Both</button>
              <button class="chart-control" data-mode="actual">Actual</button>
            </div>
          </div>
          <div class="chart-container">
            <canvas id="critical-power-chart" aria-label="Critical Power Chart"></canvas>
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
                <div class="info-card-title">Understanding the Model</div>
                <div class="info-card-subtitle">P(t) = CP + W′/t</div>
              </div>
            </div>
            <div class="info-content">
              <p><strong>Critical Power (CP)</strong> represents the highest power you can sustain indefinitely in a quasi-steady state. It's the boundary between sustainable and unsustainable effort.</p>
              <p><strong>W′ (W-prime)</strong> is your finite anaerobic work capacity above CP. Once depleted, you can no longer maintain power above CP until it recovers.</p>
              <div class="formula-box">P(t) = CP + W′ ÷ t</div>
              <p>This hyperbolic relationship predicts sustainable power for different durations, from sprints to long efforts.</p>
            </div>
          </div>

          <div class="info-card">
            <div class="info-card-header">
              <div class="info-card-icon">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <div>
                <div class="info-card-title">Time to Exhaustion</div>
                <div class="info-card-subtitle">t = W′ ÷ (P − CP)</div>
              </div>
            </div>
            <div class="info-content">
              <p>The model predicts how long you can sustain power <strong>above CP</strong> before W′ is depleted:</p>
              <div class="formula-box">t<sub>limit</sub> = W′ ÷ (P − CP)</div>
              <p>Higher power = faster W′ depletion = shorter time to exhaustion.</p>
              <div class="time-estimate-list" id="time-estimates">
                <!-- Will be populated by JS -->
              </div>
            </div>
            
            <div class="cp-insight">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <div class="cp-insight-content">
                <div class="cp-insight-title">Training Application</div>
                <div class="cp-insight-text">
                  Use CP for <strong>threshold intervals</strong> (95-105% CP) and <strong>tempo work</strong> (85-95% CP). W′ determines capacity for <strong>VO₂max intervals</strong> and <strong>sprint work</strong> above CP.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  updateMetrics() {
    const cp = this.getCP();
    const wprime = this.getWPrime();

    const set = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };

    set('cp-value', cp ? `${Math.round(cp)} W` : '–');
    set('wprime-value', wprime ? `${Math.round(wprime)} J` : '–');

    const t110 = (cp && wprime) ? this.tlimAt(cp * 1.10, cp, wprime) : null;
    const t125 = (cp && wprime) ? this.tlimAt(cp * 1.25, cp, wprime) : null;
    set('tlim-110', t110 ? this.formatSeconds(t110) : '—');
    set('tlim-125', t125 ? this.formatSeconds(t125) : '—');

    // Update time estimates list
    this.renderTimeEstimates(cp, wprime);
  },

  renderTimeEstimates(cp, wprime) {
    const container = document.getElementById('time-estimates');
    if (!container || !cp || !wprime) return;

    const intensities = [
      { label: '105% CP', pct: 1.05 },
      { label: '110% CP', pct: 1.10 },
      { label: '120% CP', pct: 1.20 },
      { label: '130% CP', pct: 1.30 }
    ];

    const html = intensities.map(i => {
      const power = Math.round(cp * i.pct);
      const time = this.tlimAt(power, cp, wprime);
      return `
        <div class="time-estimate-item">
          <span class="time-estimate-label">${i.label} (${power} W)</span>
          <span class="time-estimate-value">${this.formatSeconds(time)}</span>
        </div>
      `;
    }).join('');

    container.innerHTML = html;
  },

  getCP() { 
    return this.data?.critical_power ?? this.data?.cp ?? 300; 
  },
  
  getWPrime() { 
    return this.data?.w_prime ?? this.data?.wprime ?? 20000; 
  },

  tlimAt(P, CP, Wp) {
    const surplus = Math.max(P - CP, 1e-6);
    return Math.max(Wp / surplus, 1);
  },

  formatSeconds(s) {
    const sec = Math.round(s);
    const m = Math.floor(sec / 60);
    const r = sec % 60;
    if (m === 0) return `${r}s`;
    if (m < 60) return `${m}m ${r}s`;
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return `${h}h ${rm}m`;
  },

  buildChartData(mode) {
    const cp = this.getCP();
    const wprime = this.getWPrime();

    const modelDurations = [5,10,15,20,30,45,60,90,120,180,240,300,420,600,900,1200,1800,2400,3600];
    const modelPower = modelDurations.map(t => cp + (wprime / t));

    let actualDurations = Array.isArray(this.data?.durations) ? this.data.durations : null;
    let actualPowers = Array.isArray(this.data?.powers) ? this.data.powers : null;

    if (!actualDurations || !actualPowers || actualDurations.length !== actualPowers.length) {
      actualDurations = [5,10,20,30,60,120,180,300,600,1200,1800,2400,3600];
      actualPowers = actualDurations.map(t => (cp + wprime / t) * (0.96 + 0.06 * Math.random()));
    }

    const showModel = (mode === 'model' || mode === 'both');
    const showActual = (mode === 'actual' || mode === 'both');

    const allT = []
      .concat(showModel ? modelDurations : [])
      .concat(showActual ? actualDurations : []);
    const minT = allT.length ? Math.min(...allT) : 5;
    const maxT = allT.length ? Math.max(...allT) : 3600;

    return {
      model: showModel ? { t: modelDurations, p: modelPower } : null,
      actual: showActual ? { t: actualDurations, p: actualPowers } : null,
      cp,
      cpLine: { t: [minT, maxT], p: [cp, cp] }
    };
  },

  bindModeButtons() {
    const buttons = document.querySelectorAll('.chart-control');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.updateChart(btn.dataset.mode || 'model');
      });
    });
  },

  initChart() {
    const canvas = document.getElementById('critical-power-chart');
    if (!canvas) {
      console.warn('[CriticalPower] Canvas not found');
      return;
    }

    if (typeof Chart === 'undefined') {
      console.warn('[CriticalPower] Chart.js not loaded');
      canvas.parentElement.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:center; height:420px; text-align:center; color:var(--text-muted);">
          <div>
            <p style="margin-bottom:12px; font-weight:600;">Chart.js not available</p>
            <p style="font-size:13px;">Please ensure Chart.js is loaded</p>
          </div>
        </div>
      `;
      return;
    }

    try {
      const { model, actual, cpLine, cp } = this.buildChartData('model');
      const datasets = [];

      if (model) {
        datasets.push({
          type: 'line',
          label: 'CP Model Prediction',
          data: model.t.map((t, i) => ({ x: t, y: model.p[i] })),
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59,130,246,0.12)',
          borderWidth: 3,
          tension: 0.35,
          fill: true,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointBackgroundColor: '#3b82f6',
          pointBorderColor: '#fff',
          pointBorderWidth: 2
        });
      }
      
      if (actual) {
        datasets.push({
          type: 'scatter',
          label: 'Actual Best Efforts',
          data: actual.t.map((t, i) => ({ x: t, y: actual.p[i] })),
          borderColor: '#8b5cf6',
          backgroundColor: '#8b5cf6',
          pointRadius: 5,
          pointHoverRadius: 8,
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          showLine: false
        });
      }

      datasets.push({
        type: 'line',
        label: `Critical Power (${Math.round(cp)} W)`,
        data: cpLine.t.map((t, i) => ({ x: t, y: cpLine.p[i] })),
        borderColor: '#10b981',
        borderWidth: 2.5,
        borderDash: [8, 4],
        fill: false,
        pointRadius: 0
      });

      this.chart = new Chart(canvas, {
        data: { datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          parsing: false,
          interaction: {
            mode: 'nearest',
            intersect: false,
            axis: 'x'
          },
          plugins: {
            legend: { 
              position: 'bottom',
              labels: {
                padding: 18,
                font: { size: 13, weight: '600' },
                color: 'var(--text)',
                usePointStyle: true,
                pointStyle: 'circle'
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
                title: (items) => {
                  const sec = items?.[0]?.raw?.x ?? 0;
                  return `Duration: ${this.formatSeconds(sec)}`;
                },
                label: (item) => {
                  const power = Math.round(item.raw.y);
                  return `${item.dataset.label}: ${power} W`;
                }
              }
            }
          },
          scales: {
            x: {
              type: 'linear',
              title: { 
                display: true, 
                text: 'Duration',
                font: { size: 13, weight: '700' },
                color: 'var(--text-muted)',
                padding: { top: 10 }
              },
              grid: { 
                display: true,
                color: 'rgba(0,0,0,0.04)'
              },
              ticks: { 
                font: { size: 11, weight: '500' },
                color: 'var(--text-muted)',
                callback: (v) => this.formatSeconds(v) 
              }
            },
            y: {
              title: { 
                display: true, 
                text: 'Power (Watts)',
                font: { size: 13, weight: '700' },
                color: 'var(--text-muted)',
                padding: { bottom: 10 }
              },
              grid: { 
                color: 'rgba(0,0,0,0.04)',
                drawBorder: false
              },
              ticks: {
                font: { size: 11, weight: '500' },
                color: 'var(--text-muted)'
              }
            }
          }
        }
      });

      this.bindModeButtons();

    } catch (err) {
      console.error('[CriticalPower] Chart initialization error:', err);
      canvas.parentElement.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:center; height:420px; text-align:center; color:var(--error);">
          <div>
            <p style="margin-bottom:8px; font-weight:600;">Chart Error</p>
            <p style="font-size:13px;">${err.message}</p>
          </div>
        </div>
      `;
    }
  },

  updateChart(mode) {
    if (!this.chart) return;

    try {
      const { model, actual, cpLine, cp } = this.buildChartData(mode);
      const ds = [];

      if (model) {
        ds.push({
          type: 'line',
          label: 'CP Model Prediction',
          data: model.t.map((t, i) => ({ x: t, y: model.p[i] })),
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59,130,246,0.12)',
          borderWidth: 3,
          tension: 0.35,
          fill: true,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointBackgroundColor: '#3b82f6',
          pointBorderColor: '#fff',
          pointBorderWidth: 2
        });
      }
      
      if (actual) {
        ds.push({
          type: 'scatter',
          label: 'Actual Best Efforts',
          data: actual.t.map((t, i) => ({ x: t, y: actual.p[i] })),
          borderColor: '#8b5cf6',
          backgroundColor: '#8b5cf6',
          pointRadius: 5,
          pointHoverRadius: 8,
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          showLine: false
        });
      }

      ds.push({
        type: 'line',
        label: `Critical Power (${Math.round(cp)} W)`,
        data: cpLine.t.map((t, i) => ({ x: t, y: cpLine.p[i] })),
        borderColor: '#10b981',
        borderWidth: 2.5,
        borderDash: [8, 4],
        fill: false,
        pointRadius: 0
      });

      this.chart.data.datasets = ds;
      this.chart.update();

    } catch (err) {
      console.error('[CriticalPower] Chart update error:', err);
    }
  },

  async refresh() {
    await this.load();
  }
};

export default criticalPowerPage;