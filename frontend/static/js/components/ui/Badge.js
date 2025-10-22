// =========================
// BADGE COMPONENT
// Labels, tags, and status indicators
// =========================

/**
 * Badge Component
 * 
 * @param {Object} options - Badge configuration
 * @param {string} options.text - Badge text
 * @param {string} options.variant - Badge variant (primary|success|warning|danger|info|neutral)
 * @param {string} options.style - Badge style (default|solid|outline|dot)
 * @param {string} options.size - Badge size (sm|md|lg)
 * @param {string} options.icon - SVG icon string
 * @param {boolean} options.removable - Show remove button
 * @param {string} options.onRemove - onclick for remove button
 * @param {boolean} options.pulse - Pulse animation
 * @param {string} options.customClass - Additional CSS classes
 */
export function Badge({ 
    text = '', 
    variant = 'primary',
    style = 'default',
    size = 'md',
    icon = '',
    removable = false,
    onRemove = '',
    pulse = false,
    customClass = ''
  }) {
    const styleClass = style !== 'default' ? `badge--${style}` : '';
    const pulseClass = pulse ? 'badge--pulse' : '';
    const removableClass = removable ? 'badge--removable' : '';
  
    const iconHTML = icon ? `${icon}` : '';
    const removeHTML = removable ? `
      <button class="badge__remove" ${onRemove ? `onclick="${onRemove}"` : ''}>
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    ` : '';
  
    return `
      <span class="badge badge--${variant} badge--${size} ${styleClass} ${pulseClass} ${removableClass} ${customClass}">
        ${iconHTML}
        ${text ? escapeHtml(text) : ''}
        ${removeHTML}
      </span>
    `;
  }
  
  /**
   * Status Badge Component
   * Badge with predefined status styles
   */
  export function StatusBadge({
    status = 'active', // active | inactive | pending | error
    text = '',
    customClass = ''
  }) {
    const statusText = text || status.charAt(0).toUpperCase() + status.slice(1);
  
    return `
      <span class="badge badge--status badge--status-${status} ${customClass}">
        ${escapeHtml(statusText)}
      </span>
    `;
  }
  
  /**
   * Notification Badge Component
   * Small badge for notification counts
   */
  export function NotificationBadge({
    count = 0,
    max = 99,
    customClass = ''
  }) {
    const displayCount = count > max ? `${max}+` : String(count);
  
    return `
      <span class="badge badge--notification ${customClass}">
        ${count > 0 ? escapeHtml(displayCount) : ''}
      </span>
    `;
  }
  
  /**
   * Gradient Badge Component
   * Badge with gradient background
   */
  export function GradientBadge({
    text = '',
    icon = '',
    customClass = ''
  }) {
    const iconHTML = icon ? `${icon} ` : '';
  
    return `
      <span class="badge badge--gradient ${customClass}">
        ${iconHTML}${escapeHtml(text)}
      </span>
    `;
  }
  
  /**
   * Badge Group Component
   * Container for multiple badges
   */
  export function BadgeGroup({
    badges = [],
    customClass = ''
  }) {
    return `
      <div class="badge-group ${customClass}">
        ${badges.map(badge => typeof badge === 'string' ? badge : Badge(badge)).join('')}
      </div>
    `;
  }
  
  /**
   * Interactive Badge Component
   * Clickable badge
   */
  export function InteractiveBadge({
    text = '',
    variant = 'primary',
    onClick = '',
    icon = '',
    customClass = ''
  }) {
    const iconHTML = icon ? `${icon} ` : '';
  
    return `
      <span 
        class="badge badge--${variant} badge--interactive ${customClass}"
        ${onClick ? `onclick="${onClick}"` : ''}
        role="button"
        tabindex="0"
      >
        ${iconHTML}${escapeHtml(text)}
      </span>
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
  
  // Export all badge components
  export default {
    Badge,
    StatusBadge,
    NotificationBadge,
    GradientBadge,
    BadgeGroup,
    InteractiveBadge
  };