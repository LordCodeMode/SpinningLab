// =========================
// INSIGHT CARD COMPONENT
// AI-powered insights and recommendations
// =========================

/**
 * Insight Card Component
 * Display AI-generated insights with icon and actions
 * 
 * @param {Object} options - Insight card configuration
 * @param {string} options.id - Card ID
 * @param {string} options.type - Insight type (info|success|warning|danger)
 * @param {string} options.icon - SVG icon string
 * @param {string} options.title - Insight title
 * @param {string} options.text - Insight description/text
 * @param {string} options.actions - HTML for action buttons (optional)
 * @param {Object} options.priority - Priority badge config {level: 1-3, show: boolean}
 * @param {string} options.customClass - Additional CSS classes
 */
export function InsightCard({
    id = '',
    type = 'info',
    icon = '',
    title = '',
    text = '',
    actions = '',
    priority = null,
    customClass = ''
  }) {
    const defaultIcons = {
      info: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
      success: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
      warning: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`,
      danger: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`
    };
  
    const iconToUse = icon || defaultIcons[type];
  
    const priorityHTML = priority && priority.show ? `
      <div class="insight-card__priority insight-card__priority--${priority.level}">
        Priority ${priority.level}
      </div>
    ` : '';
  
    return `
      <div class="insight-card insight-card--${type} ${customClass}" ${id ? `id="${id}"` : ''}>
        <div class="insight-card__icon">
          ${iconToUse}
        </div>
        <div class="insight-card__content">
          <div class="insight-card__header">
            ${title ? `<h4 class="insight-card__title">${escapeHtml(title)}</h4>` : ''}
            ${priorityHTML}
          </div>
          ${text ? `<p class="insight-card__text">${escapeHtml(text)}</p>` : ''}
          ${actions ? `
            <div class="insight-card__actions">
              ${actions}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }
  
  /**
   * Insight Grid Component
   * Container for multiple insights
   */
  export function InsightGrid({ 
    insights = [],
    columns = 1,
    customClass = ''
  }) {
    if (!insights || insights.length === 0) return '';
  
    const gridClass = columns === 2 ? 'insights-grid--two' : '';
  
    return `
      <div class="insights-grid ${gridClass} ${customClass}">
        ${insights.map(insight => InsightCard(insight)).join('')}
      </div>
    `;
  }
  
  /**
   * Insight Badge Component
   * Small inline insight indicator
   */
  export function InsightBadge({
    type = 'info',
    text = '',
    icon = '',
    customClass = ''
  }) {
    const defaultIcons = {
      info: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
      success: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>`,
      warning: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`,
      danger: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>`
    };
  
    const iconToUse = icon || defaultIcons[type];
  
    return `
      <div class="insight-badge insight-badge--${type} ${customClass}">
        <div class="insight-badge__icon">
          ${iconToUse}
        </div>
        <span>${escapeHtml(text)}</span>
      </div>
    `;
  }
  
  /**
   * Recommendation List Component
   * List of actionable recommendations
   */
  export function RecommendationList({
    title = 'Recommendations',
    recommendations = [],
    customClass = ''
  }) {
    if (!recommendations || recommendations.length === 0) return '';
  
    const checkIcon = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>`;
  
    return `
      <div class="recommendation-list ${customClass}">
        <div class="recommendation-list__title">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
          </svg>
          ${escapeHtml(title)}
        </div>
        ${recommendations.map(rec => `
          <div class="recommendation-item">
            <div class="recommendation-item__icon">
              ${rec.icon || checkIcon}
            </div>
            <div class="recommendation-item__content">
              ${rec.title ? `<div class="recommendation-item__title">${escapeHtml(rec.title)}</div>` : ''}
              <div class="recommendation-item__text">${escapeHtml(rec.text)}</div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }
  
  /**
   * Insight Panel Component
   * Full panel with header, body, footer
   */
  export function InsightPanel({
    id = '',
    title = '',
    icon = '',
    content = '',
    footer = '',
    actions = '',
    customClass = ''
  }) {
    const defaultIcon = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>`;
  
    return `
      <div class="insight-panel ${customClass}" ${id ? `id="${id}"` : ''}>
        ${title ? `
          <div class="insight-panel__header">
            <div class="insight-panel__title">
              ${icon || defaultIcon}
              ${escapeHtml(title)}
            </div>
            ${actions ? `<div>${actions}</div>` : ''}
          </div>
        ` : ''}
        
        <div class="insight-panel__body">
          ${content}
        </div>
        
        ${footer ? `
          <div class="insight-panel__footer">
            ${footer}
          </div>
        ` : ''}
      </div>
    `;
  }
  
  /**
   * Insight Metric Component
   * Metric display within insight context
   */
  export function InsightMetric({
    label = '',
    value = '',
    icon = '',
    variant = 'primary',
    customClass = ''
  }) {
    const variantColors = {
      primary: 'var(--color-primary-100)',
      success: 'var(--color-success-50)',
      warning: 'var(--color-warning-50)',
      danger: 'var(--color-danger-50)'
    };
  
    const bgColor = variantColors[variant] || variantColors.primary;
  
    return `
      <div class="insight-metric ${customClass}">
        ${icon ? `
          <div class="insight-metric__icon" style="background: ${bgColor};">
            ${icon}
          </div>
        ` : ''}
        <div class="insight-metric__content">
          <div class="insight-metric__label">${escapeHtml(label)}</div>
          <div class="insight-metric__value">${escapeHtml(String(value))}</div>
        </div>
      </div>
    `;
  }
  
  /**
   * Insight Timeline Component
   * Timeline of insights/events
   */
  export function InsightTimeline({
    items = [],
    customClass = ''
  }) {
    if (!items || items.length === 0) return '';
  
    return `
      <div class="insight-timeline ${customClass}">
        ${items.map(item => `
          <div class="insight-timeline__item">
            <div class="insight-timeline__time">${escapeHtml(item.time)}</div>
            <div class="insight-timeline__content">${escapeHtml(item.content)}</div>
          </div>
        `).join('')}
      </div>
    `;
  }
  
  /**
   * Insight Stats Component
   * Grid of statistics related to insights
   */
  export function InsightStats({
    stats = [],
    customClass = ''
  }) {
    if (!stats || stats.length === 0) return '';
  
    return `
      <div class="insight-stats ${customClass}">
        ${stats.map(stat => `
          <div class="insight-stat">
            <div class="insight-stat__value">${escapeHtml(String(stat.value))}</div>
            <div class="insight-stat__label">${escapeHtml(stat.label)}</div>
          </div>
        `).join('')}
      </div>
    `;
  }
  
  /**
   * Quick Insight Component
   * Compact one-liner insight
   */
  export function QuickInsight({ type = 'info', text = '', customClass = '' }) {
    const icons = {
      info: '💡',
      success: '✅',
      warning: '⚠️',
      danger: '❌'
    };
  
    return `
      <div class="quick-insight quick-insight--${type} ${customClass}" style="display: inline-flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-3); border-radius: var(--radius-md); font-size: var(--font-size-sm); background: var(--color-surface-soft); border: 1px solid var(--color-border);">
        <span>${icons[type]}</span>
        <span>${escapeHtml(text)}</span>
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
  
  // Export all insight components
  export default {
    InsightCard,
    InsightGrid,
    InsightBadge,
    RecommendationList,
    InsightPanel,
    InsightMetric,
    InsightTimeline,
    InsightStats,
    QuickInsight
  };