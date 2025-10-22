// /static/js/coordinator/pages/vo2max.js
import { API } from '../../core/api.js';
import { formatDate } from '../../core/utils.js';

export const vo2maxPage = {
  _chart: null,

  async load() {
    const root = document.getElementById('page-content');
    root.innerHTML = `<div class="loading" style="padding:80px; text-align:center;"><div style="width:48px; height:48px; border:4px solid var(--border); border-top-color:var(--primary); border-radius:50%; margin:0 auto 24px; animation:spin 1s linear infinite;"></div>Loading VO2Max data...</div><style>@keyframes spin { to { transform: rotate(360deg); } }</style>`;

    try {
      const [vo2Data, settings] = await Promise.all([
        API.getVO2Max().catch(() => null),
        API.getSettings().catch(() => ({}))
      ]);

      const current = this._extractCurrent(vo2Data);
      const history = this._extractHistory(vo2Data);

      // Show empty state if no data
      if (current === null && history.length === 0) {
        this.showEmptyState(root);
        return;
      }

      root.innerHTML = this.template();
      
      const age = Number(settings?.age) || 30;
      const gender = String(settings?.gender || 'male').toLowerCase();
      const trend = this._calculateTrend(history);
      const category = current !== null ? this._getCategory(current, age, gender) : '–';

      this._updateMetrics(current, category, trend);
      this._renderChart(history);
      this._renderCategories(current, age, gender);

    } catch (err) {
      console.error('[VO2Max] load error:', err);
      root.innerHTML = `<div style="padding:80px; text-align:center;"><h3>Error Loading VO2Max</h3><p>${err.message}</p></div>`;
    }
  },

  showEmptyState(root) {
    root.innerHTML = `
      <div style="padding:80px; text-align:center; color:var(--text-muted);">
        <svg style="width:80px; height:80px; opacity:0.3; margin:0 auto 24px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
        </svg>
        <h3 style="font-size:20px; font-weight:600; color:var(--text); margin-bottom:12px;">No VO2Max Data Available</h3>
        <p>Upload activities with heart rate data to see your VO2Max estimation and progression.</p>
      </div>
    `;
  },

  template() {
    return `
      <style>
        .vo2-section { display:grid; gap:20px; }
        .vo2-header { margin-bottom:8px; }
        .vo2-header h1 { 
          font-size:32px; font-weight:700; color:var(--text); 
          margin:0 0 6px 0; letter-spacing:-0.02em;
        }
        .vo2-header p { 
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
          border-color:#10b981;
          box-shadow:0 12px 28px rgba(16,185,129,0.2), 0 0 0 1px #10b981;
        }
        
        .metric-card:nth-child(3):hover {
          border-color:#8b5cf6;
          box-shadow:0 12px 28px rgba(139,92,246,0.2), 0 0 0 1px #8b5cf6;
        }
        
        .metric-card:hover::before {
          transform:translate(30%, -30%) scale(1.3);
          opacity:0.6;
        }
        
        .metric-header-row {
          display:flex; align-items:center; gap:10px; margin-bottom:14px;
        }
        .metric-icon {
          width:36px; height:36px; border-radius:8px;
          display:flex; align-items:center; justify-content:center;
          flex-shrink:0; transition:all 0.3s ease;
        }
        .metric-card:hover .metric-icon {
          transform:scale(1.1) rotate(5deg);
        }
        .metric-icon svg { width:20px; height:20px; }
        .metric-icon.primary { background:rgba(59,130,246,0.15); color:#3b82f6; }
        .metric-icon.green { background:rgba(16,185,129,0.15); color:#10b981; }
        .metric-icon.purple { background:rgba(139,92,246,0.15); color:#8b5cf6; }
        
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
          flex-shrink:0; transition:all 0.3s ease;
        }
        .chart-card:hover .chart-icon {
          transform:scale(1.05);
        }
        .chart-icon svg { width:22px; height:22px; color:#3b82f6; }
        .chart-title { 
          font-size:20px; font-weight:700; color:var(--text); letter-spacing:-0.02em;
        }
        .chart-subtitle { 
          font-size:13px; color:var(--text-muted); line-height:1.4; 
        }
        
        .chart-container { 
          position:relative; height:400px; margin-top:8px; 
        }
        
        .info-grid { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
        @media (max-width: 1024px) { .info-grid { grid-template-columns:1fr; } }
        
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
          padding-bottom:14px; border-bottom:2px solid #e5e7eb;
        }
        .info-card-icon {
          width:40px; height:40px; border-radius:10px;
          background:rgba(59,130,246,0.15);
          display:flex; align-items:center; justify-content:center;
          color:#3b82f6; flex-shrink:0;
        }
        .info-card-icon svg { width:22px; height:22px; }
        .info-card-title { 
          font-size:17px; font-weight:700; color:var(--text); letter-spacing:-0.02em;
        }
        
        .category-grid { display:grid; gap:10px; }
        .category-item {
          display:flex; align-items:center; justify-content:space-between;
          padding:12px 14px; border-radius:8px; background:#f9fafb;
          border:1px solid #e5e7eb; transition:all 0.15s;
        }
        .category-item:hover { 
          background:#ffffff; border-color:#d1d5db; 
        }
        .category-item.active {
          background:linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(16,185,129,0.1) 100%);
          border-color:#3b82f6;
        }
        .category-label { 
          font-size:14px; font-weight:600; color:var(--text); 
        }
        .category-range { 
          font-size:13px; color:var(--text-muted); font-weight:600;
        }
        
        .factor-list { display:grid; gap:10px; }
        .factor-item {
          display:flex; align-items:start; gap:10px;
          padding:10px; border-radius:6px; background:#f9fafb;
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
        
        .vo2-insight {
          background:linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(139,92,246,0.1) 100%);
          border:1.5px solid #3b82f6; border-radius:12px; padding:18px;
          display:flex; gap:14px; margin-top:16px;
        }
        .vo2-insight svg {
          width:24px; height:24px; color:#3b82f6; flex-shrink:0; margin-top:2px;
        }
        .vo2-insight-content { flex:1; }
        .vo2-insight-title {
          font-weight:700; font-size:15px; color:var(--text); margin-bottom:6px;
        }
        .vo2-insight-text {
          font-size:13px; color:var(--text-muted); line-height:1.6;
        }
      </style>

      <div class="vo2-section">
        <div class="vo2-header">
          <h1>VO2Max Estimation</h1>
          <p>Your aerobic fitness and cardiovascular capacity indicator</p>
        </div>

        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-header-row">
              <div class="metric-icon primary">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
                </svg>
              </div>
              <div class="metric-label">Current VO2Max</div>
            </div>
            <div class="metric-value" id="vo2-current">–</div>
            <div class="metric-subtitle">ml/kg/min</div>
          </div>
          
          <div class="metric-card">
            <div class="metric-header-row">
              <div class="metric-icon green">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <div class="metric-label">Fitness Level</div>
            </div>
            <div class="metric-value" id="vo2-category" style="font-size:28px;">–</div>
            <div class="metric-subtitle">Classification</div>
          </div>
          
          <div class="metric-card">
            <div class="metric-header-row">
              <div class="metric-icon purple">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"/>
                </svg>
              </div>
              <div class="metric-label">90-Day Trend</div>
            </div>
            <div class="metric-value" id="vo2-trend">–</div>
            <div class="metric-subtitle">Change</div>
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
                  <div class="chart-title">VO2Max Progression</div>
                  <div class="chart-subtitle">Historical trend over the last 180 days</div>
                </div>
              </div>
            </div>
          </div>
          <div class="chart-container">
            <canvas id="vo2-chart" aria-label="VO2Max progression chart"></canvas>
          </div>
        </div>

        <div class="info-grid">
          <div class="info-card">
            <div class="info-card-header">
              <div class="info-card-icon">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                </svg>
              </div>
              <div>
                <div class="info-card-title">Fitness Categories</div>
              </div>
            </div>
            <div class="category-grid" id="vo2-categories"></div>
            
            <div class="vo2-insight">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <div class="vo2-insight-content">
                <div class="vo2-insight-title">What is VO2Max?</div>
                <div class="vo2-insight-text">
                  VO2Max measures your body's maximum oxygen consumption during intense exercise. Higher values indicate better cardiovascular fitness and endurance capacity.
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
                <div class="info-card-title">Improvement Factors</div>
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
                  <div class="factor-title">High-Intensity Training</div>
                  <div class="factor-text">VO2Max intervals at 90-100% max effort improve aerobic capacity</div>
                </div>
              </div>
              <div class="factor-item">
                <div class="factor-icon">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </div>
                <div class="factor-content">
                  <div class="factor-title">Consistent Training</div>
                  <div class="factor-text">Regular endurance work builds aerobic base and increases capacity</div>
                </div>
              </div>
              <div class="factor-item">
                <div class="factor-icon">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                </svg>
                </div>
                <div class="factor-content">
                  <div class="factor-title">Recovery & Adaptation</div>
                  <div class="factor-text">Adequate rest allows physiological adaptations to occur</div>
                </div>
              </div>
              <div class="factor-item">
                <div class="factor-icon">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"/>
                  </svg>
                </div>
                <div class="factor-content">
                  <div class="factor-title">Body Composition</div>
                  <div class="factor-text">Lower body fat percentage generally correlates with higher VO2Max</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  _extractCurrent(data) {
    if (Array.isArray(data) && data.length > 0) {
      return Number(data[data.length - 1].vo2max ?? 0);
    }
    return null;
  },

  _extractHistory(data) {
    if (Array.isArray(data) && data.length > 0) {
      return data.map(item => ({
        date: new Date(item.timestamp),
        value: Number(item.vo2max ?? 0)
      }));
    }
    return [];
  },

  _calculateTrend(history) {
    if (history.length < 2) return 0;
    
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    const recent = history.filter(h => h.date >= ninetyDaysAgo);
    if (recent.length < 2) return 0;
    
    const oldest = recent[0].value;
    const newest = recent[recent.length - 1].value;
    return newest - oldest;
  },

  _getCategory(vo2max, age, gender) {
    if (vo2max >= 56) return 'Excellent';
    if (vo2max >= 51) return 'Good';
    if (vo2max >= 46) return 'Above Average';
    if (vo2max >= 41) return 'Average';
    if (vo2max >= 36) return 'Below Average';
    return 'Poor';
  },

  _updateMetrics(current, category, trend) {
    const currentEl = document.getElementById('vo2-current');
    const categoryEl = document.getElementById('vo2-category');
    const trendEl = document.getElementById('vo2-trend');

    if (currentEl) currentEl.textContent = current !== null ? current.toFixed(1) : '–';
    if (categoryEl) categoryEl.textContent = category;
    if (trendEl) {
      if (trend !== 0) {
        const sign = trend >= 0 ? '+' : '';
        trendEl.textContent = `${sign}${trend.toFixed(1)}`;
        trendEl.style.color = trend >= 0 ? '#10b981' : '#ef4444';
      } else {
        trendEl.textContent = '–';
      }
    }
  },

  _renderChart(history) {
    try {
      if (this._chart) {
        this._chart.destroy();
        this._chart = null;
      }
      
      const ctx = document.getElementById('vo2-chart');
      if (!ctx || typeof Chart === 'undefined') return;

      if (history.length === 0) {
        ctx.parentElement.innerHTML = '<div style="text-align:center; padding:60px; color:var(--text-muted);">No historical data available</div>';
        return;
      }

      const labels = history.map(h => formatDate(h.date));
      const values = history.map(h => h.value);

      this._chart = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'VO2Max',
            data: values,
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
              borderColor: '#3b82f6',
              borderWidth: 1,
              callbacks: {
                label: (ctx) => ` ${ctx.parsed.y.toFixed(1)} ml/kg/min`
              }
            }
          },
          scales: {
            x: {
              grid: { display: true, color: 'rgba(0,0,0,0.04)' },
              ticks: { font: { size: 11, weight: '500' } }
            },
            y: {
              grid: { color: 'rgba(0,0,0,0.04)', drawBorder: false },
              ticks: { font: { size: 11, weight: '500' } }
            }
          }
        }
      });
    } catch (err) {
      console.error('[VO2Max] chart error:', err);
    }
  },

  _renderCategories(current, age, gender) {
    const container = document.getElementById('vo2-categories');
    if (!container) return;

    const categories = [
      { label: 'Poor', min: 0, max: 35 },
      { label: 'Below Average', min: 36, max: 40 },
      { label: 'Average', min: 41, max: 45 },
      { label: 'Above Average', min: 46, max: 50 },
      { label: 'Good', min: 51, max: 55 },
      { label: 'Excellent', min: 56, max: 100 }
    ];

    const items = categories.map(cat => {
      const isActive = current !== null && current >= cat.min && current <= cat.max;
      const range = cat.max === 100 ? `${cat.min}+` : `${cat.min}-${cat.max}`;
      
      return `
        <div class="category-item ${isActive ? 'active' : ''}">
          <span class="category-label">${cat.label}</span>
          <span class="category-range">${range}</span>
        </div>
      `;
    }).join('');

    container.innerHTML = items;
  },

  async refresh() {
    await this.load();
  }
};

export default vo2maxPage;