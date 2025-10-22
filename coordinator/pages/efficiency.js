// /static/js/coordinator/pages/efficiency.js
import { API } from '../../core/api.js';

export const efficiencyPage = {
  _chart: null,

  async load() {
    document.getElementById('page-content').innerHTML = `
      <style>
        .eff-section { display:grid; gap:20px; }
        .eff-header { 
          display:flex; justify-content:space-between; align-items:center; 
          flex-wrap:wrap; gap:16px; margin-bottom:8px;
        }
        .eff-controls { 
          display:flex; gap:12px; align-items:center; flex-wrap:wrap;
          padding:10px 16px; background:#ffffff; border:2px solid #d1d5db;
          border-radius:8px; transition:all 0.2s;
        }
        .eff-controls:hover {
          border-color:#3b82f6;
        }
        .eff-controls label { 
          display:flex; align-items:center; gap:8px; font-size:13px; 
          color:var(--text); cursor:pointer; user-select:none; font-weight:600;
        }
        .eff-controls select {
          padding:8px 12px; border:1.5px solid #d1d5db; border-radius:8px;
          background:#ffffff; color:var(--text); font-size:14px; font-weight:500;
          transition:border-color 0.15s;
        }
        .eff-controls select:focus {
          outline:none; border-color:#3b82f6; box-shadow:0 0 0 3px rgba(59,130,246,0.1);
        }
        .eff-controls input[type="checkbox"] { 
          width:18px; height:18px; accent-color:#10b981; cursor:pointer; 
        }
        .btn-refresh {
          display:inline-flex; align-items:center; gap:6px;
          padding:8px 14px; border-radius:8px; font-size:13px; font-weight:600;
          background:transparent; border:1.5px solid #d1d5db; color:var(--text);
          cursor:pointer; transition:all 0.15s;
        }
        .btn-refresh:hover { 
          background:#f9fafb; border-color:#3b82f6; color:#3b82f6; 
          transform:translateY(-1px);
        }
        .btn-refresh svg { width:14px; height:14px; }
        
        .eff-kpis { 
          display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:16px; 
        }
        .eff-kpi {
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
        .eff-kpi::before {
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
        .eff-kpi:hover {
          transform:translateY(-6px);
          box-shadow:0 12px 28px rgba(0,0,0,0.15);
        }
        
        .eff-kpi:nth-child(1):hover {
          border-color:#3b82f6;
          box-shadow:0 12px 28px rgba(59,130,246,0.2), 0 0 0 1px #3b82f6;
        }
        
        .eff-kpi:nth-child(2):hover {
          border-color:#10b981;
          box-shadow:0 12px 28px rgba(16,185,129,0.2), 0 0 0 1px #10b981;
        }
        
        .eff-kpi:nth-child(3):hover {
          border-color:#f59e0b;
          box-shadow:0 12px 28px rgba(245,158,11,0.2), 0 0 0 1px #f59e0b;
        }
        
        .eff-kpi:hover::before {
          transform:translate(30%, -30%) scale(1.3);
          opacity:0.6;
        }
        
        .eff-kpi-header {
          display:flex; align-items:center; gap:10px; margin-bottom:14px;
        }
        .eff-kpi-icon {
          width:36px; height:36px; border-radius:8px;
          display:flex; align-items:center; justify-content:center;
          flex-shrink:0; transition:all 0.3s ease;
        }
        .eff-kpi:hover .eff-kpi-icon {
          transform:scale(1.1) rotate(5deg);
        }
        .eff-kpi-icon svg { width:20px; height:20px; }
        .eff-kpi-icon.primary { background:rgba(59,130,246,0.15); color:#3b82f6; }
        .eff-kpi-icon.success { background:rgba(16,185,129,0.15); color:#10b981; }
        .eff-kpi-icon.amber { background:rgba(245,158,11,0.15); color:#f59e0b; }
        .eff-kpi-label { 
          font-size:13px; font-weight:700; color:var(--text-muted); 
          text-transform:uppercase; letter-spacing:0.5px;
        }
        .eff-kpi-value { 
          font-size:42px; font-weight:800; color:var(--text); line-height:1; 
          margin:10px 0; position:relative; z-index:1;
        }
        .eff-kpi-sub { font-size:13px; color:var(--text-muted); font-weight:500; }
        
        .eff-grid { 
          display:grid; grid-template-columns:1.2fr 1fr; gap:20px; 
        }
        @media (max-width: 1200px) { .eff-grid { grid-template-columns:1fr; } }
        
        .eff-card {
          background:#ffffff;
          border:2px solid #d1d5db;
          border-radius:var(--radius);
          padding:24px;
          box-shadow:var(--shadow);
          transition:all 0.3s ease;
        }
        .eff-card:hover {
          border-color:#3b82f6;
          box-shadow:0 8px 24px rgba(59,130,246,0.15), 0 0 0 1px #3b82f6;
        }
        
        .eff-card-header {
          display:flex; align-items:start; gap:14px; margin-bottom:20px;
        }
        .eff-card-icon {
          width:44px; height:44px; border-radius:10px; 
          display:flex; align-items:center; justify-content:center;
          background:linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(16,185,129,0.15) 100%);
          flex-shrink:0; transition:all 0.3s ease;
        }
        .eff-card:hover .eff-card-icon {
          transform:scale(1.05);
        }
        .eff-card-icon svg { width:24px; height:24px; color:#3b82f6; }
        .eff-card-title { 
          font-size:18px; font-weight:700; color:var(--text); 
          margin-bottom:4px; letter-spacing:-0.02em;
        }
        .eff-card-subtitle { font-size:13px; color:var(--text-muted); line-height:1.4; }
        
        .chart-wrapper { height:360px; position:relative; margin-top:8px; }
        
        .sessions-table-wrapper { margin-top:8px; max-height:400px; overflow-y:auto; }
        .data-table { width:100%; border-collapse:collapse; }
        .data-table thead { position:sticky; top:0; z-index:1; }
        .data-table thead tr { background:#ffffff; }
        .data-table th { 
          text-align:left; padding:12px 14px; font-weight:600; color:var(--text-muted); 
          font-size:11px; text-transform:uppercase; letter-spacing:0.5px; 
          border-bottom:2px solid #e5e7eb;
        }
        .data-table td { 
          padding:12px 14px; border-bottom:1px solid #f3f4f6; color:var(--text);
          font-size:13px;
        }
        .data-table tbody tr { transition:background 0.15s; }
        .data-table tbody tr:hover { background:#f9fafb; }
        
        .ef-badge {
          display:inline-flex; align-items:center; justify-content:center;
          min-width:60px; padding:4px 10px; border-radius:6px;
          font-weight:700; font-size:13px;
        }
        .ef-badge.excellent { background:rgba(16,185,129,0.15); color:#10b981; }
        .ef-badge.good { background:rgba(59,130,246,0.15); color:#3b82f6; }
        .ef-badge.fair { background:rgba(245,158,11,0.15); color:#f59e0b; }
        
        .eff-insight {
          background:linear-gradient(135deg, rgba(16,185,129,0.1) 0%, rgba(59,130,246,0.1) 100%);
          border:1.5px solid #10b981; border-radius:12px; padding:18px;
          margin-top:20px; display:flex; gap:14px;
        }
        .eff-insight svg {
          width:24px; height:24px; color:#10b981; flex-shrink:0; margin-top:2px;
        }
        .eff-insight-content { flex:1; }
        .eff-insight-title {
          font-weight:700; font-size:15px; color:var(--text); margin-bottom:6px;
          display:flex; align-items:center; gap:8px;
        }
        .eff-insight-text {
          font-size:13px; color:var(--text-muted); line-height:1.6;
        }
        .eff-insight-text strong { color:var(--text); font-weight:600; }
        
        .trend-indicator {
          display:inline-flex; align-items:center; gap:6px;
          padding:6px 12px; border-radius:6px; font-weight:700; font-size:14px;
        }
        .trend-indicator.up { background:rgba(16,185,129,0.15); color:#10b981; }
        .trend-indicator.down { background:rgba(239,68,68,0.15); color:#ef4444; }
        .trend-indicator.neutral { background:rgba(148,163,184,0.15); color:#64748b; }
        .trend-indicator svg { width:16px; height:16px; }
        
        .empty-state {
          display:flex; align-items:center; justify-content:center; 
          min-height:320px; text-align:center; color:var(--text-muted);
        }
        .empty-state-content { max-width:320px; }
        .empty-state svg { 
          width:64px; height:64px; opacity:0.3; margin:0 auto 16px; 
        }
        .empty-state h3 { 
          font-size:16px; font-weight:600; margin-bottom:8px; color:var(--text); 
        }
      </style>

      <div class="eff-section">
        <div class="eff-header">
          <div>
            <h1 id="page-title">Efficiency Factor Analysis</h1>
            <p style="color:var(--text-muted);font-size:14px;margin-top:4px;">
              Track your power-to-heart-rate ratio over time
            </p>
          </div>
          <div class="eff-controls">
            <label for="efficiency-days" style="color:var(--text-muted);">Period:</label>
            <select id="efficiency-days">
              <option value="60">Last 60 days</option>
              <option value="120" selected>Last 120 days</option>
              <option value="180">Last 180 days</option>
              <option value="365">Last year</option>
            </select>
            <label>
              <input type="checkbox" id="efficiency-ga1-only" checked>
              <span>GA1 only (IF &lt; 0.75)</span>
            </label>
            <button id="efficiency-refresh" class="btn-refresh">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
              Refresh
            </button>
          </div>
        </div>

        <div class="eff-kpis">
          <div class="eff-kpi">
            <div class="eff-kpi-header">
              <div class="eff-kpi-icon primary">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
                </svg>
              </div>
              <div class="eff-kpi-label">Current EF</div>
            </div>
            <div class="eff-kpi-value" id="current-ef">-</div>
            <div class="eff-kpi-sub">Most recent measurement</div>
          </div>
          
          <div class="eff-kpi">
            <div class="eff-kpi-header">
              <div class="eff-kpi-icon success">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                </svg>
              </div>
              <div class="eff-kpi-label">Average EF</div>
            </div>
            <div class="eff-kpi-value" id="average-ef">-</div>
            <div class="eff-kpi-sub">Period average</div>
          </div>
          
          <div class="eff-kpi">
            <div class="eff-kpi-header">
              <div class="eff-kpi-icon amber">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"/>
                </svg>
              </div>
              <div class="eff-kpi-label">Trend</div>
            </div>
            <div class="eff-kpi-value" id="ef-trend">-</div>
            <div class="eff-kpi-sub">vs previous period</div>
          </div>
        </div>

        <div class="eff-grid">
          <div class="eff-card">
            <div class="eff-card-header">
              <div class="eff-card-icon">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"/>
                </svg>
              </div>
              <div>
                <div class="eff-card-title">Efficiency Factor Progression</div>
                <div class="eff-card-subtitle">
                  Normalized Power (W) ÷ Average Heart Rate (bpm)
                </div>
              </div>
            </div>
            <div class="chart-wrapper">
              <canvas id="efficiency-chart"></canvas>
            </div>
            
            <div class="eff-insight">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
              </svg>
              <div class="eff-insight-content">
                <div class="eff-insight-title">
                  <span>Understanding Efficiency Factor</span>
                </div>
                <div class="eff-insight-text">
                  <strong>Higher is better:</strong> An increasing EF indicates improved aerobic fitness—you're producing more power at the same heart rate, or the same power at lower heart rate. Track this metric in Zone 1-2 (GA1) rides for the most accurate fitness progression.
                </div>
              </div>
            </div>
          </div>

          <div class="eff-card">
            <div class="eff-card-header">
              <div class="eff-card-icon">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <div>
                <div class="eff-card-title">Recent Sessions</div>
                <div class="eff-card-subtitle">Last 10 qualifying activities</div>
              </div>
            </div>
            <div class="sessions-table-wrapper">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>EF</th>
                    <th>Power</th>
                    <th>HR</th>
                    <th>IF</th>
                  </tr>
                </thead>
                <tbody id="efficiency-tbody">
                  <tr>
                    <td colspan="5" style="text-align:center; padding:40px; color:var(--text-muted);">
                      Loading sessions...
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('efficiency-days')?.addEventListener('change', () => this.loadData());
    document.getElementById('efficiency-ga1-only')?.addEventListener('change', () => this.loadData());
    document.getElementById('efficiency-refresh')?.addEventListener('click', () => this.loadData());

    await this.loadData();
  },

  async loadData() {
    try {
      const days = parseInt(document.getElementById('efficiency-days')?.value || '120', 10);
      const ga1Only = !!document.getElementById('efficiency-ga1-only')?.checked;

      const raw = await API.getEfficiency(days, ga1Only);

      if (!raw || !raw.timeseries || raw.timeseries.length === 0) {
        this.showEmptyState();
        return;
      }

      const series = raw.timeseries || [];
      const sessions = raw.sessions || raw.timeseries || [];

      const currentEF = raw.current_ef ?? (series.length > 0 ? series[series.length - 1].ef : null);
      const avgEF = raw.avg_ef ?? (series.length > 0 ? this._avg(series.map(s => s.ef)) : null);
      const trendData = this._calculateTrend(series);

      this._updateKPIs(currentEF, avgEF, trendData);
      this._renderChart(series);
      this._renderTable(sessions);

    } catch (err) {
      console.error('[Efficiency] loadData error:', err);
      this._safeHTML('efficiency-tbody', `
        <tr>
          <td colspan="5" style="text-align:center; padding:40px; color:var(--error);">
            <svg style="width:24px;height:24px;margin:0 auto 8px;opacity:0.5;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <div>Error loading data: ${err.message}</div>
          </td>
        </tr>
      `);
    }
  },

  _updateKPIs(currentEF, avgEF, trendData) {
    const currentEl = document.getElementById('current-ef');
    if (currentEl) {
      currentEl.textContent = currentEF != null ? currentEF.toFixed(3) : '-';
    }

    const avgEl = document.getElementById('average-ef');
    if (avgEl) {
      avgEl.textContent = avgEF != null ? avgEF.toFixed(3) : '-';
    }

    const trendEl = document.getElementById('ef-trend');
    if (trendEl && trendData) {
      const icon = trendData.direction === 'up' 
        ? '↗' 
        : trendData.direction === 'down' 
        ? '↘' 
        : '→';
      trendEl.innerHTML = `
        <div class="trend-indicator ${trendData.direction}">
          ${icon} ${Math.abs(trendData.pct).toFixed(1)}%
        </div>
      `;
    } else if (trendEl) {
      trendEl.textContent = '-';
    }
  },

  _calculateTrend(series) {
    if (!series?.length || series.length < 2) return null;
    
    const n = Math.min(series.length, 14);
    const last = series.slice(-n).map(p => p.ef).filter(Number.isFinite);
    if (last.length < 2) return null;
    
    const delta = last[last.length - 1] - last[0];
    const pct = (delta / last[0]) * 100;
    
    return {
      pct,
      direction: pct > 0.5 ? 'up' : pct < -0.5 ? 'down' : 'neutral'
    };
  },

  showEmptyState() {
    this._safeText('current-ef', '-');
    this._safeText('average-ef', '-');
    document.getElementById('ef-trend').innerHTML = '-';

    const chartContainer = document.getElementById('efficiency-chart')?.parentElement;
    if (chartContainer) {
      chartContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-content">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
            </svg>
            <h3>No Efficiency Data</h3>
            <p>Upload activities with power and heart rate to track your aerobic fitness progression</p>
          </div>
        </div>
      `;
    }

    this._safeHTML('efficiency-tbody', `
      <tr>
        <td colspan="5" style="text-align:center; padding:40px; color:var(--text-muted);">
          No sessions match the criteria for the selected period
        </td>
      </tr>
    `);
  },

  _renderChart(series) {
    try {
      if (this._chart) {
        this._chart.destroy();
        this._chart = null;
      }
      
      const ctx = document.getElementById('efficiency-chart');
      if (!ctx || typeof Chart === 'undefined') {
        console.warn('[Efficiency] Chart.js not available');
        return;
      }

      if (series.length === 0) {
        ctx.parentElement.innerHTML = '<div class="empty-state"><div class="empty-state-content"><p>No data to display</p></div></div>';
        return;
      }

      const labels = series.map(p => this._fmtDate(p.date));
      const dataEF = series.map(p => Number(p.ef ?? 0));

      this._chart = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Efficiency Factor',
            data: dataEF,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16,185,129,0.15)',
            fill: true,
            tension: 0.4,
            borderWidth: 3,
            pointRadius: 4,
            pointHoverRadius: 7,
            pointBackgroundColor: '#10b981',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointHoverBackgroundColor: '#10b981',
            pointHoverBorderColor: '#fff',
            pointHoverBorderWidth: 3
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
              borderColor: '#10b981',
              borderWidth: 1,
              callbacks: {
                title: (items) => this._fmtDate(series[items[0].dataIndex].date),
                label: (ctx) => {
                  const ef = Number(ctx.parsed.y);
                  const rating = this._getRating(ef);
                  return `EF: ${ef.toFixed(3)} (${rating})`;
                }
              }
            }
          },
          scales: {
            x: { 
              grid: { display: false },
              ticks: { 
                font: { size: 11, weight: '500' }, 
                maxRotation: 45,
                color: 'var(--text-muted)'
              }
            },
            y: {
              grid: { 
                color: 'rgba(0,0,0,0.05)',
                drawBorder: false
              },
              ticks: { 
                font: { size: 11, weight: '500' },
                color: 'var(--text-muted)',
                callback: v => v.toFixed?.(2) ?? v 
              }
            }
          }
        }
      });
    } catch (err) {
      console.error('[Efficiency] chart error:', err);
      const ctx = document.getElementById('efficiency-chart');
      if (ctx?.parentElement) {
        ctx.parentElement.innerHTML = `<div class="empty-state"><div class="empty-state-content"><p>Chart error: ${err.message}</p></div></div>`;
      }
    }
  },

  _renderTable(rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
      this._safeHTML('efficiency-tbody', `
        <tr>
          <td colspan="5" style="text-align:center; padding:40px; color:var(--text-muted);">
            No sessions match the criteria
          </td>
        </tr>
      `);
      return;
    }

    const html = rows.slice(-10).reverse().map(s => {
      const ef = s.ef != null ? s.ef.toFixed(3) : '-';
      const rating = s.ef != null ? this._getRating(s.ef) : '';
      const badgeClass = s.ef != null 
        ? (s.ef >= 1.3 ? 'excellent' : s.ef >= 1.0 ? 'good' : 'fair')
        : '';
      
      return `
        <tr>
          <td style="font-weight:500;">${this._fmtDate(s.date)}</td>
          <td>
            <span class="ef-badge ${badgeClass}" title="${rating}">
              ${ef}
            </span>
          </td>
          <td style="font-weight:600; color:#3b82f6;">
            ${s.np != null ? Math.round(s.np) + ' W' : '-'}
          </td>
          <td>${s.hr != null ? Math.round(s.hr) + ' bpm' : '-'}</td>
          <td>${s.if != null ? s.if.toFixed(2) : '-'}</td>
        </tr>
      `;
    }).join('');
    
    this._safeHTML('efficiency-tbody', html);
  },

  _getRating(ef) {
    if (ef >= 1.5) return 'Elite';
    if (ef >= 1.3) return 'Excellent';
    if (ef >= 1.1) return 'Good';
    if (ef >= 0.9) return 'Fair';
    return 'Developing';
  },

  _avg(arr) {
    const v = arr.filter(x => Number.isFinite(x));
    if (!v.length) return null;
    return v.reduce((a, b) => a + b, 0) / v.length;
  },

  _fmtDate(d) {
    const dt = new Date(d);
    if (isNaN(dt)) return String(d ?? '');
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  _safeText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  },

  _safeHTML(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  },

  async refresh() {
    await this.loadData();
  }
};

export default efficiencyPage;