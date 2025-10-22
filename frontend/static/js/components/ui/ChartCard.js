// =========================
// CHART CARD COMPONENT
// Aligned with frontend design system from overview.js
// =========================

/**
 * Chart Card Component
 * Matches the exact styling from your overview.js implementation
 * 
 * @param {Object} options - Chart card configuration
 * @param {string} options.id - Card ID
 * @param {string} options.title - Chart title
 * @param {string} options.subtitle - Chart subtitle/description
 * @param {string} options.icon - SVG icon string
 * @param {string} options.controls - HTML for chart controls (buttons, selects)
 * @param {string} options.chartId - ID for the canvas/chart element
 * @param {string} options.chartHeight - Height of chart container (default: 400px)
 * @param {string} options.customClass - Additional CSS classes
 * @param {boolean} options.loading - Show loading state
 * @param {string} options.footer - Footer content (optional)
 */
export function ChartCard({
  id = '',
  title = '',
  subtitle = '',
  icon = '',
  controls = '',
  chartId = 'chart',
  chartHeight = '400px',
  customClass = '',
  loading = false,
  footer = ''
}) {
  return `
    <div class="chart-card ${customClass}" ${id ? `id="${id}"` : ''}>
      ${title || icon || controls ? `
        <div class="chart-header">
          <div class="chart-header-content">
            <div class="chart-title-row">
              ${icon ? `
                <div class="chart-icon">
                  ${icon}
                </div>
              ` : ''}
              <div>
                <div class="chart-title">${escapeHtml(title)}</div>
                ${subtitle ? `<div class="chart-subtitle">${escapeHtml(subtitle)}</div>` : ''}
              </div>
            </div>
          </div>
          ${controls ? `
            <div class="chart-controls">
              ${controls}
            </div>
          ` : ''}
        </div>
      ` : ''}
      
      <div class="chart-container" style="height: ${chartHeight};">
        ${loading ? ChartLoading() : `<canvas id="${chartId}" aria-label="${escapeHtml(title)}"></canvas>`}
      </div>
      
      ${footer ? `<div class="chart-footer">${footer}</div>` : ''}
    </div>
  `;
}

/**
* Chart Controls Component
* Time range buttons matching overview.js style
* 
* @param {Object} options - Controls configuration
* @param {Array} options.ranges - Array of range values (e.g., ['30d', '90d', '180d'])
* @param {string} options.activeRange - Currently active range
* @param {string} options.dataAttr - Data attribute name for button (default: 'data-range')
* @param {string} options.customClass - Additional CSS classes
*/
export function ChartControls({ 
  ranges = ['30d', '90d', '180d'], 
  activeRange = '90d',
  dataAttr = 'data-range',
  customClass = ''
}) {
  return `
    <div class="chart-controls ${customClass}">
      ${ranges.map(range => `
        <button class="chart-control ${range === activeRange ? 'active' : ''}" 
                ${dataAttr}="${range}">
          ${escapeHtml(String(range))}
        </button>
      `).join('')}
    </div>
  `;
}

/**
* Chart Loading State
* Shows loading spinner while chart data loads
*/
export function ChartLoading() {
return `
  <div class="chart-loading">
    <div class="chart-loading__spinner"></div>
    <p style="margin-top: 16px; color: var(--color-text-secondary);">Loading chart data...</p>
  </div>
`;
}

/**
* Chart Empty State
* Shows when no chart data is available
*/
export function ChartEmpty({ 
  title = 'No Data Available',
  message = 'There is no data to display for the selected time period.',
  icon = '',
  action = ''
}) {
  const defaultIcon = `
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
    </svg>
  `;

  return `
    <div class="chart-empty">
      <div class="chart-empty__icon">
        ${icon || defaultIcon}
      </div>
      <h3 class="chart-empty__title">${escapeHtml(title)}</h3>
      <p class="chart-empty__message">${escapeHtml(message)}</p>
      ${action ? `<div class="chart-empty__action">${action}</div>` : ''}
    </div>
  `;
}

/**
* Chart Legend Component
* Custom legend for charts
*/
export function ChartLegend({ 
  items = [],
  customClass = ''
}) {
  if (!items || items.length === 0) return '';

  return `
    <div class="chart-legend ${customClass}">
      ${items.map(item => `
        <div class="chart-legend__item">
          <div class="chart-legend__color" style="background-color: ${item.color};"></div>
          <span class="chart-legend__label">${escapeHtml(item.label)}</span>
        </div>
      `).join('')}
    </div>
  `;
}

/**
* Chart Insights Panel
* Display key insights below chart
*/
export function ChartInsights({
  title = 'Key Insights',
  insights = [],
  customClass = ''
}) {
  if (!insights || insights.length === 0) return '';

  return `
    <div class="chart-insights ${customClass}">
      <div class="chart-insights__title">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
        </svg>
        ${escapeHtml(title)}
      </div>
      <div class="chart-insights__list">
        ${insights.map(insight => `
          <div class="chart-insights__item">${escapeHtml(insight)}</div>
        `).join('')}
      </div>
    </div>
  `;
}

/**
* Chart Toolbar
* Top toolbar with actions
*/
export function ChartToolbar({
  leftContent = '',
  rightContent = '',
  customClass = ''
}) {
  return `
    <div class="chart-toolbar ${customClass}">
      <div class="chart-toolbar__left">
        ${leftContent}
      </div>
      <div class="chart-toolbar__right">
        ${rightContent}
      </div>
    </div>
  `;
}

/**
* Chart Zoom Controls
* Zoom in/out buttons overlay
*/
export function ChartZoomControls({
  onZoomIn = 'handleZoomIn',
  onZoomOut = 'handleZoomOut',
  onReset = 'handleZoomReset',
  customClass = ''
}) {
  return `
    <div class="chart-zoom ${customClass}">
      <button class="chart-zoom__btn" onclick="${onZoomIn}()" title="Zoom In">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
        </svg>
      </button>
      <button class="chart-zoom__btn" onclick="${onZoomOut}()" title="Zoom Out">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"/>
        </svg>
      </button>
      <button class="chart-zoom__btn" onclick="${onReset}()" title="Reset Zoom">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
        </svg>
      </button>
    </div>
  `;
}

/**
* Chart Container
* Simple container for canvas element
*/
export function ChartContainer({
  chartId = 'chart',
  height = '400px',
  ariaLabel = 'Chart',
  customClass = ''
}) {
  return `
    <div class="chart-container ${customClass}" style="height: ${height};">
      <canvas id="${chartId}" aria-label="${escapeHtml(ariaLabel)}"></canvas>
    </div>
  `;
}

/**
* Chart Grid
* Grid layout for multiple charts
*/
export function ChartGrid({
  charts = [],
  columns = 2,
  customClass = ''
}) {
  const gridClass = columns === 1 ? 'charts-grid--single' : 
                     columns === 3 ? 'charts-grid--triple' : '';

  return `
    <div class="charts-grid ${gridClass} ${customClass}">
      ${charts.join('')}
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

// Export all chart components
export default {
ChartCard,
ChartControls,
ChartLoading,
ChartEmpty,
ChartLegend,
ChartInsights,
ChartToolbar,
ChartZoomControls,
ChartContainer,
ChartGrid
};