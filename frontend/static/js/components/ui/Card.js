// =========================
// CARD COMPONENT
// Aligned with frontend design system
// =========================

/**
 * Base Card Component
 * Standard card with header, body, and optional footer
 * 
 * @param {Object} options - Card configuration
 * @param {string} options.id - Card ID
 * @param {string} options.title - Card title
 * @param {string} options.subtitle - Card subtitle (optional)
 * @param {string} options.icon - SVG icon string (optional)
 * @param {string} options.content - Card body content
 * @param {string} options.footer - Card footer content (optional)
 * @param {boolean} options.clickable - Make card clickable
 * @param {string} options.customClass - Additional CSS classes
 * @param {boolean} options.noHover - Disable hover effect
 */
export function Card({ 
  id = '', 
  title = '', 
  subtitle = '', 
  icon = '', 
  content = '', 
  footer = '',
  clickable = false,
  noHover = false,
  customClass = '' 
}) {
  const clickableClass = clickable ? 'card--clickable' : '';
  const noHoverClass = noHover ? 'card--no-hover' : '';
  
  return `
    <div class="card ${clickableClass} ${noHoverClass} ${customClass}" ${id ? `id="${id}"` : ''}>
      ${title || icon ? `
        <div class="card__header">
          ${icon ? `<div class="card__icon">${icon}</div>` : ''}
          <div>
            ${title ? `<h3 class="card__title">${escapeHtml(title)}</h3>` : ''}
            ${subtitle ? `<p class="card__subtitle">${escapeHtml(subtitle)}</p>` : ''}
          </div>
        </div>
      ` : ''}
      
      <div class="card__body">
        ${content}
      </div>
      
      ${footer ? `
        <div class="card__footer">
          ${footer}
        </div>
      ` : ''}
    </div>
  `;
}

/**
* Card Header Component (for manual composition)
*/
export function CardHeader({ title = '', subtitle = '', icon = '', actions = '' }) {
return `
  <div class="card__header">
    ${icon ? `<div class="card__icon">${icon}</div>` : ''}
    <div style="flex: 1;">
      ${title ? `<h3 class="card__title">${escapeHtml(title)}</h3>` : ''}
      ${subtitle ? `<p class="card__subtitle">${escapeHtml(subtitle)}</p>` : ''}
    </div>
    ${actions ? `<div class="card__actions">${actions}</div>` : ''}
  </div>
`;
}

/**
* Card Body Component (for manual composition)
*/
export function CardBody({ content = '', customClass = '' }) {
return `
  <div class="card__body ${customClass}">
    ${content}
  </div>
`;
}

/**
* Card Footer Component (for manual composition)
*/
export function CardFooter({ content = '', customClass = '' }) {
return `
  <div class="card__footer ${customClass}">
    ${content}
  </div>
`;
}

/**
* Activities Card Component
* Specialized card for displaying activities list
* Matches overview.js styling exactly
*/
export function ActivitiesCard({ 
id = '',
title = 'Recent Activities',
icon = '',
content = '',
customClass = '' 
}) {
const defaultIcon = `
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
  </svg>
`;

return `
  <div class="activities-card ${customClass}" ${id ? `id="${id}"` : ''}>
    <div class="activities-card-header">
      <div class="activities-card-icon">
        ${icon || defaultIcon}
      </div>
      <div>
        <div class="activities-card-title">${escapeHtml(title)}</div>
      </div>
    </div>
    ${content}
  </div>
`;
}

/**
* Analysis Card Component
* Specialized card for analysis/stats displays
*/
export function AnalysisCard({
id = '',
title = '',
subtitle = '',
icon = '',
content = '',
stats = [],
customClass = ''
}) {
const statsHTML = stats.length > 0 ? `
  <div class="analysis-stats">
    ${stats.map(stat => `
      <div class="analysis-stat">
        <div class="analysis-stat__value">${escapeHtml(stat.value)}</div>
        <div class="analysis-stat__label">${escapeHtml(stat.label)}</div>
      </div>
    `).join('')}
  </div>
` : '';

return `
  <div class="card ${customClass}" ${id ? `id="${id}"` : ''}>
    ${title ? `
      <div class="card__header">
        ${icon ? `<div class="card__icon">${icon}</div>` : ''}
        <div>
          <h3 class="card__title">${escapeHtml(title)}</h3>
          ${subtitle ? `<p class="card__subtitle">${escapeHtml(subtitle)}</p>` : ''}
        </div>
      </div>
    ` : ''}
    <div class="card__body">
      ${content}
      ${statsHTML}
    </div>
  </div>
`;
}

/**
* Compact Card Component
* Smaller card for dashboard widgets
*/
export function CompactCard({
id = '',
title = '',
value = '',
icon = '',
trend = null,
customClass = ''
}) {
const trendHTML = trend ? `
  <div class="compact-card__trend compact-card__trend--${trend.direction}">
    ${trend.direction === 'up' ? '↑' : '↓'} ${escapeHtml(trend.value)}
  </div>
` : '';

return `
  <div class="card compact-card ${customClass}" ${id ? `id="${id}"` : ''}>
    <div class="card__body" style="display: flex; align-items: center; gap: var(--space-3);">
      ${icon ? `
        <div class="card__icon" style="flex-shrink: 0;">
          ${icon}
        </div>
      ` : ''}
      <div style="flex: 1;">
        <div style="font-size: var(--font-size-xs); color: var(--color-text-secondary); font-weight: var(--font-weight-semibold); text-transform: uppercase; letter-spacing: 0.5px;">
          ${escapeHtml(title)}
        </div>
        <div style="font-size: var(--font-size-2xl); font-weight: var(--font-weight-extrabold); color: var(--color-text-primary); margin-top: var(--space-1);">
          ${escapeHtml(value)}
        </div>
        ${trendHTML}
      </div>
    </div>
  </div>
`;
}

/**
* Info Card Component
* Card with icon and description
*/
export function InfoCard({
id = '',
title = '',
description = '',
icon = '',
variant = 'info',
action = '',
customClass = ''
}) {
return `
  <div class="info-card info-card--${variant} ${customClass}" ${id ? `id="${id}"` : ''}>
    ${icon ? `
      <div class="info-card__icon">
        ${icon}
      </div>
    ` : ''}
    <div class="info-card__content">
      ${title ? `<h4 class="info-card__title">${escapeHtml(title)}</h4>` : ''}
      ${description ? `<p class="info-card__description">${escapeHtml(description)}</p>` : ''}
      ${action ? `<div class="info-card__action">${action}</div>` : ''}
    </div>
  </div>
`;
}

/**
* Feature Card Component
* Highlighted card for features or callouts
*/
export function FeatureCard({
id = '',
title = '',
description = '',
icon = '',
badge = '',
action = '',
customClass = ''
}) {
return `
  <div class="feature-card ${customClass}" ${id ? `id="${id}"` : ''}>
    <div class="feature-card__header">
      ${icon ? `
        <div class="feature-card__icon">
          ${icon}
        </div>
      ` : ''}
      ${badge ? `<div class="feature-card__badge">${badge}</div>` : ''}
    </div>
    <div class="feature-card__content">
      ${title ? `<h3 class="feature-card__title">${escapeHtml(title)}</h3>` : ''}
      ${description ? `<p class="feature-card__description">${escapeHtml(description)}</p>` : ''}
    </div>
    ${action ? `
      <div class="feature-card__action">
        ${action}
      </div>
    ` : ''}
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

// Export all card components
export default {
Card,
CardHeader,
CardBody,
CardFooter,
ActivitiesCard,
AnalysisCard,
CompactCard,
InfoCard,
FeatureCard
};