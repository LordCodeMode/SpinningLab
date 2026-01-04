import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Services from '../../../static/js/services/index.js';
import { LoadingSkeleton, InsightCard } from '../../../static/js/components/ui/index.js';
import CONFIG from '../../../static/js/pages/efficiency/config.js';
import { eventBus, EVENTS } from '../../../static/js/core/eventBus.js';

const RANGE_OPTIONS = [60, 120, 180, 240];
const DEFAULT_DAYS = CONFIG.DEFAULT_DAYS?.efficiency || 120;

const formatTrendLabel = (trend) => {
  switch (trend) {
    case 'improving':
      return 'Efficiency improving';
    case 'declining':
      return 'Efficiency declining';
    case 'stable':
      return 'Holding steady';
    case 'insufficient_data':
      return 'More GA1 data needed';
    default:
      return 'Not enough data yet';
  }
};

const formatDateLong = (dateValue) => {
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return String(dateValue ?? '');
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const EfficiencyApp = () => {
  const [currentDays, setCurrentDays] = useState(DEFAULT_DAYS);
  const [currentFilter, setCurrentFilter] = useState('ga1');
  const [data, setData] = useState(null);
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);

  const loadData = useCallback(async ({ days = currentDays, forceRefresh = false } = {}) => {
    setLoading(true);
    setError('');
    try {
      const response = await Services.data.getEfficiency({ days, forceRefresh });
      setData(response);
      setInsights(Services.insight.generateEfficiencyInsights(response?.metrics || {}));
    } catch (err) {
      setError(err?.message || 'Unable to load efficiency data');
    } finally {
      setLoading(false);
    }
  }, [currentDays]);

  useEffect(() => {
    Services.analytics.trackPageView('efficiency');
    loadData({ days: currentDays });
  }, [currentDays, loadData]);

  useEffect(() => {
    const unsubscribe = eventBus.on(EVENTS.DATA_IMPORTED, () => {
      loadData({ days: currentDays, forceRefresh: true });
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [currentDays, loadData]);

  const activeSeries = useMemo(() => {
    const base = data?.timeseries || [];
    if (currentFilter === 'ga1') {
      const filtered = base.filter((item) => Number.isFinite(item.intensityFactor) && item.intensityFactor < 0.75);
      return filtered.length ? filtered : base;
    }
    return base;
  }, [currentFilter, data]);

  const filterLabel = useMemo(() => {
    if (currentFilter === 'ga1') {
      return data?.metrics?.ga1Sessions ? 'GA1 focus (<0.75 IF)' : 'GA1 focus unavailable - showing all sessions';
    }
    return 'All sessions';
  }, [currentFilter, data]);

  const metrics = data?.metrics || {};
  const trendArrow = metrics.trend === 'improving' ? '▲' : metrics.trend === 'declining' ? '▼' : '▬';
  const trendClass = metrics.trend === 'improving' ? 'positive' : metrics.trend === 'declining' ? 'negative' : 'neutral';
  const trendPct = Number.isFinite(metrics.trendPct)
    ? `${metrics.trendPct > 0 ? '+' : ''}${metrics.trendPct.toFixed(1)}%`
    : '—';
  const delta = Number.isFinite(metrics.currentEf) && Number.isFinite(metrics.averageEfGa1)
    ? metrics.currentEf - metrics.averageEfGa1
    : null;

  const recentSessions = useMemo(() => {
    const series = Array.isArray(data?.timeseries) ? [...data.timeseries] : [];
    return series
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      .slice(0, 8);
  }, [data]);

  const handleRangeChange = (days) => {
    if (days === currentDays) return;
    setCurrentDays(days);
    Services.analytics.trackTimeRangeChange('efficiency', `${days}d`);
  };

  const handleFilterChange = (filter) => {
    if (filter === currentFilter) return;
    setCurrentFilter(filter);
  };

  useEffect(() => {
    if (!chartRef.current || !data?.timeseries) return;
    const Chart = window.Chart;
    if (!Chart) return;

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
      chartInstanceRef.current = null;
    }

    const chartPacket = Services.chart.prepareEfficiencyChart(activeSeries, { includeRolling: true, rollingWindow: 5 });
    const chartData = {
      labels: chartPacket.labels,
      datasets: chartPacket.datasets
    };
    const chartOptions = Services.chart.getEfficiencyChartOptions(chartPacket.meta);

    chartInstanceRef.current = new Chart(chartRef.current, {
      type: 'line',
      data: chartData,
      options: chartOptions
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [activeSeries, data]);

  if (loading) {
    return (
      <div className="eff-page">
        <div dangerouslySetInnerHTML={{ __html: LoadingSkeleton({ type: 'chart', count: 1 }) }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-state">
        <h3>Failed to Load Efficiency</h3>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="eff-page">
      <div className="eff-header">
        <div>
          <h1>{CONFIG.title || 'Efficiency Analysis'}</h1>
          <p>Track aerobic efficiency (NP / HR) across your endurance training</p>
        </div>
        <div className="eff-range-controls">
          {RANGE_OPTIONS.map((days) => (
            <button
              key={days}
              className={`eff-range-btn ${currentDays === days ? 'active' : ''}`}
              type="button"
              onClick={() => handleRangeChange(days)}
            >
              {days}d
            </button>
          ))}
        </div>
      </div>

      <div className="eff-metrics">
        <div className="eff-metric-card">
          <div className="eff-metric-label">Current EF</div>
          <div className="eff-metric-value">
            {metrics.currentEf ? metrics.currentEf.toFixed(2) : '—'}
            {delta !== null ? (
              <span className={`eff-delta ${delta >= 0 ? 'positive' : 'negative'}`}>
                {delta >= 0 ? '+' : ''}{delta.toFixed(3)}
              </span>
            ) : null}
          </div>
          <div className="eff-metric-sub">Latest GA1 session</div>
        </div>
        <div className="eff-metric-card">
          <div className="eff-metric-label">Average EF ({currentDays}d)</div>
          <div className="eff-metric-value">{metrics.averageEfGa1 ? metrics.averageEfGa1.toFixed(2) : '—'}</div>
          <div className="eff-metric-sub">
            GA1 sessions • {metrics.ga1Sessions || 0} of {metrics.totalSessions || 0}
          </div>
        </div>
        <div className="eff-metric-card">
          <div className="eff-metric-label">All Sessions Avg</div>
          <div className="eff-metric-value">{metrics.averageEfAll ? metrics.averageEfAll.toFixed(2) : '—'}</div>
          <div className="eff-metric-sub">All rides across range</div>
        </div>
        <div className="eff-metric-card eff-metric-card--trend">
          <div className="eff-metric-label">Trend</div>
          <div className={`eff-metric-value ${trendClass}`}>{trendArrow} {trendPct}</div>
          <div className="eff-metric-sub">{formatTrendLabel(metrics.trend)}</div>
        </div>
      </div>

      <div className="eff-chart-card">
        <div className="eff-chart-header">
          <div>
            <h3>Efficiency Trend</h3>
            <p>{activeSeries.length} session{activeSeries.length === 1 ? '' : 's'} plotted • {filterLabel}</p>
          </div>
          <div className="eff-chart-filters">
            <button
              className={`eff-filter-btn ${currentFilter === 'ga1' ? 'active' : ''}`}
              type="button"
              onClick={() => handleFilterChange('ga1')}
            >
              GA1 Sessions
            </button>
            <button
              className={`eff-filter-btn ${currentFilter === 'all' ? 'active' : ''}`}
              type="button"
              onClick={() => handleFilterChange('all')}
            >
              All Sessions
            </button>
          </div>
        </div>
        <div className="eff-chart-container">
          <canvas ref={chartRef} id="efficiencyChart"></canvas>
        </div>
      </div>

      <div className="eff-session-card">
        <div className="eff-session-header">
          <h3>Recent Sessions</h3>
          <p>
            {recentSessions.length
              ? `Most recent ${recentSessions.length} activities with efficiency data`
              : 'No sessions with efficiency data in the selected range.'}
          </p>
        </div>
        {recentSessions.length ? (
          <div className="eff-session-grid">
            <div className="eff-session-row eff-session-row--head">
              <div>Date</div>
              <div>EF</div>
              <div>NP</div>
              <div>Avg HR</div>
              <div>IF</div>
            </div>
            <div className="eff-session-body">
              {recentSessions.map((item, index) => (
                <div key={`${item.timestamp || item.date || index}`} className="eff-session-row">
                  <div>{formatDateLong(item.date)}</div>
                  <div className="eff-session-ef">{Number.isFinite(item.ef) ? item.ef.toFixed(2) : '—'}</div>
                  <div>{Number.isFinite(item.np) ? `${item.np.toFixed(0)} W` : '—'}</div>
                  <div>{Number.isFinite(item.hr) ? `${item.hr.toFixed(0)} bpm` : '—'}</div>
                  <div>
                    {Number.isFinite(item.intensityFactor)
                      ? `${item.intensityFactor.toFixed(2)}${item.ga1 ? ' • GA1' : ''}`
                      : '—'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="eff-empty">Upload training sessions with both power and heart rate to build your efficiency history.</div>
        )}
      </div>

      {insights.length ? (
        <div className="eff-insights">
          <h3>Insights & Recommendations</h3>
          <div
            className="insights-grid"
            dangerouslySetInnerHTML={{
              __html: insights.map((insight) => InsightCard(insight)).join('')
            }}
          />
        </div>
      ) : null}
    </div>
  );
};

export default EfficiencyApp;
