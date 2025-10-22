// /static/js/coordinator/pages/overview.js
import { API, AnalysisAPI } from '../../core/api.js';
import { formatDuration, formatDate } from '../../core/utils.js';

const injectOnce = (id, css) => {
  if (!document.getElementById(id)) {
    const s = document.createElement('style');
    s.id = id; s.textContent = css;
    document.head.appendChild(s);
  }
};

export const overviewPage = {
  chartInstances: {},
  userName: null,

  async load() {
    await this.fetchUserName();
    
    injectOnce('ov-styles', `
      .ov-section { display:grid; gap:20px; }
      .ov-header { margin-bottom:8px; }
      .ov-header h1 { 
        font-size:32px; font-weight:700; color:var(--text); 
        margin:0 0 6px 0;
      }
      .ov-header p { 
        color:var(--text-muted); font-size:14px; line-height:1.5; 
      }
      
      .metrics-grid { 
        display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:16px; 
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
      
      .metric-card:nth-child(5):hover {
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
      .metric-icon.primary { background:rgba(59,130,246,0.15); color:#3b82f6; }
      .metric-icon.purple { background:rgba(139,92,246,0.15); color:#8b5cf6; }
      .metric-icon.green { background:rgba(16,185,129,0.15); color:#10b981; }
      .metric-icon.amber { background:rgba(245,158,11,0.15); color:#f59e0b; }
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
        transform:translateY(-4px);
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
      
      .chart-container { position:relative; height:400px; margin-top:8px; }
      
      .activities-card {
        background:#ffffff;
        border:2px solid #d1d5db;
        border-radius:var(--radius);
        box-shadow:var(--shadow);
        transition:all 0.3s ease;
      }
      .activities-card:hover {
        border-color:#3b82f6;
        box-shadow:0 8px 24px rgba(59,130,246,0.15), 0 0 0 1px #3b82f6;
      }
      .activities-card-header {
        display:flex; align-items:center; gap:12px; padding:20px 24px;
        border-bottom:2px solid var(--border);
      }
      .activities-card-icon {
        width:40px; height:40px; border-radius:10px;
        background:rgba(59,130,246,0.15);
        display:flex; align-items:center; justify-content:center;
        color:#3b82f6; flex-shrink:0;
      }
      .activities-card-icon svg { width:22px; height:22px; }
      .activities-card-title { 
        font-size:17px; font-weight:700; color:var(--text); 
      }
      
      .activities-table { width:100%; border-collapse:collapse; }
      .activities-table thead tr { background:var(--bg); }
      .activities-table th {
        text-align:left; padding:12px 24px; font-weight:600; 
        color:var(--text-muted); font-size:12px; 
        text-transform:uppercase; letter-spacing:0.5px;
        border-bottom:2px solid var(--border);
      }
      .activities-table td {
        padding:14px 24px; border-bottom:1px solid var(--border-light); 
        color:var(--text); font-size:14px;
      }
      .activities-table tbody tr { transition:all 0.2s; }
      .activities-table tbody tr:hover {
        background:var(--bg);
        box-shadow:inset 3px 0 0 #3b82f6;
      }
      .activities-table tbody tr:last-child td { border-bottom:none; }
      
      .activity-name { font-weight:600; color:var(--text); }
      .power-value { 
        font-weight:600; color:#3b82f6; 
      }
      .no-data { 
        text-align:center; padding:40px; color:var(--text-muted); 
      }
      
      @media (max-width: 1024px) {
        .metrics-grid { grid-template-columns:repeat(2, 1fr); }
      }
      @media (max-width: 640px) {
        .metrics-grid { grid-template-columns:1fr; }
        .chart-container { height:300px; }
      }
    `);

    document.getElementById('page-content').innerHTML = this.template();

    try {
      const data = await this.fetchData();
      this.populateKPIs(data);
      this.renderActivities(data.activities);
      setTimeout(() => this.initChart(data), 40);
      this.setupRangeControls(data);
    } catch (err) {
      console.error('[Overview] load failed:', err);
      document.getElementById('page-content').innerHTML = `
        <div class="no-data">
          <h3>Error</h3>
          <p>${err.message}</p>
        </div>`;
    }
  },

  async fetchUserName() {
    try {
      const settings = await API.getSettings().catch(() => null);
      this.userName = settings?.name || settings?.username || null;
    } catch {
      this.userName = null;
    }
  },

  template() {
    const greeting = this.userName 
      ? `Welcome back, ${this.escapeHtml(this.userName)}` 
      : 'Welcome back, Athlete';
    
    return `
      <div class="ov-section">
        <div class="ov-header">
          <h1>${greeting}</h1>
          <p>Track your training progress and performance metrics</p>
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
            <div class="metric-value" id="kpi-ctl">–</div>
            <div class="metric-subtitle">Chronic Training Load</div>
          </div>
          
          <div class="metric-card">
            <div class="metric-header-row">
              <div class="metric-icon purple">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                </svg>
              </div>
              <div class="metric-label">Fatigue (ATL)</div>
            </div>
            <div class="metric-value" id="kpi-atl">–</div>
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
            <div class="metric-value" id="kpi-tsb">–</div>
            <div class="metric-subtitle">Training Stress Balance</div>
          </div>
          
          <div class="metric-card">
            <div class="metric-header-row">
              <div class="metric-icon amber">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <div class="metric-label">Time (7d)</div>
            </div>
            <div class="metric-value" id="kpi-time">–</div>
            <div class="metric-subtitle">Training volume</div>
          </div>
          
          <div class="metric-card">
            <div class="metric-header-row">
              <div class="metric-icon red">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
              </div>
              <div class="metric-label">Distance (7d)</div>
            </div>
            <div class="metric-value" id="kpi-dist">–</div>
            <div class="metric-subtitle">Kilometers</div>
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
                  <div class="chart-title">Training Load Progression</div>
                  <div class="chart-subtitle">Track your fitness, fatigue, and form over time</div>
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
            <canvas id="load-chart" aria-label="Training Load Chart"></canvas>
          </div>
        </div>

        <div class="activities-card">
          <div class="activities-card-header">
            <div class="activities-card-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
              </svg>
            </div>
            <div>
              <div class="activities-card-title">Recent Activities</div>
            </div>
          </div>
          <table class="activities-table">
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
              </tr>
            </thead>
            <tbody id="ov-activities-tbody">
              <tr><td colspan="8" class="no-data">Loading…</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  async fetchData() {
    const [activities, trainingLoad] = await Promise.all([
      API.getActivities({ limit: 40 }).catch(() => []),
      API.getTrainingLoad({ days: 180 }).catch(() => null)
    ]);

    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    const recent = activities.filter(a => new Date(a.start_time) > weekAgo);
    const sum = (arr, k) => arr.reduce((s,x)=> s + (Number(x?.[k]) || 0), 0);

    const totalTime = sum(recent, 'duration');
    const totalDistKm = recent.reduce((s,a)=>{
      const d = Number(a?.distance)||0;
      return s + (d>500? d/1000 : d);
    }, 0);

    return { activities, trainingLoad, sevenDays:{ totalTime, totalDistKm } };
  },

  populateKPIs(data) {
    const cur = data.trainingLoad?.current || {};
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    const ctl = cur.ctl ?? null, atl = cur.atl ?? null;
    const tsb = (cur.tsb != null) ? cur.tsb : (ctl != null && atl != null ? ctl - atl : null);

    set('kpi-ctl', ctl != null ? Math.round(ctl) : '–');
    set('kpi-atl', atl != null ? Math.round(atl) : '–');
    set('kpi-tsb', tsb != null ? Math.round(tsb) : '–');
    set('kpi-time', formatDuration(data.sevenDays.totalTime || 0));
    set('kpi-dist', `${(data.sevenDays.totalDistKm || 0).toFixed(1)} km`);
  },

  renderActivities(activities=[]) {
    const tbody = document.getElementById('ov-activities-tbody');
    if (!tbody) return;

    if (!activities.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="no-data">No activities</td></tr>';
      return;
    }

    tbody.innerHTML = activities.slice(0,10).map(a=>{
      const dist = Number(a?.distance)||0;
      const km = dist>500 ? (dist/1000).toFixed(1) : dist.toFixed(1);
      const ap = a?.avg_power != null ? `${Math.round(a.avg_power)} W` : '–';
      const np = a?.normalized_power != null ? `${Math.round(a.normalized_power)} W` : '–';
      const tss = a?.tss != null ? Math.round(a.tss) : '–';
      const iff = a?.intensity_factor != null ? Number(a.intensity_factor).toFixed(2) : '–';
      return `
        <tr>
          <td>${formatDate(a.start_time)}</td>
          <td><span class="activity-name">${this.escapeHtml(a.name || 'Activity')}</span></td>
          <td>${formatDuration(a.duration || 0)}</td>
          <td>${km} km</td>
          <td><span class="power-value">${ap}</span></td>
          <td>${np}</td>
          <td>${tss}</td>
          <td>${iff}</td>
        </tr>`;
    }).join('');
  },

  initChart(data) {
    Object.values(this.chartInstances).forEach(ch=>{ try{ ch.destroy(); }catch{} });
    this.chartInstances = {};
    if (typeof Chart === 'undefined') return;

    const ctx = document.getElementById('load-chart');
    if (!ctx) return;

    const daily = data?.trainingLoad?.daily;
    const labels = [], ctl=[], atl=[], tsb=[];

    if (Array.isArray(daily) && daily.length) {
      daily.forEach(d=>{
        labels.push(new Date(d.date).toLocaleDateString('en-US',{month:'short', day:'numeric'}));
        const c = d.ctl ?? 0, a = d.atl ?? 0;
        ctl.push(c); atl.push(a);
        tsb.push(d.tsb != null ? d.tsb : c - a);
      });
    } else {
      for (let i=89;i>=0;i--){
        const dt=new Date(); dt.setDate(dt.getDate()-i);
        labels.push(dt.toLocaleDateString('en-US',{month:'short',day:'numeric'}));
        const c=50 + Math.sin(i*.12)*8 + i*.15;
        const a=43 + Math.cos(i*.18)*10;
        ctl.push(c); atl.push(a); tsb.push(c-a);
      }
    }

    this.chartInstances.load = new Chart(ctx, {
      type:'line',
      data:{
        labels,
        datasets:[
          { 
            label:'Fitness (CTL)', 
            data:ctl, 
            borderColor:'#3b82f6', 
            backgroundColor:'rgba(59,130,246,0.12)', 
            borderWidth:3,
            tension:.35, 
            fill:true,
            pointRadius:0,
            pointHoverRadius:6,
            pointBackgroundColor:'#3b82f6',
            pointBorderColor:'#fff',
            pointBorderWidth:2
          },
          { 
            label:'Fatigue (ATL)', 
            data:atl, 
            borderColor:'#8b5cf6', 
            backgroundColor:'rgba(139,92,246,0.12)', 
            borderWidth:3,
            tension:.35, 
            fill:true,
            pointRadius:0,
            pointHoverRadius:6,
            pointBackgroundColor:'#8b5cf6',
            pointBorderColor:'#fff',
            pointBorderWidth:2
          },
          { 
            label:'Form (TSB)', 
            data:tsb, 
            borderColor:'#10b981', 
            backgroundColor:'rgba(16,185,129,0.12)', 
            borderWidth:3,
            tension:.35, 
            fill:true,
            pointRadius:0,
            pointHoverRadius:6,
            pointBackgroundColor:'#10b981',
            pointBorderColor:'#fff',
            pointBorderWidth:2
          }
        ]
      },
      options:{
        responsive:true, 
        maintainAspectRatio:false,
        interaction:{ mode:'index', intersect:false },
        plugins:{ 
          legend:{ 
            position:'bottom',
            labels: {
              padding:18,
              font:{ size:13, weight:'600' },
              usePointStyle:true,
              pointStyle:'circle'
            }
          },
          tooltip: {
            backgroundColor:'rgba(0, 0, 0, 0.85)',
            padding:14,
            titleFont:{ size:14, weight:'700' },
            bodyFont:{ size:13 },
            borderColor:'#3b82f6',
            borderWidth:1
          }
        },
        scales:{
          x:{ 
            grid:{ display:true, color:'rgba(0,0,0,0.04)' },
            ticks:{ font:{ size:11, weight:'500' } }
          },
          y:{ 
            grid:{ color:'rgba(0,0,0,0.04)', drawBorder:false },
            ticks:{ font:{ size:11, weight:'500' } }
          }
        }
      }
    });
  },

  setupRangeControls(data) {
    document.querySelectorAll('.chart-controls .chart-control').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        btn.parentElement.querySelectorAll('.chart-control').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');

        const days = Number(btn.dataset.range)||90;
        if (data?.trainingLoad?.daily?.length) {
          const sliced = { ...data, trainingLoad:{ ...data.trainingLoad, daily: data.trainingLoad.daily.slice(-days) } };
          this.initChart(sliced);
        }
      });
    });
  },

  escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, s => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[s]));
  },

  async refresh() { await this.load(); }
};

export default overviewPage;