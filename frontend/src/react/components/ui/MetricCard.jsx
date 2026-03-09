import React from 'react';
import { motion } from 'framer-motion';

const ProgressBarSvg = ({ value, className = '', label }) => {
  const width = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <svg
      className={`progress-metric__svg ${className}`.trim()}
      viewBox="0 0 100 8"
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
    >
      <rect className="progress-metric__track-fill" x="0" y="0" width="100" height="8" rx="4" />
      <rect className="progress-metric__value-fill" x="0" y="0" width={width} height="8" rx="4" />
    </svg>
  );
};

/**
 * Metric Card Component
 * KPI display with icon and trend
 */
export function MetricCard({
  id,
  label,
  value = '—',
  subtitle,
  icon,
  variant = 'primary',
  trend,
  className = '',
  delay = 0
}) {
  return (
    <motion.div
      id={id}
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className={`metric-card glass-card ${className}`}
    >
      <div className="metric-header-row">
        {icon && (
          <div className={`metric-icon ${variant}`}>
            {icon}
          </div>
        )}
        <div className="metric-label">{label}</div>
      </div>
      <div className="metric-value">{value}</div>
      {subtitle && <div className="metric-subtitle">{subtitle}</div>}
      {trend && (
        <div className={`metric-card__trend metric-card__trend--${trend.direction}`}>
          {trend.direction === 'up' ? '↑' : '↓'} {trend.value}
        </div>
      )}
    </motion.div>
  );
}

/**
 * Metric Grid Component
 * Container for multiple metric cards
 */
export function MetricGrid({
  metrics = [],
  children,
  className = ''
}) {
  if (children) {
    return (
      <div className={`metrics-grid ${className}`}>
        {children}
      </div>
    );
  }

  if (!metrics || metrics.length === 0) {
    return <div className="metrics-grid"></div>;
  }

  return (
    <div className={`metrics-grid ${className}`}>
      {metrics.map((metric, index) => (
        <MetricCard key={index} {...metric} />
      ))}
    </div>
  );
}

/**
 * Simple Metric Display
 * Lightweight metric without full card styling
 */
export function SimpleMetric({
  label,
  value,
  icon,
  variant = 'primary'
}) {
  return (
    <div className={`simple-metric simple-metric--${variant}`}>
      {icon && (
        <div className="simple-metric__icon">
          {icon}
        </div>
      )}
      <div className="simple-metric__content">
        <div className="simple-metric__label">{label}</div>
        <div className="simple-metric__value">{value}</div>
      </div>
    </div>
  );
}

/**
 * Status Metric
 * Shows status with colored indicator
 */
export function StatusMetric({
  label,
  value,
  status = 'success',
  icon,
  className = ''
}) {
  const statusIcons = {
    success: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
      </svg>
    ),
    warning: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
      </svg>
    ),
    error: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
      </svg>
    ),
    info: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
    )
  };

  return (
    <div className={`status-metric status-metric--${status} ${className}`}>
      <div className="status-metric__indicator">
        {icon || statusIcons[status]}
      </div>
      <div className="status-metric__content">
        <div className="status-metric__label">{label}</div>
        <div className="status-metric__value">{value}</div>
      </div>
    </div>
  );
}

/**
 * Progress Metric
 * Shows progress with bar
 */
export function ProgressMetric({
  label,
  value = 0,
  max = 100,
  unit = '%',
  variant = 'primary',
  className = ''
}) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className={`progress-metric ${className}`}>
      <div className="progress-metric__header">
        <span className="progress-metric__label">{label}</span>
        <span className="progress-metric__value">{value}{unit}</span>
      </div>
      <div className="progress-metric__bar">
        <ProgressBarSvg
          value={percentage}
          className={`progress-metric__fill progress-metric__fill--${variant}`}
          label={`${label} progress`}
        />
      </div>
    </div>
  );
}

/**
 * Comparison Metric
 * Shows two values for comparison
 */
export function ComparisonMetric({
  label,
  current = 0,
  previous = 0,
  unit = '',
  className = ''
}) {
  const change = current - previous;
  const changePercent = previous !== 0 ? ((change / previous) * 100).toFixed(1) : 0;
  const direction = change >= 0 ? 'up' : 'down';

  return (
    <div className={`comparison-metric ${className}`}>
      <div className="comparison-metric__label">{label}</div>
      <div className="comparison-metric__values">
        <div className="comparison-metric__current">
          {current}{unit}
        </div>
        <div className={`comparison-metric__change comparison-metric__change--${direction}`}>
          {direction === 'up' ? '↑' : '↓'} {Math.abs(changePercent)}%
        </div>
      </div>
      <div className="comparison-metric__previous">
        Previously: {previous}{unit}
      </div>
    </div>
  );
}

/**
 * Mini Metric
 * Compact metric for dashboards
 */
export function MiniMetric({
  label,
  value,
  icon,
  variant = 'primary',
  className = ''
}) {
  return (
    <div className={`mini-metric mini-metric--${variant} ${className}`}>
      {icon && (
        <div className="mini-metric__icon">
          {icon}
        </div>
      )}
      <div className="mini-metric__content">
        <div className="mini-metric__value">{value}</div>
        <div className="mini-metric__label">{label}</div>
      </div>
    </div>
  );
}

export default MetricCard;
