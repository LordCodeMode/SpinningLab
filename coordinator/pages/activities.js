// /static/js/coordinator/pages/activities.js
import { API } from '../../core/api.js';
import { formatDuration, formatDate, formatPower } from '../../core/utils.js';

export const activitiesPage = {
  state: {
    range: '7',
    start: null,
    end: null,
    activities: []
  },

  async load() {
    try {
      this.renderLayout();
      this.applyDefaultRange();
      await this.loadData();
      this.setupEventListeners();
    } catch (error) {
      console.error('Error loading activities page:', error);
      document.getElementById('page-content').innerHTML = `
        <div class="no-data">
          <h3>Error</h3>
          <p>Failed to load activities: ${this.escape(error.message || 'Unknown error')}</p>
        </div>
      `;
    }
  },

  renderLayout() {
    const html = `
      <style>
        .act-section { display:grid; gap:20px; }
        .act-header { margin-bottom:8px; }
        .act-header h1 { 
          font-size:32px; font-weight:700; color:var(--text); 
          margin:0 0 6px 0;
        }
        .act-header p { 
          color:var(--text-muted); font-size:14px; line-height:1.5; 
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
        .field {
          display:grid; gap:6px; min-width:180px;
        }
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
          .toolbar-actions { margin-left:0; flex-wrap:wrap; }
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
        
        .table-container {
          background:#ffffff;
          border:2px solid #d1d5db;
          border-radius:var(--radius);
          box-shadow:var(--shadow);
          overflow:hidden;
          transition:all 0.3s ease;
        }
        .table-container:hover {
          border-color:#3b82f6;
          box-shadow:0 8px 24px rgba(59,130,246,0.15), 0 0 0 1px #3b82f6;
        }
        .data-table { width:100%; border-collapse:collapse; }
        .data-table thead tr { background:var(--bg); }
        .data-table th {
          text-align:left; padding:12px 14px; font-weight:600; 
          color:var(--text-muted); font-size:12px; 
          text-transform:uppercase; letter-spacing:0.5px;
          border-bottom:2px solid var(--border);
        }
        .data-table td {
          padding:12px 14px; border-bottom:1px solid var(--border-light); 
          color:var(--text); font-size:14px;
        }
        .data-table tbody tr { transition:all 0.2s; }
        .data-table tbody tr:hover {
          background:var(--bg);
          box-shadow:inset 3px 0 0 #3b82f6;
        }
        .data-table tbody tr:last-child td { border-bottom:none; }
        
        .activity-name { font-weight:600; color:var(--text); }
        .power-value { font-weight:600; color:#3b82f6; }
        
        .no-data { 
          text-align:center; padding:40px; color:var(--text-muted); 
        }
        .no-data svg {
          width:48px; height:48px; opacity:0.3; margin:0 auto 12px;
        }
        
        @media (max-width: 1024px) {
          .metrics-grid { grid-template-columns:repeat(2, 1fr); }
        }
        @media (max-width: 640px) {
          .metrics-grid { grid-template-columns:1fr; }
        }
      </style>
  
      <div class="act-section">
        <div class="act-header">
          <h1>Activities</h1>
          <p>Track and analyze your training sessions</p>
        </div>
  
        <div class="toolbar" id="activities-controls">
          <div class="segmented" id="quick-range" aria-label="Quick ranges">
            <button class="seg-btn active" data-range="7">Last 7d</button>
            <button class="seg-btn" data-range="30">Last 30d</button>
            <button class="seg-btn" data-range="90">Last 90d</button>
            <button class="seg-btn" data-range="365">YTD</button>
            <button class="seg-btn" data-range="all">All</button>
          </div>
  
          <div class="field">
            <label for="activities-start-date">From</label>
            <input type="date" id="activities-start-date" autocomplete="off" />
          </div>
          <div class="field">
            <label for="activities-end-date">To</label>
            <input type="date" id="activities-end-date" autocomplete="off" />
          </div>
  
          <div class="toolbar-actions">
            <button id="filter-activities" class="btn-primary">Apply</button>
            <button id="clear-activities-filter" class="btn-outline">Clear</button>
            <button id="export-activities" class="btn-outline">Export CSV</button>
          </div>
        </div>
  
        <div class="metrics-grid" id="activities-summary">
          <div class="metric-card">
            <div class="metric-header-row">
              <div class="metric-icon primary">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                </svg>
              </div>
              <div class="metric-label">Count</div>
            </div>
            <div class="metric-value" id="sum-count">–</div>
            <div class="metric-subtitle">Activities</div>
          </div>
          
          <div class="metric-card">
            <div class="metric-header-row">
              <div class="metric-icon purple">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <div class="metric-label">Volume</div>
            </div>
            <div class="metric-value" id="sum-duration">–</div>
            <div class="metric-subtitle">Total time</div>
          </div>
          
          <div class="metric-card">
            <div class="metric-header-row">
              <div class="metric-icon amber">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
              </div>
              <div class="metric-label">Distance</div>
            </div>
            <div class="metric-value" id="sum-distance">–</div>
            <div class="metric-subtitle">Kilometers</div>
          </div>
          
          <div class="metric-card">
            <div class="metric-header-row">
              <div class="metric-icon green">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                </svg>
              </div>
              <div class="metric-label">Load</div>
            </div>
            <div class="metric-value" id="sum-tss">–</div>
            <div class="metric-subtitle">Total TSS</div>
          </div>
        </div>
  
        <div class="table-container">
          <table class="data-table" id="activities-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Title</th>
                <th>Duration</th>
                <th>Distance</th>
                <th>Avg Power</th>
                <th>NP</th>
                <th>TSS</th>
                <th>IF</th>
                <th>Avg HR</th>
              </tr>
            </thead>
            <tbody id="activities-tbody">
              <tr><td colspan="9" class="no-data">Loading activities…</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
    document.getElementById('page-content').innerHTML = html;
  },

  async loadData() {
    const tbody = document.getElementById('activities-tbody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="9" class="no-data">Loading…</td></tr>`;

    try {
      const params = {};
      if (this.state.start) params.start = this.state.start.toISOString();
      if (this.state.end)   params.end   = this.state.end.toISOString();

      const list = await API.getActivities(params).catch(() => []);
      const activities = this.filterClientSide(list);

      this.state.activities = activities;
      this.renderTable(activities);
      this.renderSummary(activities);
    } catch (error) {
      console.error('Error loading activities data:', error);
      tbody.innerHTML = `<tr><td colspan="9" class="no-data">Error loading activities</td></tr>`;
    }
  },

  filterClientSide(list) {
    const { start, end } = this.state;
    if (!start && !end) return list || [];

    return (list || []).filter(a => {
      const t = new Date(a.start_time);
      if (start && t < start) return false;
      if (end) {
        const endDay = new Date(end);
        endDay.setHours(23, 59, 59, 999);
        if (t > endDay) return false;
      }
      return true;
    });
  },

  renderTable(activities) {
    const tbody = document.getElementById('activities-tbody');
    if (!tbody) return;

    if (!activities || activities.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="no-data">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
            </svg>
            <div style="font-weight:600; margin-top:8px;">No activities found</div>
            <div style="font-size:13px; margin-top:4px;">Try adjusting your date range</div>
          </td>
        </tr>
      `;
      return;
    }

    const rows = activities.map(a => {
      const distKm = this.distanceKm(a.distance);
      return `
        <tr>
          <td>${formatDate(a.start_time)}</td>
          <td><span class="activity-name">${a.name ? this.escape(a.name) : 'Activity'}</span></td>
          <td>${formatDuration(a.duration)}</td>
          <td>${distKm != null ? `${distKm.toFixed(1)} km` : '-'}</td>
          <td><span class="power-value">${formatPower(a.avg_power)}</span></td>
          <td>${formatPower(a.normalized_power)}</td>
          <td>${a.tss != null ? Math.round(a.tss) : '-'}</td>
          <td>${a.intensity_factor != null ? a.intensity_factor.toFixed(2) : '-'}</td>
          <td>${a.avg_heart_rate != null ? `${Math.round(a.avg_heart_rate)} bpm` : '-'}</td>
        </tr>
      `;
    }).join('');

    tbody.innerHTML = rows;
  },

  renderSummary(activities) {
    const sumCountEl = document.getElementById('sum-count');
    const sumDurEl   = document.getElementById('sum-duration');
    const sumDistEl  = document.getElementById('sum-distance');
    const sumTssEl   = document.getElementById('sum-tss');

    const s = (activities || []).reduce((acc, a) => {
      acc.count += 1;
      acc.duration += (a.duration || 0);
      acc.distance += (this.distanceKm(a.distance) || 0);
      acc.tss += (a.tss || 0);
      return acc;
    }, { count: 0, duration: 0, distance: 0, tss: 0 });

    if (sumCountEl) sumCountEl.textContent = String(s.count);
    if (sumDurEl)   sumDurEl.textContent   = formatDuration(s.duration);
    if (sumDistEl)  sumDistEl.textContent  = s.distance.toFixed(1);
    if (sumTssEl)   sumTssEl.textContent   = String(Math.round(s.tss));
  },

  setupEventListeners() {
    const rangeRoot = document.getElementById('quick-range');
    if (rangeRoot) {
      rangeRoot.querySelectorAll('button[data-range]').forEach(btn => {
        btn.addEventListener('click', async () => {
          rangeRoot.querySelectorAll('button').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.state.range = btn.dataset.range || '7';
          this.applyRangeFromState();
          await this.loadData();
        });
      });
    }

    document.getElementById('filter-activities')?.addEventListener('click', async () => {
      this.state.range = 'custom';
      this.readDatesFromInputs();
      await this.loadData();
    });

    document.getElementById('clear-activities-filter')?.addEventListener('click', async () => {
      this.clearFilter();
      await this.loadData();
    });

    document.getElementById('export-activities')?.addEventListener('click', () => {
      this.exportCSV(this.state.activities || []);
    });
  },

  applyDefaultRange() {
    this.setRangeDays(7);
    this.syncInputsFromState();
    this.markActiveRange('7');
  },

  applyRangeFromState() {
    const r = this.state.range;
    if (r === 'all') {
      this.state.start = null;
      this.state.end = null;
    } else if (r === '365') {
      const now = new Date();
      this.state.start = new Date(now.getFullYear(), 0, 1);
      this.state.end   = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (!isNaN(parseInt(r, 10))) {
      this.setRangeDays(parseInt(r, 10));
    }
    this.syncInputsFromState();
    this.markActiveRange(r);
  },

  setRangeDays(days) {
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setDate(start.getDate() - (days - 1));
    this.state.start = start;
    this.state.end   = end;
  },

  readDatesFromInputs() {
    const s = (document.getElementById('activities-start-date')?.value || '').trim();
    const e = (document.getElementById('activities-end-date')?.value || '').trim();
    this.state.start = s ? new Date(s + 'T00:00:00') : null;
    this.state.end   = e ? new Date(e + 'T00:00:00') : null;
  },

  syncInputsFromState() {
    const sInput = document.getElementById('activities-start-date');
    const eInput = document.getElementById('activities-end-date');
    const toISODate = d => d ? new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,10) : '';
    if (sInput) sInput.value = this.state.start ? toISODate(this.state.start) : '';
    if (eInput) eInput.value = this.state.end   ? toISODate(this.state.end)   : '';
  },

  clearFilter() {
    this.state.range = '7';
    this.applyDefaultRange();
  },

  markActiveRange(val) {
    const rangeRoot = document.getElementById('quick-range');
    if (!rangeRoot) return;
    rangeRoot.querySelectorAll('button').forEach(b => {
      b.classList.toggle('active', b.dataset.range === val);
    });
  },

  distanceKm(distance) {
    if (distance == null) return null;
    if (distance > 1000) return distance / 1000;
    return distance; 
  },

  escape(str) {
    return String(str).replace(/[&<>"']/g, s => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[s]));
  },

  exportCSV(list) {
    const rows = [
      ['date','title','duration_sec','distance_km','avg_power','np','tss','if','avg_hr']
    ];
    (list || []).forEach(a => {
      rows.push([
        new Date(a.start_time).toISOString(),
        (a.name || '').replace(/\s+/g, ' ').trim(),
        Math.round(a.duration || 0),
        (this.distanceKm(a.distance) ?? '').toString(),
        a.avg_power ?? '',
        a.normalized_power ?? '',
        a.tss ?? '',
        a.intensity_factor ?? '',
        a.avg_heart_rate ?? ''
      ]);
    });

    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `activities_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  async refresh() {
    await this.loadData();
  }
};

export default activitiesPage;