import React, { useEffect, useRef, useMemo } from 'react';
import * as mapboxglModule from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Map as MapIcon } from 'lucide-react';
import AppConfig from '../../../lib/core/config.js';
import { 
  decodePolyline, 
  buildPowerSegments, 
  buildHeartRateSegments,
  MAP_HR_COLORS,
  MAP_POWER_COLORS
} from '../activityUtils';

const mapboxgl = mapboxglModule.default || mapboxglModule;

const LegendGradient = ({ colors, label }) => {
  const safeColors = colors.length ? colors : ['#9ca3af', '#111827'];
  const gradientId = `activity-map-gradient-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
  return (
    <svg className="activity-map-legend-bar" viewBox="0 0 100 12" preserveAspectRatio="none" role="img" aria-label={label}>
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          {safeColors.map((color, index) => {
            const offset = safeColors.length === 1 ? 0 : (index / (safeColors.length - 1)) * 100;
            return <stop key={`${color}-${offset}`} offset={`${offset}%`} stopColor={color} />;
          })}
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="100" height="12" rx="6" fill={`url(#${gradientId})`} />
    </svg>
  );
};

const ActivityMap = ({ 
  activity, 
  streams, 
  settings, 
  routeMetric, 
  setRouteMetric, 
  hasPowerStream, 
  hasHRStream 
}) => {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const [mapError, setMapError] = React.useState('');

  const mapLegendColors = useMemo(() => {
    const isHeartRate = routeMetric === 'hr';
    const zoneSource = isHeartRate ? AppConfig?.HR_ZONES : AppConfig?.POWER_ZONES;
    const palette = isHeartRate ? MAP_HR_COLORS : MAP_POWER_COLORS;
    const zoneColors = (zoneSource || []).map((zone, index) => (
      palette[index] || zone.color
    )).filter(Boolean);
    if (!zoneColors.length) {
      return isHeartRate ? ['#fecdd3', '#e11d48'] : ['#9ca3af', '#111827'];
    }
    return zoneColors;
  }, [routeMetric]);

  const mapLegendZones = useMemo(() => {
    const isHeartRate = routeMetric === 'hr';
    const zoneSource = isHeartRate ? AppConfig?.HR_ZONES : AppConfig?.POWER_ZONES;
    const palette = isHeartRate ? MAP_HR_COLORS : MAP_POWER_COLORS;
    const ftp = settings?.ftp || 250;
    const hrMax = settings?.hr_max || 190;
    return (zoneSource || []).map((zone, index) => {
      const label = zone.name ? zone.name.split(' ')[0] : `Z${index + 1}`;
      const minValue = Math.round(zone.min * (isHeartRate ? hrMax : ftp));
      const maxValue = Number.isFinite(zone.max) && zone.max !== Infinity
        ? Math.round(zone.max * (isHeartRate ? hrMax : ftp))
        : null;
      const unit = isHeartRate ? 'bpm' : 'W';
      const rangeLabel = maxValue ? `${minValue}-${maxValue}${unit}` : `${minValue}+${unit}`;
      const tooltip = `${zone.name || label}: ${rangeLabel}`;
      return {
        label,
        rangeLabel,
        tooltip,
        color: palette[index] || zone.color || '#9ca3af'
      };
    });
  }, [routeMetric, settings?.ftp, settings?.hr_max]);

  const routePolyline = activity?.map?.summary_polyline
    || activity?.route_polyline
    || activity?.routePolyline
    || activity?.summary_polyline
    || activity?.map?.polyline
    || null;

  useEffect(() => {
    if (!mapContainerRef.current || !routePolyline) return;

    const accessToken = AppConfig?.MAPBOX_ACCESS_TOKEN;
    if (!accessToken) {
      setMapError('Mapbox access token is missing in configuration.');
      return;
    }

    mapboxgl.accessToken = accessToken;

    try {
      const coordinates = decodePolyline(routePolyline);
      if (!coordinates.length) {
        setMapError('No valid coordinates found in activity polyline.');
        return;
      }

      const bounds = coordinates.reduce(
        (acc, coord) => acc.extend(coord),
        new mapboxgl.LngLatBounds(coordinates[0], coordinates[0])
      );

      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        bounds,
        fitBoundsOptions: { padding: 40, duration: 0 },
        attributionControl: false,
        scrollZoom: false
      });

      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');

      map.on('load', () => {
        const ftp = settings?.ftp || 250;
        const hrMax = settings?.hr_max || 190;
        const latlngStream = streams?.latlng;
        const timeStream = streams?.time;

        let geojson = null;
        if (routeMetric === 'hr' && latlngStream) {
          geojson = buildHeartRateSegments(latlngStream, streams.heart_rate, timeStream, hrMax);
        } else if (routeMetric === 'power' && latlngStream) {
          geojson = buildPowerSegments(latlngStream, streams.power, timeStream, ftp);
        }

        if (!geojson) {
          map.addSource('route', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates }
            }
          });
          map.addLayer({
            id: 'route',
            type: 'line',
            source: 'route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#3b82f6', 'line-width': 4 }
          });
        } else {
          map.addSource('route-segments', { type: 'geojson', data: geojson });
          map.addLayer({
            id: 'route-segments',
            type: 'line',
            source: 'route-segments',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': ['get', 'color'], 'line-width': 4 }
          });
        }

        const start = coordinates[0];
        const end = coordinates[coordinates.length - 1];

        new mapboxgl.Marker({ color: '#10b981', scale: 0.7 })
          .setLngLat(start)
          .addTo(map);
        new mapboxgl.Marker({ color: '#ef4444', scale: 0.7 })
          .setLngLat(end)
          .addTo(map);
      });

      mapRef.current = map;
    } catch (err) {
      setMapError(`Failed to initialize map: ${err.message}`);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [routePolyline, routeMetric, streams, settings]);

  const resolvedRouteMetric = (routeMetric === 'hr' && !hasHRStream) ? 'power' : routeMetric;
  const routeMetricLabel = resolvedRouteMetric === 'hr' ? 'Heart rate' : 'Power';
  const legendLowLabel = resolvedRouteMetric === 'hr' ? 'Recovery' : 'Zone 1';
  const legendHighLabel = resolvedRouteMetric === 'hr' ? 'Max' : 'Zone 7';

  return (
    <section className="activity-section activity-section--map">
      <div className="activity-map-header">
        <h2 className="activity-section-title section-title">Route Map</h2>
        <div className="activity-map-controls">
          {hasPowerStream && hasHRStream ? (
            <div className="activity-map-toggle">
              <button
                type="button"
                className={`activity-map-toggle__btn ${resolvedRouteMetric === 'power' ? 'is-active' : ''}`}
                onClick={() => setRouteMetric('power')}
              >
                Power
              </button>
              <button
                type="button"
                className={`activity-map-toggle__btn ${resolvedRouteMetric === 'hr' ? 'is-active' : ''}`}
                onClick={() => setRouteMetric('hr')}
              >
                Heart rate
              </button>
            </div>
          ) : (
            <span className="activity-map-pill">{routeMetricLabel}</span>
          )}
        </div>
      </div>
      {mapError ? (
        <div className="activity-empty-state">
          <MapIcon size={48} className="mb-4 text-slate-300" />
          <p>{mapError}</p>
        </div>
      ) : (
        <>
          <div className="activity-map-card activity-map-card--hero">
            <div className="activity-map" ref={mapContainerRef}></div>
          </div>
          <div className="activity-map-legend">
            <LegendGradient colors={mapLegendColors} label={`${routeMetricLabel} legend`} />
            <div className="activity-map-legend-labels">
              <span>{legendLowLabel}</span>
              <span>{legendHighLabel}</span>
            </div>
            <div className="activity-map-legend-zones">
              {mapLegendZones.map((zone) => (
                <div className="activity-map-legend-zone" key={zone.label} title={zone.tooltip}>
                  <svg className="activity-map-legend-swatch" viewBox="0 0 12 12" aria-hidden="true">
                    <rect x="0" y="0" width="12" height="12" rx="6" fill={zone.color} />
                  </svg>
                  <span className="activity-map-legend-text">
                    {zone.label} {zone.rangeLabel}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
};

export default ActivityMap;
