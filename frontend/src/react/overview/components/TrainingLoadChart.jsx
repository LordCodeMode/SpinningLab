import React, { useEffect, useRef } from 'react';
import { formatDateShort, hasTrainingLoadData } from '../overviewUtils';

const TrainingLoadChart = ({ 
  chartSeries, 
  chartMeta, 
  chartSummary, 
  trainingLoadRange, 
  availableRanges, 
  handleRangeChange 
}) => {
  const chartRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !chartSeries.points.length) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const labels = chartSeries.points.map((p) => p.date);
    const pointRadii = labels.map(() => 0);
    const hoverRadii = labels.map(() => 6);
    const datasets = [];

    if (chartSeries.hasTss) {
      datasets.push({
        label: 'TSS',
        data: chartSeries.points.map((point) => point.tss || 0),
        type: 'bar',
        backgroundColor: 'rgba(245, 158, 11, 0.6)',
        borderColor: 'rgba(245, 158, 11, 1)',
        borderWidth: 1.5,
        borderRadius: 6,
        barPercentage: 0.7,
        categoryPercentage: 0.72,
        yAxisID: 'y',
        order: 3
      });
    }

    if (chartSeries.hasDistance) {
      datasets.push({
        label: 'Distance (km)',
        data: chartSeries.points.map((point) => point.distance || 0),
        type: 'line',
        borderColor: 'rgba(139, 92, 246, 1)',
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        borderWidth: 2.5,
        fill: false,
        tension: 0.4,
        yAxisID: 'y1',
        order: 2,
        pointRadius: pointRadii,
        pointHoverRadius: hoverRadii,
        pointHitRadius: 12
      });
    }

    datasets.push({
      label: 'Fitness (CTL)',
      data: chartSeries.points.map((point) => point.ctl || 0),
      type: 'line',
      borderColor: 'rgba(59, 130, 246, 1)',
      backgroundColor: 'rgba(59, 130, 246, 0.14)',
      borderWidth: 3,
      fill: true,
      tension: 0.4,
      yAxisID: 'y',
      order: 1,
      pointRadius: pointRadii,
      pointHoverRadius: hoverRadii,
      pointHitRadius: 12
    });

    // Check if Chart is available (global)
    if (typeof Chart === 'undefined') {
      console.error('Chart.js is not loaded');
      return;
    }

    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              usePointStyle: true,
              padding: 12,
              font: { size: 12, weight: '600' }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            titleColor: '#111827',
            bodyColor: '#6b7280',
            borderColor: '#e5e7eb',
            borderWidth: 1,
            padding: 12,
            displayColors: true,
            callbacks: {
              label: (context) => {
                let label = context.dataset.label || '';
                if (label) label += ': ';
                if (context.parsed.y !== null) {
                  if (context.dataset.label === 'Distance (km)') {
                    label += `${context.parsed.y.toFixed(1)} km`;
                  } else if (context.dataset.label === 'TSS') {
                    label += Math.round(context.parsed.y);
                  } else {
                    label += context.parsed.y.toFixed(1);
                  }
                }
                return label;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 8,
              callback: function(value, index) {
                return formatDateShort(this.getLabelForValue(value));
              }
            }
          },
          y: {
            position: 'left',
            beginAtZero: true,
            grid: { color: 'rgba(0,0,0,0.05)' },
            title: {
              display: true,
              text: 'CTL / TSS',
              font: { size: 11, weight: '600' }
            }
          },
          y1: {
            position: 'right',
            beginAtZero: true,
            display: chartSeries.hasDistance,
            grid: { display: false },
            title: {
              display: true,
              text: 'Distance (km)',
              font: { size: 11, weight: '600' }
            }
          }
        }
      }
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, [chartSeries]);

  return (
    <div className="ov-chart-widget">
      <div className="ov-chart-header section-header">
        <div>
          <h3 className="ov-chart-title section-title">Training Load Trend</h3>
          <p className="ov-chart-subtitle section-subtitle">CTL, ATL, and TSB progression</p>
          <div className="ov-chart-meta">
            <span className="ov-chart-pill">{trainingLoadRange}d window</span>
            {chartMeta.modeLabel && (
              <span className="ov-chart-pill ov-chart-pill--subtle">{chartMeta.modeLabel}</span>
            )}
            {chartMeta.endLabel && (
              <span className="ov-chart-pill ov-chart-pill--ghost">Updated {chartMeta.endLabel}</span>
            )}
          </div>
        </div>
        <div className="ov-chart-controls">
          {availableRanges.map((days) => (
            <button
              key={days}
              className={`ov-chart-btn ${trainingLoadRange === days ? 'active' : ''}`}
              type="button"
              aria-pressed={trainingLoadRange === days}
              onClick={() => handleRangeChange(days)}
            >
              {days}d
            </button>
          ))}
        </div>
      </div>
      <div className="ov-chart-canvas">
        {hasTrainingLoadData(chartSeries.points) ? (
          <canvas ref={canvasRef} id="trainingLoadChart" />
        ) : (
          <div className="chart-empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h4>No Training Load Data</h4>
            <p>We could not find any recent TSS data. Upload new workouts to see your load progression.</p>
          </div>
        )}
      </div>
      <div className="ov-chart-footer">
        <div className="ov-chart-foot-card glass-card">
          <span className="ov-chart-foot-label">Avg CTL</span>
          <span className="ov-chart-foot-value">{chartSummary.avgCtl.toFixed(1)}</span>
        </div>
        <div className="ov-chart-foot-card glass-card">
          <span className="ov-chart-foot-label">Avg TSS</span>
          <span className="ov-chart-foot-value">{chartSummary.avgTss.toFixed(0)}</span>
        </div>
        <div className="ov-chart-foot-card glass-card">
          <span className="ov-chart-foot-label">Total Distance</span>
          <span className="ov-chart-foot-value">{chartSummary.totalDistance.toFixed(0)} km</span>
        </div>
        <div className="ov-chart-foot-card glass-card">
          <span className="ov-chart-foot-label">Sessions</span>
          <span className="ov-chart-foot-value">{Math.round(chartSummary.totalSessions)}</span>
        </div>
      </div>
    </div>
  );
};

export default TrainingLoadChart;
