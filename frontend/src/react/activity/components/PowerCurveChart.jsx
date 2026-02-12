import React, { useEffect, useRef } from 'react';
import { 
  POWER_CURVE_TICK_VALUES, 
  formatDurationShort 
} from '../activityUtils';

const PowerCurveChart = ({ streams, timelineMaxSeconds }) => {
  const activityPowerCurveCanvasRef = useRef(null);
  const activityPowerCurveRef = useRef(null);

  useEffect(() => {
    const Chart = typeof window !== 'undefined' ? window.Chart : null;
    if (!Chart || !activityPowerCurveCanvasRef.current) return;

    if (activityPowerCurveRef.current) {
      activityPowerCurveRef.current.destroy();
    }

    const canvas = activityPowerCurveCanvasRef.current;
    const powerCurve = streams?.power_curve;
    if (!powerCurve || !powerCurve.durations?.length) return;

    const movingMax = Number.isFinite(timelineMaxSeconds) && timelineMaxSeconds > 0
      ? timelineMaxSeconds
      : null;
    let durations = powerCurve.durations;
    let powers = powerCurve.powers;
    if (movingMax) {
      const filtered = powerCurve.durations
        .map((duration, index) => ({ duration, power: powerCurve.powers[index] }))
        .filter((entry) => entry.duration <= movingMax);
      if (filtered.length >= 2) {
        durations = filtered.map((entry) => entry.duration);
        powers = filtered.map((entry) => entry.power);
      }
    }

    const minDuration = Math.min(...durations);
    const maxDuration = Math.max(...durations);
    const tickValues = POWER_CURVE_TICK_VALUES
      .filter((value) => value >= minDuration && value <= maxDuration)
      .sort((a, b) => a - b);
    const tickSet = new Set(tickValues);

    activityPowerCurveRef.current = new Chart(canvas, {
      type: 'line',
      data: {
        labels: durations,
        datasets: [{
          label: 'Best Power',
          data: durations.map((duration, index) => ({
            x: duration,
            y: powers[index]
          })),
          borderColor: '#3b82f6',
          backgroundColor: (context) => {
            const { chart } = context;
            const { ctx, chartArea } = chart;
            if (!chartArea) return 'rgba(59, 130, 246, 0.12)';
            const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradient.addColorStop(0, 'rgba(59, 130, 246, 0.28)');
            gradient.addColorStop(1, 'rgba(59, 130, 246, 0.02)');
            return gradient;
          },
          fill: true,
          tension: 0.28,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: '#3b82f6',
          pointHoverBorderWidth: 2,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'nearest' },
        scales: {
          x: {
            type: 'logarithmic',
            min: minDuration,
            max: maxDuration,
            bounds: 'ticks',
            ticks: {
              autoSkip: false,
              callback: (value) => (tickSet.has(value) ? formatDurationShort(value) : ''),
              color: '#64748b',
              font: { size: 11, weight: '600' }
            },
            title: {
              display: true,
              text: 'Duration',
              color: '#1e293b',
              font: { size: 12, weight: '700' }
            },
            grid: {
              color: (context) => {
                const value = context.tick.value;
                if (tickSet.has(value)) {
                  return 'rgba(59, 130, 246, 0.18)';
                }
                return 'transparent';
              },
              lineWidth: (context) => (tickSet.has(context.tick.value) ? 1.5 : 0),
              drawBorder: false
            },
            afterBuildTicks: (scale) => {
              if (!tickValues.length) return;
              scale.ticks = tickValues.map((value) => ({ value }));
            }
          },
          y: {
            title: {
              display: true,
              text: 'Power (W)',
              color: '#1e293b',
              font: { size: 12, weight: '700' }
            },
            ticks: {
              color: '#64748b',
              font: { size: 11, weight: '600' },
              callback: (value) => Math.round(value),
              maxTicksLimit: 5
            },
            grid: { color: 'rgba(148, 163, 184, 0.07)', drawBorder: false }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: true,
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            titleColor: '#ffffff',
            bodyColor: '#e2e8f0',
            borderColor: '#3b82f6',
            borderWidth: 1.5,
            padding: 12,
            callbacks: {
              title: (context) => {
                if (!context.length) return '';
                const duration = context[0].parsed.x;
                return `Duration: ${formatDurationShort(duration)}`;
              },
              label: (context) => {
                const power = context.parsed.y;
                return `Power: ${Math.round(power)} W`;
              }
            }
          }
        }
      }
    });

    return () => {
      if (activityPowerCurveRef.current) {
        activityPowerCurveRef.current.destroy();
      }
    };
  }, [streams?.power_curve, timelineMaxSeconds]);

  return (
    <section className="activity-section">
      <h2 className="activity-section-title section-title">Power Curve (This Activity)</h2>
      <p className="activity-section-subtitle section-subtitle">Peak interval outputs calculated exclusively from this ride</p>
      <div className="activity-chart-card activity-chart-card--flush">
        <div className="activity-chart-wrapper">
          <canvas ref={activityPowerCurveCanvasRef}></canvas>
        </div>
      </div>
    </section>
  );
};

export default PowerCurveChart;
