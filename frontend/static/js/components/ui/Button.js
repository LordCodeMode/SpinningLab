// =========================
// BUTTON COMPONENT
// All button variants and styles
// =========================

/**
 * Button Component
 * 
 * @param {Object} options - Button configuration
 * @param {string} options.text - Button text
 * @param {string} options.variant - Button variant (primary|secondary|success|warning|danger|ghost|link)
 * @param {string} options.size - Button size (sm|md|lg)
 * @param {string} options.icon - SVG icon string
 * @param {string} options.iconPosition - Icon position (left|right)
 * @param {string} options.onClick - onclick attribute value
 * @param {string} options.type - button type (button|submit|reset)
 * @param {boolean} options.disabled - Disabled state
 * @param {boolean} options.loading - Loading state
 * @param {boolean} options.block - Full width
 * @param {string} options.customClass - Additional CSS classes
 * @param {string} options.id - Button ID
 */
export function Button({ 
    text = '', 
    variant = 'primary',
    size = 'md',
    icon = '',
    iconPosition = 'left',
    onClick = '',
    type = 'button',
    disabled = false,
    loading = false,
    block = false,
    customClass = '',
    id = ''
  }) {
    const blockClass = block ? 'btn--block' : '';
    const loadingClass = loading ? 'btn--loading' : '';
    const disabledAttr = disabled || loading ? 'disabled' : '';
    
    const iconHTML = icon ? `<span>${icon}</span>` : '';
    const textHTML = text ? `<span>${escapeHtml(text)}</span>` : '';
  
    const content = iconPosition === 'right' 
      ? `${textHTML}${iconHTML}`
      : `${iconHTML}${textHTML}`;
  
    return `
      <button 
        ${id ? `id="${id}"` : ''}
        class="btn btn--${variant} btn--${size} ${blockClass} ${loadingClass} ${customClass}"
        type="${type}"
        ${onClick ? `onclick="${onClick}"` : ''}
        ${disabledAttr}
      >
        ${content}
      </button>
    `;
  }
  
  /**
   * Button Group Component
   * Container for multiple buttons
   */
  export function ButtonGroup({ 
    buttons = [],
    attached = false,
    customClass = ''
  }) {
    const attachedClass = attached ? 'btn-group--attached' : '';
    
    return `
      <div class="btn-group ${attachedClass} ${customClass}">
        ${buttons.map(btn => typeof btn === 'string' ? btn : Button(btn)).join('')}
      </div>
    `;
  }
  
  /**
   * Icon Button Component
   * Button with only an icon
   */
  export function IconButton({
    icon = '',
    variant = 'secondary',
    size = 'md',
    title = '',
    onClick = '',
    disabled = false,
    customClass = '',
    id = ''
  }) {
    const disabledAttr = disabled ? 'disabled' : '';
  
    return `
      <button 
        ${id ? `id="${id}"` : ''}
        class="icon-btn icon-btn--${size} ${variant ? `icon-btn--${variant}` : ''} ${customClass}"
        ${title ? `title="${escapeHtml(title)}"` : ''}
        ${onClick ? `onclick="${onClick}"` : ''}
        ${disabledAttr}
      >
        ${icon}
      </button>
    `;
  }
  
  /**
   * Floating Action Button Component
   */
  export function FAB({
    icon = '',
    onClick = '',
    title = '',
    customClass = ''
  }) {
    const defaultIcon = `
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
      </svg>
    `;
  
    return `
      <button 
        class="fab ${customClass}"
        ${onClick ? `onclick="${onClick}"` : ''}
        ${title ? `title="${escapeHtml(title)}"` : ''}
      >
        ${icon || defaultIcon}
      </button>
    `;
  }
  
  /**
   * Link Button Component
   * Button styled as a link
   */
  export function LinkButton({
    text = '',
    href = '#',
    icon = '',
    customClass = ''
  }) {
    const iconHTML = icon ? `${icon} ` : '';
  
    return `
      <a href="${href}" class="btn btn--link ${customClass}">
        ${iconHTML}${escapeHtml(text)}
      </a>
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
  
  // Export all button components
  export default {
    Button,
    ButtonGroup,
    IconButton,
    FAB,
    LinkButton
  };