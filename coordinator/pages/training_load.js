// ============================================
// FILE: training_load.js - Updated Design
// ============================================
import { API } from '../../core/api.js';

export const trainingLoadPage = {
  chartInstance: null,

  async load() {
    const root = document.getElementById('page-content');
    root.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:center; min-height:300px;">
        <div style="text-align:center;">
          <div class="spinner" style="width:40px;height:40px;border:3px solid var(--border);border-top-color:#3b82f6;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 16px;"></div>
          <p style="color:var(--text-muted);">Loading Training Load Data...</p>
        </div>
      </div>
      <style>
        @keyframes spin { to { transform: rotate(360deg); } }
      </style>
    `;

    try {
      const data = await API.getTrainingLoad({ days: 90 }).catch(err => {
        console.warn('[TrainingLoad] API error:', err);
        return null;
      });

      if (!data || !data.daily || data.daily.length === 0) {
        root.innerHTML = `
          <div style="padding:80px; text-align:center;">
            <svg style="width:80px; height:80px; opacity:0.3; margin:0 auto 24px; color:var(--text-muted);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"/>
            </svg>
            <h3 style="font-size:20px; font-weight:600; color:var(--text); margin-bottom:12px;">No Training Load Data</h3>
            <p style="color:var(--text-muted);">Upload activities with TSS data to see your training load trends.</p>
          </div>
        `;
        return;
      }

      root.innerHTML = this.template();
      this.updateMetrics(data);
      this.initChart(data);
      this.setupControls();

    } catch (err) {
      console.error('[TrainingLoad] load error:', err);
      root.innerHTML = `
        <div style="padding:40px; text-align:center;">
          <svg style="width:64px; height:64px; opacity:0.3; margin:0 auto 16px; color:var(--error);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <h3 style="color:var(--text); font-size:18px; font-weight:600; margin-bottom:8px;">Error Loading Training Load</h3>
          <p style="color:var(--text-muted);">${err?.message || 'Unknown error'}</p>
        </div>
      `;
    }
  },

  template() {
    return `
      <style>
        .tl-section { display:grid; gap:20px; }
        .tl-header { margin-bottom:8px; }
        .tl-header h1 { 
          font-size:32px; font-weight:700; color:var(--text); 
          margin:0 0 6px 0; letter-spacing:-0.02em;
        }
        .tl-header p { 
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
          border-color:#f59e0b;
          box-shadow:0 12px 28px rgba(245,158,11,0.2), 0 0 0 1px #f59e0b;
        }
        
        .metric-card:nth-child(3):hover {
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
        
        .tl-insight {
          background:linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(139,92,246,0.1) 100%);
          border:1.5px solid #3b82f6; border-radius:12px; padding:18px;
          display:flex; gap:14px; margin-top:16px;
        }
        .tl-insight svg {
          width:24px; height:24px; color:#3b82f6; flex-shrink:0; margin-top:2px;
        }
        .tl-insight-content { flex:1; }
        .tl-insight-title {
          font-weight:700; font-size:15px; color:var(--text); margin-bottom:6px;
        }
        .tl-insight-text {
          font-size:13px; color:var(--text-muted); line-height:1.6;
        }
        .tl-insight-text strong { color:var(--text); }
      </style>

      <div class="tl-section">
        <div class="tl-header">
          <h1>Training Load Analysis</h1>
          <p>Track your fitness (CTL), fatigue (ATL), and form (TSB) over time</p>
        </div>

        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-header-row">
              <div class="metric-icon primary">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
                </svg>
              </div>
              <div class="metric-label">Fitness (CTL)</div>
            </div>
            <div class="metric-value" id="ctl-value">–</div>
            <div class="metric-subtitle">Chronic Training Load</div>
          </div>
          
          <div class="metric-card">
            <div class="metric-header-row">
              <div class="metric-icon amber">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                </svg>
              </div>
              <div class="metric-label">Fatigue (ATL)</div>
            </div>
            <div class="metric-value" id="atl-value">–</div>
            <div class="metric-subtitle">Acute Training Load</div>
          </div>
          
          <div class="metric-card">
            <div class="metric-header-row">
              <div class="metric-icon green">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <div class="metric-label">Form (TSB)</div>
            </div>
            <div class="metric-value" id="tsb-value">–</div>
            <div class="metric-subtitle">Training Stress Balance</div>
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
                  <div class="chart-title">Training Load Trend</div>
                  <div class="chart-subtitle">Fitness, fatigue, and form progression</div>
                </div>
              </div>
            </div>
            <div class="chart-controls">
              <button class="chart-control" data-range="30">30d</button>
              <button class="chart-control active" data-range="90">90d</button>
              <button class="chart-control" data-range="180">180d</button>
            </div>
          </div>
          <div class="chart-container">
            <canvas id="training-load-chart" aria-label="Training Load Chart"></canvas>
          </div>
          
          <div class="tl-insight" id="form-insight">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <div class="tl-insight-content">
              <div class="tl-insight-title">Current Status</div>
              <div class="tl-insight-text">
                Loading form analysis...
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  updateMetrics(data) {
    const ctl = data?.current?.ctl ?? 0;
    const atl = data?.current?.atl ?? 0;
    const tsb = data?.current?.tsb ?? 0;

    const set = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };

    set('ctl-value', ctl.toFixed(1));
    set('atl-value', atl.toFixed(1));
    set('tsb-value', tsb.toFixed(1));

    // Update form insight
    let freshnessMsg, freshnessColor;
    if (tsb > 10) {
      freshnessMsg = '<strong>Fresh & Ready</strong> – Great time for high-intensity training or racing. Your form is optimal.';
      freshnessColor = '#10b981';
    } else if (tsb > 0) {
      freshnessMsg = '<strong>Balanced</strong> – Good balance between fitness and fatigue. Moderate training load recommended.';
      freshnessColor = '#3b82f6';
    } else if (tsb > -10) {
      freshnessMsg = '<strong>Slightly Fatigued</strong> – Fatigue is building. Consider recovery or lighter training days.';
      freshnessColor = '#f59e0b';
    } else {
      freshnessMsg = '<strong>Fatigued</strong> – Significant fatigue detected. Prioritize recovery to avoid overtraining.';
      freshnessColor = '#ef4444';
    }

    const insight = document.getElementById('form-insight');
    if (insight) {
      insight.style.borderColor = freshnessColor;
      insight.querySelector('svg').style.color = freshnessColor;
      insight.querySelector('.tl-insight-text').innerHTML = freshnessMsg;
    }

    // Update TSB value color
    const tsbEl = document.getElementById('tsb-value');
    if (tsbEl) {
      tsbEl.style.color = freshnessColor;
    }
  },

  initChart(data) {
    const ctx = document.getElementById('training-load-chart');
    if (!ctx || typeof Chart === 'undefined') return;

    if (this.chartInstance) {
      this.chartInstance.destroy();
      this.chartInstance = null;
    }

    const labels = [];
    const ctlData = [];
    const atlData = [];
    const tsbData = [];

    if (data?.daily?.length) {
      data.daily.forEach(day => {
        labels.push(new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        ctlData.push(day.ctl ?? 0);
        atlData.push(day.atl ?? 0);
        tsbData.push(day.tsb ?? 0);
      });
    }

    this.chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'CTL (Fitness)',
            data: ctlData,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            fill: true,
            tension: 0.4,
            borderWidth: 3,
            pointRadius: 0,
            pointHoverRadius: 6,
            pointBackgroundColor: '#3b82f6',
            pointBorderColor: '#fff',
            pointBorderWidth: 2
          },
          {
            label: 'ATL (Fatigue)',
            data: atlData,
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            fill: true,
            tension: 0.4,
            borderWidth: 3,
            pointRadius: 0,
            pointHoverRadius: 6,
            pointBackgroundColor: '#f59e0b',
            pointBorderColor: '#fff',
            pointBorderWidth: 2
          },
          {
            label: 'TSB (Form)',
            data: tsbData,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            fill: true,
            tension: 0.4,
            borderWidth: 3,
            pointRadius: 0,
            pointHoverRadius: 6,
            pointBackgroundColor: '#10b981',
            pointBorderColor: '#fff',
            pointBorderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
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
              label: (context) => {
                return `${context.dataset.label}: ${context.parsed.y.toFixed(1)}`;
              }
            }
          }
        },
        scales: {
          y: { 
            beginAtZero: false,
            grid: { color: 'rgba(0,0,0,.04)' },
            ticks: { 
              font: { size: 11, weight: '500' },
              color: 'var(--text-muted)'
            },
            title: {
              display: true,
              text: 'Training Load',
              font: { size: 13, weight: '700' },
              color: 'var(--text-muted)',
              padding: { bottom: 10 }
            }
          },
          x: { 
            grid: { display: false },
            ticks: { 
              font: { size: 11, weight: '500' },
              color: 'var(--text-muted)',
              maxRotation: 45,
              minRotation: 0
            }
          }
        }
      }
    });
  },

  setupControls() {
    document.querySelectorAll('.chart-control').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        document.querySelectorAll('.chart-control').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        
        const range = e.target.dataset.range;
        const data = await API.getTrainingLoad({ days: range });
        
        if (data && data.daily && data.daily.length > 0) {
          this.updateMetrics(data);
          this.initChart(data);
        }
      });
    });
  },

  async refresh() {
    await this.load();
  }
};

export default trainingLoadPage;