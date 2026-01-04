/**
 * Skeleton Loader Components
 * Reusable loading state components for better UX
 */

export const SkeletonLoader = {
  /**
   * Metric card skeleton (for overview stats)
   */
  metric() {
    return `
      <div class="skeleton--metric">
        <div class="skeleton__circle"></div>
        <div class="skeleton__lines">
          <div class="skeleton__line skeleton__line--long"></div>
          <div class="skeleton__line skeleton__line--short"></div>
        </div>
      </div>
    `;
  },

  /**
   * Chart skeleton (for graph containers)
   */
  chart() {
    return `
      <div class="skeleton--chart">
        <div class="skeleton__header"></div>
        <div class="skeleton__chart-area"></div>
      </div>
    `;
  },

  /**
   * Table skeleton (for activity lists)
   * @param {number} rows - Number of skeleton rows to show
   */
  table(rows = 5) {
    const tableRows = Array.from({ length: rows }, () => `
      <div class="skeleton-table__row">
        <div class="skeleton-table__cell"></div>
        <div class="skeleton-table__cell"></div>
        <div class="skeleton-table__cell"></div>
        <div class="skeleton-table__cell"></div>
      </div>
    `).join('');

    return `
      <div class="skeleton--table">
        ${tableRows}
      </div>
    `;
  },

  /**
   * Card skeleton (for generic cards)
   */
  card() {
    return `<div class="skeleton skeleton--card"></div>`;
  },

  /**
   * Text skeleton (for paragraphs)
   * @param {number} lines - Number of text lines
   */
  text(lines = 3) {
    const textLines = Array.from({ length: lines }, () =>
      `<div class="skeleton-text__line"></div>`
    ).join('');

    return `
      <div class="skeleton-text">
        ${textLines}
      </div>
    `;
  },

  /**
   * Spinner with message (for full-page loading)
   * @param {string} message - Loading message
   */
  spinner(message = 'Loading...') {
    return `
      <div class="loading">
        <div class="spinner"></div>
        <div class="loading__text">${message}</div>
      </div>
    `;
  },

  /**
   * Grid of metric skeletons (for overview page)
   * @param {number} count - Number of metrics
   */
  metricGrid(count = 4) {
    const metrics = Array.from({ length: count }, () => this.metric()).join('');
    return `<div class="metrics-grid">${metrics}</div>`;
  },

  /**
   * Grid of chart skeletons
   * @param {number} count - Number of charts
   */
  chartGrid(count = 2) {
    const charts = Array.from({ length: count }, () => this.chart()).join('');
    return `<div class="charts-container">${charts}</div>`;
  }
};

/**
 * Show loading state in a container
 * @param {HTMLElement|string} container - Container element or selector
 * @param {string} type - Type of skeleton ('metric', 'chart', 'table', 'card', 'spinner')
 * @param {Object} options - Additional options (rows for table, message for spinner, etc)
 */
export function showLoading(container, type = 'spinner', options = {}) {
  const element = typeof container === 'string'
    ? document.querySelector(container)
    : container;

  if (!element) return;

  const skeletonMap = {
    metric: () => SkeletonLoader.metric(),
    chart: () => SkeletonLoader.chart(),
    table: () => SkeletonLoader.table(options.rows),
    card: () => SkeletonLoader.card(),
    text: () => SkeletonLoader.text(options.lines),
    spinner: () => SkeletonLoader.spinner(options.message),
    metricGrid: () => SkeletonLoader.metricGrid(options.count),
    chartGrid: () => SkeletonLoader.chartGrid(options.count)
  };

  const html = skeletonMap[type] ? skeletonMap[type]() : SkeletonLoader.spinner();
  element.innerHTML = html;
  element.setAttribute('data-loading', 'true');
}

/**
 * Hide loading state and show content
 * @param {HTMLElement|string} container - Container element or selector
 * @param {string|Function} content - HTML string or function that returns HTML
 */
export function hideLoading(container, content = '') {
  const element = typeof container === 'string'
    ? document.querySelector(container)
    : container;

  if (!element) return;

  element.removeAttribute('data-loading');

  if (content) {
    const html = typeof content === 'function' ? content() : content;
    element.innerHTML = html;
  }
}

/**
 * Wrap async function with loading state
 * @param {HTMLElement|string} container - Container to show loading in
 * @param {Function} asyncFn - Async function to execute
 * @param {Object} loadingOptions - Options for loading state
 * @returns {Promise} Result of async function
 */
export async function withLoading(container, asyncFn, loadingOptions = {}) {
  const element = typeof container === 'string'
    ? document.querySelector(container)
    : container;

  if (!element) {
    return asyncFn();
  }

  try {
    showLoading(element, loadingOptions.type || 'spinner', loadingOptions);
    const result = await asyncFn();
    return result;
  } finally {
    hideLoading(element);
  }
}

export default SkeletonLoader;
