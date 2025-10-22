// =========================
// METRIC CARD COMPONENT
// Aligned with frontend design system from overview.js
// =========================

/**
 * Metric Card Component
 * Matches the exact styling from your overview.js implementation
 * 
 * @param {Object} options - Metric card configuration
 * @param {string} options.id - Card ID
 * @param {string} options.label - Metric label (e.g., "Fitness (CTL)")
 * @param {string|number} options.value - Metric value
 * @param {string} options.subtitle - Additional description
 * @param {string} options.icon - SVG icon string
 * @param {string} options.variant - Icon variant (primary|purple|green|amber|red)
 * @param {Object} options.trend - Trend indicator {value: '+5%', direction: 'up'|'down'}
 * @param {string} options.customClass - Additional CSS classes
 */
export function MetricCard({ 
  id = '',
  label = '', 
  value = '—', 
  subtitle = '', 
  icon = '',
  variant = 'primary',
  trend = null,
  customClass = ''
}) {
  const trendHTML = trend ? `
    <div class="metric-card__trend metric-card__trend--${trend.direction}">
      ${trend.direction === 'up' ? '↑' : '↓'} ${escapeHtml(trend.value)}
    </div>
  ` : '';

  return `
    <div class="metric-card ${customClass}" ${id ? `id="${id}"` : ''}>
      <div class="metric-header-row">
        ${icon ? `
          <div class="metric-icon ${variant}">
            ${icon}
          </div>
        ` : ''}
        <div class="metric-label">${escapeHtml(label)}</div>
      </div>
      <div class="metric-value">${escapeHtml(String(value))}</div>
      ${subtitle ? `<div class="metric-subtitle">${escapeHtml(subtitle)}</div>` : ''}
      ${trendHTML}
    </div>
  `;
}

/**
 * Metric Grid Component
 * Container for multiple metric cards
 * 
 * @param {Object} options - Grid configuration
 * @param {Array} options.metrics - Array of metric configurations
 * @param {string} options.customClass - Additional CSS classes
 */
export function MetricGrid({ metrics = [], customClass = '' }) {
  if (!metrics || metrics.length === 0) {
    return '<div class="metrics-grid"></div>';
  }

  return `
    <div class="metrics-grid ${customClass}">
      ${metrics.map(metric => MetricCard(metric)).join('')}
    </div>
  `;
}

/**
 * Simple Metric Display
 * Lightweight metric without full card styling
 */
export function SimpleMetric({ 
  label = '', 
  value = '', 
  icon = '', 
  variant = 'primary' 
}) {
  return `
    <div class="simple-metric simple-metric--${variant}">
      ${icon ? `
        <div class="simple-metric__icon">
          ${icon}
        </div>
      ` : ''}
      <div class="simple-metric__content">
        <div class="simple-metric__label">${escapeHtml(label)}</div>
        <div class="simple-metric__value">${escapeHtml(String(value))}</div>
      </div>
    </div>
  `;
}

/**
 * Status Metric
 * Shows status with colored indicator
 */
export function StatusMetric({
  label = '',
  value = '',
  status = 'success',
  icon = '',
  customClass = ''
}) {
  const statusIcons = {
    success: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>`,
    warning: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`,
    error: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>`,
    info: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`
  };

  return `
    <div class="status-metric status-metric--${status} ${customClass}">
      <div class="status-metric__indicator">
        ${icon || statusIcons[status]}
      </div>
      <div class="status-metric__content">
        <div class="status-metric__label">${escapeHtml(label)}</div>
        <div class="status-metric__value">${escapeHtml(String(value))}</div>
      </div>
    </div>
  `;
}

/**
 * Progress Metric
 * Shows progress with bar
 */
export function ProgressMetric({
  label = '',
  value = 0,
  max = 100,
  unit = '%',
  variant = 'primary',
  customClass = ''
}) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  return `
    <div class="progress-metric ${customClass}">
      <div class="progress-metric__header">
        <span class="progress-metric__label">${escapeHtml(label)}</span>
        <span class="progress-metric__value">${escapeHtml(String(value))}${unit}</span>
      </div>
      <div class="progress-metric__bar">
        <div class="progress-metric__fill progress-metric__fill--${variant}" 
             style="width: ${percentage}%;"></div>
      </div>
    </div>
  `;
}

/**
 * Comparison Metric
 * Shows two values for comparison
 */
export function ComparisonMetric({
  label = '',
  current = 0,
  previous = 0,
  unit = '',
  customClass = ''
}) {
  const change = current - previous;
  const changePercent = previous !== 0 ? ((change / previous) * 100).toFixed(1) : 0;
  const direction = change >= 0 ? 'up' : 'down';

  return `
    <div class="comparison-metric ${customClass}">
      <div class="comparison-metric__label">${escapeHtml(label)}</div>
      <div class="comparison-metric__values">
        <div class="comparison-metric__current">
          ${escapeHtml(String(current))}${unit}
        </div>
        <div class="comparison-metric__change comparison-metric__change--${direction}">
          ${direction === 'up' ? '↑' : '↓'} ${Math.abs(changePercent)}%
        </div>
      </div>
      <div class="comparison-metric__previous">
        Previously: ${escapeHtml(String(previous))}${unit}
      </div>
    </div>
  `;
}

/**
 * Mini Metric
 * Compact metric for dashboards
 */
export function MiniMetric({
  label = '',
  value = '',
  icon = '',
  variant = 'primary',
  customClass = ''
}) {
  return `
    <div class="mini-metric mini-metric--${variant} ${customClass}">
      ${icon ? `
        <div class="mini-metric__icon">
          ${icon}
        </div>
      ` : ''}
      <div class="mini-metric__content">
        <div class="mini-metric__value">${escapeHtml(String(value))}</div>
        <div class="mini-metric__label">${escapeHtml(label)}</div>
      </div>
    </div>
  `;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, s => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[s]));
}

// Export all metric components
export default {
  MetricCard,
  MetricGrid,
  SimpleMetric,
  StatusMetric,
  ProgressMetric,
  ComparisonMetric,
  MiniMetric
};