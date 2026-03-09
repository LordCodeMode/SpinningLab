import React from 'react';
import { LoadingSpinner } from './States.jsx';

const HEIGHT_CLASS_MAP = {
  '300px': 'chart-container--300',
  '360px': 'chart-container--360',
  '400px': 'chart-container--400',
  '480px': 'chart-container--480',
  '100%': 'chart-container--full'
};

const getHeightClass = (height) => HEIGHT_CLASS_MAP[height] || 'chart-container--400';

/**
 * Chart Card Component
 * Card container for charts with controls
 */
export function ChartCard({
  id,
  title,
  subtitle,
  icon,
  controls,
  chartId = 'chart',
  chartHeight = '400px',
  className = '',
  loading = false,
  footer,
  children
}) {
  return (
    <div id={id} className={`chart-card ${className}`}>
      {(title || icon || controls) && (
        <div className="chart-header">
          <div className="chart-header-content">
            <div className="chart-title-row">
              {icon && (
                <div className="chart-icon">
                  {icon}
                </div>
              )}
              <div>
                <div className="chart-title">{title}</div>
                {subtitle && <div className="chart-subtitle">{subtitle}</div>}
              </div>
            </div>
          </div>
          {controls && (
            <div className="chart-controls">
              {controls}
            </div>
          )}
        </div>
      )}

      <div className={`chart-container ${getHeightClass(chartHeight)}`}>
        {loading ? (
          <ChartLoading />
        ) : children ? (
          children
        ) : (
          <canvas id={chartId} aria-label={title} />
        )}
      </div>

      {footer && <div className="chart-footer">{footer}</div>}
    </div>
  );
}

/**
 * Chart Controls Component
 * Time range buttons for charts
 */
export function ChartControls({
  ranges = ['30d', '90d', '180d'],
  activeRange = '90d',
  dataAttr = 'data-range',
  className = '',
  onRangeChange
}) {
  return (
    <div className={`chart-controls ${className}`}>
      {ranges.map(range => (
        <button
          key={range}
          className={`chart-control ${range === activeRange ? 'active' : ''}`}
          {...{ [dataAttr]: range }}
          onClick={() => onRangeChange?.(range)}
        >
          {range}
        </button>
      ))}
    </div>
  );
}

/**
 * Chart Loading State
 * Shows loading spinner while chart data loads
 */
export function ChartLoading() {
  return (
    <div className="chart-loading chart-loading--framed">
      <LoadingSpinner text="Loading chart..." size="md" />
    </div>
  );
}

/**
 * Chart Empty State
 * Shows when no data is available
 */
export function ChartEmpty({
  message = 'No data available for the selected period',
  icon
}) {
  const defaultIcon = (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
      />
    </svg>
  );

  return (
    <div className="chart-empty chart-empty--framed">
      <div className="chart-empty__icon chart-empty__icon--sm">
        {icon || defaultIcon}
      </div>
      <p className="chart-empty__message">{message}</p>
    </div>
  );
}

/**
 * Chart Legend Component
 * Legend for chart data
 */
export function ChartLegend({
  items = [],
  className = ''
}) {
  if (!items || items.length === 0) return null;

  return (
    <div className={`chart-legend ${className}`}>
      {items.map((item, index) => (
        <div key={index} className="chart-legend__item">
          {item.color && (
            <div
              className={`chart-legend__marker ${item.className || ''}`.trim()}
            />
          )}
          <span className="chart-legend__label">{item.label}</span>
          {item.value && (
            <span className="chart-legend__value">{item.value}</span>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Chart Insights Component
 * Key insights panel for charts
 */
export function ChartInsights({
  insights = [],
  className = ''
}) {
  if (!insights || insights.length === 0) return null;

  return (
    <div className={`chart-insights ${className}`}>
      <div className="chart-insights__title">Key Insights</div>
      <div className="chart-insights__list">
        {insights.map((insight, index) => (
          <div key={index} className="chart-insights__item">
            {insight.icon && (
              <div className="chart-insights__icon">{insight.icon}</div>
            )}
            <div className="chart-insights__content">
              {insight.label && (
                <div className="chart-insights__label">{insight.label}</div>
              )}
              <div className="chart-insights__value">{insight.value}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Chart Toolbar Component
 * Toolbar with actions for charts
 */
export function ChartToolbar({
  children,
  className = ''
}) {
  return (
    <div className={`chart-toolbar ${className}`}>
      {children}
    </div>
  );
}

/**
 * Chart Zoom Controls Component
 * Zoom in/out controls for charts
 */
export function ChartZoomControls({
  onZoomIn,
  onZoomOut,
  onReset,
  className = ''
}) {
  return (
    <div className={`chart-zoom-controls ${className}`}>
      <button onClick={onZoomIn} title="Zoom In">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7"/>
        </svg>
      </button>
      <button onClick={onZoomOut} title="Zoom Out">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM7 10h6"/>
        </svg>
      </button>
      <button onClick={onReset} title="Reset Zoom">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
        </svg>
      </button>
    </div>
  );
}

/**
 * Chart Container Component
 * Simple container for charts
 */
export function ChartContainer({
  height = '400px',
  children,
  className = ''
}) {
  return (
    <div className={`chart-container ${getHeightClass(height)} ${className}`.trim()}>
      {children}
    </div>
  );
}

/**
 * Chart Grid Component
 * Grid layout for multiple charts
 */
export function ChartGrid({
  columns = 2,
  children,
  className = ''
}) {
  const columnsClass = columns === 1 ? 'charts-grid--single' : columns === 3 ? 'charts-grid--triple' : '';
  return (
    <div className={`charts-grid ${columnsClass} ${className}`.trim()}>
      {children}
    </div>
  );
}

export default ChartCard;
