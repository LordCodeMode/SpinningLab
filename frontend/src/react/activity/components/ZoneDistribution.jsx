import React, { useEffect, useRef } from 'react';
import { PieChart } from 'lucide-react';
import CONFIG from '../../../lib/pages/activity/config.js';
import { 
  formatDuration, 
  getZoneColor, 
  renderZoneTooltip, 
  getZoneRangeLabel, 
  getZoneDisplayParts 
} from '../activityUtils';

const ZoneDistribution = ({ activity, settings }) => {
  const powerZoneCanvasRef = useRef(null);
  const hrZoneCanvasRef = useRef(null);
  const powerZoneChartRef = useRef(null);
  const hrZoneChartRef = useRef(null);

  const hasPowerZones = Array.isArray(activity?.power_zones) && activity.power_zones.length > 0;
  const hasHRZones = Array.isArray(activity?.hr_zones) && activity.hr_zones.length > 0;

  const powerZoneTotalSeconds = hasPowerZones
    ? activity.power_zones.reduce((acc, zone) => acc + zone.seconds_in_zone, 0)
    : 0;
  const hrZoneTotalSeconds = hasHRZones
    ? activity.hr_zones.reduce((acc, zone) => acc + zone.seconds_in_zone, 0)
    : 0;

  useEffect(() => {
    const Chart = typeof window !== 'undefined' ? window.Chart : null;
    if (!Chart || !powerZoneCanvasRef.current || !hasPowerZones) return;

    if (powerZoneChartRef.current) {
      powerZoneChartRef.current.destroy();
    }

    const canvas = powerZoneCanvasRef.current;
    const sortedZones = [...activity.power_zones].sort((a, b) => {
      const aIdx = Number.parseInt(a.zone_label.replace(/\D/g, ''), 10);
      const bIdx = Number.parseInt(b.zone_label.replace(/\D/g, ''), 10);
      return aIdx - bIdx;
    });

    powerZoneChartRef.current = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: sortedZones.map((z) => z.zone_label),
        datasets: [{
          data: sortedZones.map((z) => z.seconds_in_zone / 60),
          backgroundColor: sortedZones.map((z) => getZoneColor(z.zone_label, CONFIG.POWER_ZONE_COLORS)),
          borderWidth: 0,
          hoverOffset: 4
        }]
      },
      options: {
        cutout: '72%',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: false,
            external: renderZoneTooltip
          }
        }
      }
    });

    return () => {
      if (powerZoneChartRef.current) {
        powerZoneChartRef.current.destroy();
      }
    };
  }, [activity?.power_zones, hasPowerZones]);

  useEffect(() => {
    const Chart = typeof window !== 'undefined' ? window.Chart : null;
    if (!Chart || !hrZoneCanvasRef.current || !hasHRZones) return;

    if (hrZoneChartRef.current) {
      hrZoneChartRef.current.destroy();
    }

    const canvas = hrZoneCanvasRef.current;
    const sortedZones = [...activity.hr_zones].sort((a, b) => {
      const aIdx = Number.parseInt(a.zone_label.replace(/\D/g, ''), 10);
      const bIdx = Number.parseInt(b.zone_label.replace(/\D/g, ''), 10);
      return aIdx - bIdx;
    });

    hrZoneChartRef.current = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: sortedZones.map((z) => z.zone_label),
        datasets: [{
          data: sortedZones.map((z) => z.seconds_in_zone / 60),
          backgroundColor: sortedZones.map((z) => getZoneColor(z.zone_label, CONFIG.HR_ZONE_COLORS)),
          borderWidth: 0,
          hoverOffset: 4
        }]
      },
      options: {
        cutout: '72%',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: false,
            external: renderZoneTooltip
          }
        }
      }
    });

    return () => {
      if (hrZoneChartRef.current) {
        hrZoneChartRef.current.destroy();
      }
    };
  }, [activity?.hr_zones, hasHRZones]);

  if (!hasPowerZones && !hasHRZones) {
    return (
      <section className="activity-section">
        <h2 className="activity-section-title section-title">Zone Distribution</h2>
        <div className="activity-empty-state">
          <PieChart size={48} className="mb-4 text-slate-300" />
          <p>No zone data available for this activity</p>
        </div>
      </section>
    );
  }

  return (
    <section className="activity-section">
      <h2 className="activity-section-title section-title">Zone Distribution</h2>
      <div className="activity-zones-grid">
        {hasPowerZones && (
          <div className="activity-zone-card">
            <h3 className="activity-zone-card-title">Power Zones</h3>
            <div className="activity-chart-container">
              <canvas ref={powerZoneCanvasRef}></canvas>
              <div className="activity-chart-center">
                <span className="activity-chart-center-label">Total</span>
                <span className="activity-chart-center-value">{formatDuration(powerZoneTotalSeconds)}</span>
              </div>
            </div>
            <p className="activity-zone-description">
              Distribution based on your FTP zones. Hover a slice to see minutes spent in each zone.
            </p>
            <div className="activity-zone-list">
              {activity.power_zones.map((zone) => {
                const percentage = powerZoneTotalSeconds > 0
                  ? (zone.seconds_in_zone / powerZoneTotalSeconds * 100).toFixed(1)
                  : '0.0';
                const rangeLabel = getZoneRangeLabel(zone.zone_label, 'power', settings);
                const { baseLabel, zoneName } = getZoneDisplayParts(zone.zone_label, 'power');
                return (
                  <div key={zone.zone_label} className="activity-zone-row">
                    <svg className="activity-zone-color" viewBox="0 0 12 12" aria-hidden="true">
                      <rect x="0" y="0" width="12" height="12" rx="6" fill={getZoneColor(zone.zone_label, CONFIG.POWER_ZONE_COLORS)} />
                    </svg>
                    <div className="activity-zone-label-block">
                      <span className="activity-zone-label">{baseLabel}</span>
                      {zoneName && <span className="activity-zone-name">{zoneName}</span>}
                      {rangeLabel && <span className="activity-zone-range">{rangeLabel}</span>}
                    </div>
                    <span className="activity-zone-time">{formatDuration(zone.seconds_in_zone)}</span>
                    <span className="activity-zone-percent">{percentage}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {hasHRZones && (
          <div className="activity-zone-card">
            <h3 className="activity-zone-card-title">Heart Rate Zones</h3>
            <div className="activity-chart-container">
              <canvas ref={hrZoneCanvasRef}></canvas>
              <div className="activity-chart-center">
                <span className="activity-chart-center-label">Total</span>
                <span className="activity-chart-center-value">{formatDuration(hrZoneTotalSeconds)}</span>
              </div>
            </div>
            <p className="activity-zone-description">
              Distribution based on your HR max zones. Hover a slice to see minutes spent in each zone.
            </p>
            <div className="activity-zone-list">
              {activity.hr_zones.map((zone) => {
                const percentage = hrZoneTotalSeconds > 0
                  ? (zone.seconds_in_zone / hrZoneTotalSeconds * 100).toFixed(1)
                  : '0.0';
                const rangeLabel = getZoneRangeLabel(zone.zone_label, 'hr', settings);
                const { baseLabel, zoneName } = getZoneDisplayParts(zone.zone_label, 'hr');
                return (
                  <div key={zone.zone_label} className="activity-zone-row">
                    <svg className="activity-zone-color" viewBox="0 0 12 12" aria-hidden="true">
                      <rect x="0" y="0" width="12" height="12" rx="6" fill={getZoneColor(zone.zone_label, CONFIG.HR_ZONE_COLORS)} />
                    </svg>
                    <div className="activity-zone-label-block">
                      <span className="activity-zone-label">{baseLabel}</span>
                      {zoneName && <span className="activity-zone-name">{zoneName}</span>}
                      {rangeLabel && <span className="activity-zone-range">{rangeLabel}</span>}
                    </div>
                    <span className="activity-zone-time">{formatDuration(zone.seconds_in_zone)}</span>
                    <span className="activity-zone-percent">{percentage}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default ZoneDistribution;
