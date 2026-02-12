import React, { useEffect, useRef } from 'react';
import { Activity as ActivityIcon } from 'lucide-react';
import { 
  getTimelineHoverIndex, 
  clearLinkedTimelineHover, 
  syncLinkedTimelineHover, 
  formatTimelineTick 
} from '../activityUtils';

const TimelineCharts = ({ streams, timelineMaxSeconds, hasPowerStream, hasHRStream }) => {
  const powerTimelineCanvasRef = useRef(null);
  const hrTimelineCanvasRef = useRef(null);
  const powerTimelineChartRef = useRef(null);
  const hrTimelineChartRef = useRef(null);

  useEffect(() => {
    const Chart = typeof window !== 'undefined' ? window.Chart : null;
    if (!Chart || !powerTimelineCanvasRef.current) return;

    if (powerTimelineChartRef.current) {
      powerTimelineChartRef.current.destroy();
    }

    const canvas = powerTimelineCanvasRef.current;
    if (!Array.isArray(streams?.time) || !Array.isArray(streams?.power)) return;

    const maxTime = Number.isFinite(timelineMaxSeconds) && timelineMaxSeconds > 0
      ? timelineMaxSeconds
      : undefined;

    powerTimelineChartRef.current = new Chart(canvas, {
      type: 'line',
      data: {
        labels: streams.time,
        datasets: [{
          label: 'Power (W)',
          data: streams.power.map((value, index) => ({ x: streams.time[index], y: value })),
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
          tension: 0.25,
          spanGaps: true,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: '#3b82f6',
          pointHoverBorderColor: '#ffffff',
          pointHoverBorderWidth: 2,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        onHover: (_event, _elements, chart) => {
          const index = getTimelineHoverIndex(chart, _event);
          if (index == null) {
            clearLinkedTimelineHover(hrTimelineChartRef.current);
            return;
          }
          syncLinkedTimelineHover(hrTimelineChartRef.current, index);
        },
        elements: { point: { radius: 0 } },
        scales: {
          x: {
            type: 'linear',
            min: 0,
            max: maxTime,
            ticks: {
              callback: (value) => formatTimelineTick(value),
              color: '#64748b',
              font: { size: 11, weight: '600' },
              maxTicksLimit: 6
            },
            title: {
              display: true,
              text: 'Time',
              color: '#1e293b',
              font: { size: 12, weight: '700' }
            },
            grid: { color: 'rgba(148, 163, 184, 0.08)', drawBorder: false }
          },
          y: {
            title: {
              display: true,
              text: 'W',
              color: '#1e293b',
              font: { size: 12, weight: '700' }
            },
            ticks: {
              color: '#64748b',
              font: { size: 11, weight: '600' },
              maxTicksLimit: 5
            },
            grid: { color: 'rgba(148, 163, 184, 0.08)', drawBorder: false }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            intersect: false,
            displayColors: false,
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            titleColor: '#ffffff',
            bodyColor: '#e2e8f0',
            borderColor: '#3b82f6',
            borderWidth: 1.5,
            padding: 10,
            callbacks: {
              title: (context) => {
                if (!context.length) return '';
                const seconds = context[0].parsed.x ?? context[0].label;
                return `Time: ${formatTimelineTick(seconds)}`;
              },
              label: (context) => {
                const index = context?.dataIndex;
                if (index == null) return 'No data';
                const powerValue = streams?.power?.[index];
                const hrValue = streams?.heart_rate?.[index];
                const lines = [];
                if (powerValue != null) lines.push(`Power: ${Math.round(powerValue)} W`);
                if (hrValue != null) lines.push(`HR: ${Math.round(hrValue)} bpm`);
                return lines.length ? lines : ['No data'];
              }
            }
          }
        }
      }
    });

    const handleLeave = () => {
      clearLinkedTimelineHover(powerTimelineChartRef.current);
      clearLinkedTimelineHover(hrTimelineChartRef.current);
    };
    canvas.addEventListener('mouseleave', handleLeave);

    return () => {
      canvas.removeEventListener('mouseleave', handleLeave);
      if (powerTimelineChartRef.current) {
        powerTimelineChartRef.current.destroy();
      }
    };
  }, [streams?.time, streams?.power, streams?.heart_rate, timelineMaxSeconds]);

  useEffect(() => {
    const Chart = typeof window !== 'undefined' ? window.Chart : null;
    if (!Chart || !hrTimelineCanvasRef.current) return;

    if (hrTimelineChartRef.current) {
      hrTimelineChartRef.current.destroy();
    }

    const canvas = hrTimelineCanvasRef.current;
    if (!Array.isArray(streams?.time) || !Array.isArray(streams?.heart_rate)) return;

    const maxTime = Number.isFinite(timelineMaxSeconds) && timelineMaxSeconds > 0
      ? timelineMaxSeconds
      : undefined;

    hrTimelineChartRef.current = new Chart(canvas, {
      type: 'line',
      data: {
        labels: streams.time,
        datasets: [{
          label: 'Heart Rate (bpm)',
          data: streams.heart_rate.map((value, index) => ({ x: streams.time[index], y: value })),
          borderColor: '#ef4444',
          backgroundColor: (context) => {
            const { chart } = context;
            const { ctx, chartArea } = chart;
            if (!chartArea) return 'rgba(239, 68, 68, 0.12)';
            const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradient.addColorStop(0, 'rgba(239, 68, 68, 0.28)');
            gradient.addColorStop(1, 'rgba(239, 68, 68, 0.02)');
            return gradient;
          },
          fill: true,
          tension: 0.25,
          spanGaps: true,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: '#ef4444',
          pointHoverBorderColor: '#ffffff',
          pointHoverBorderWidth: 2,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        onHover: (_event, _elements, chart) => {
          const index = getTimelineHoverIndex(chart, _event);
          if (index == null) {
            clearLinkedTimelineHover(powerTimelineChartRef.current);
            return;
          }
          syncLinkedTimelineHover(powerTimelineChartRef.current, index);
        },
        elements: { point: { radius: 0 } },
        scales: {
          x: {
            type: 'linear',
            min: 0,
            max: maxTime,
            ticks: {
              callback: (value) => formatTimelineTick(value),
              color: '#64748b',
              font: { size: 11, weight: '600' },
              maxTicksLimit: 6
            },
            title: {
              display: true,
              text: 'Time',
              color: '#1e293b',
              font: { size: 12, weight: '700' }
            },
            grid: { color: 'rgba(148, 163, 184, 0.08)', drawBorder: false }
          },
          y: {
            title: {
              display: true,
              text: 'bpm',
              color: '#1e293b',
              font: { size: 12, weight: '700' }
            },
            ticks: {
              color: '#64748b',
              font: { size: 11, weight: '600' },
              maxTicksLimit: 5
            },
            grid: { color: 'rgba(148, 163, 184, 0.08)', drawBorder: false }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            intersect: false,
            displayColors: false,
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            titleColor: '#ffffff',
            bodyColor: '#e2e8f0',
            borderColor: '#ef4444',
            borderWidth: 1.5,
            padding: 10,
            callbacks: {
              title: (context) => {
                if (!context.length) return '';
                const seconds = context[0].parsed.x ?? context[0].label;
                return `Time: ${formatTimelineTick(seconds)}`;
              },
              label: (context) => {
                const index = context?.dataIndex;
                if (index == null) return 'No data';
                const hrValue = streams?.heart_rate?.[index];
                const powerValue = streams?.power?.[index];
                const lines = [];
                if (hrValue != null) lines.push(`HR: ${Math.round(hrValue)} bpm`);
                if (powerValue != null) lines.push(`Power: ${Math.round(powerValue)} W`);
                return lines.length ? lines : ['No data'];
              }
            }
          }
        }
      }
    });

    const handleLeave = () => {
      clearLinkedTimelineHover(hrTimelineChartRef.current);
      clearLinkedTimelineHover(powerTimelineChartRef.current);
    };
    canvas.addEventListener('mouseleave', handleLeave);

    return () => {
      canvas.removeEventListener('mouseleave', handleLeave);
      if (hrTimelineChartRef.current) {
        hrTimelineChartRef.current.destroy();
      }
    };
  }, [streams?.time, streams?.heart_rate, streams?.power, timelineMaxSeconds]);

  const hasTimelineData = hasPowerStream || hasHRStream;

  return (
    <section className="activity-section">
      <h2 className="activity-section-title section-title">Effort Timeline</h2>
      {hasTimelineData ? (
        <div className="activity-timeline-grid activity-timeline-grid--flush">
          {hasPowerStream && (
            <div className="activity-chart-card activity-chart-card--flush">
              <div className="activity-chart-card-header">
                <h3>Power Timeline</h3>
                <p>Complete wattage trace across the ride</p>
              </div>
              <div className="activity-chart-wrapper">
                <canvas ref={powerTimelineCanvasRef}></canvas>
              </div>
            </div>
          )}
          {hasHRStream && (
            <div className="activity-chart-card activity-chart-card--flush">
              <div className="activity-chart-card-header">
                <h3>Heart Rate Timeline</h3>
                <p>Cardiac response throughout the session</p>
              </div>
              <div className="activity-chart-wrapper">
                <canvas ref={hrTimelineCanvasRef}></canvas>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="activity-empty-state">
          <ActivityIcon size={48} className="mb-4 text-slate-300" />
          <p>No timeline data found for this activity.</p>
        </div>
      )}
    </section>
  );
};

export default TimelineCharts;
