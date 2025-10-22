// =========================
// STATES COMPONENT
// Loading, Empty, and Error state components
// =========================

/**
 * Loading Skeleton Component
 * Animated loading placeholder
 * 
 * @param {Object} options - Skeleton configuration
 * @param {string} options.type - Skeleton type (card|metric|chart|table|text)
 * @param {number} options.count - Number of skeletons to render
 * @param {string} options.customClass - Additional CSS classes
 */
export function LoadingSkeleton({ 
    type = 'card', 
    count = 1,
    customClass = ''
  }) {
    const skeletons = {
      card: `
        <div class="skeleton skeleton--card ${customClass}"></div>
      `,
      
      metric: `
        <div class="skeleton skeleton--metric ${customClass}">
          <div class="skeleton__circle"></div>
          <div class="skeleton__lines">
            <div class="skeleton__line skeleton__line--short"></div>
            <div class="skeleton__line skeleton__line--long"></div>
          </div>
        </div>
      `,
      
      chart: `
        <div class="skeleton skeleton--chart ${customClass}">
          <div class="skeleton__header"></div>
          <div class="skeleton__chart-area"></div>
        </div>
      `,
      
      table: `
        <div class="skeleton skeleton--table ${customClass}">
          ${Array(5).fill(null).map(() => `
            <div class="skeleton-table__row">
              <div class="skeleton-table__cell"></div>
              <div class="skeleton-table__cell"></div>
              <div class="skeleton-table__cell"></div>
              <div class="skeleton-table__cell"></div>
            </div>
          `).join('')}
        </div>
      `,
      
      text: `
        <div class="skeleton-text ${customClass}">
          <div class="skeleton-text__line"></div>
          <div class="skeleton-text__line"></div>
          <div class="skeleton-text__line"></div>
          <div class="skeleton-text__line"></div>
        </div>
      `
    };
  
    const skeleton = skeletons[type] || skeletons.card;
    return Array(count).fill(skeleton).join('');
  }
  
  /**
   * Loading Spinner Component
   * Simple spinner with optional text
   */
  export function LoadingSpinner({ 
    text = 'Loading...', 
    size = 'md',
    customClass = ''
  }) {
    const sizes = {
      sm: '32px',
      md: '44px',
      lg: '64px'
    };
  
    return `
      <div class="loading ${customClass}">
        <div class="spinner" style="width: ${sizes[size]}; height: ${sizes[size]};"></div>
        ${text ? `<p class="loading__text">${escapeHtml(text)}</p>` : ''}
      </div>
    `;
  }
  
  /**
   * Empty State Component
   * Display when no data is available
   * 
   * @param {Object} options - Empty state configuration
   * @param {string} options.icon - SVG icon string
   * @param {string} options.title - Empty state title
   * @param {string} options.message - Empty state message
   * @param {string} options.action - HTML for action button
   * @param {string} options.customClass - Additional CSS classes
   */
  export function EmptyState({ 
    icon = '',
    title = 'No data available',
    message = '',
    action = '',
    customClass = ''
  }) {
    const defaultIcon = `
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
      </svg>
    `;
  
    return `
      <div class="empty-state ${customClass}">
        <div class="empty-state__icon">
          ${icon || defaultIcon}
        </div>
        <h3 class="empty-state__title">${escapeHtml(title)}</h3>
        ${message ? `<p class="empty-state__message">${escapeHtml(message)}</p>` : ''}
        ${action ? `
          <div class="empty-state__action" style="margin-top: var(--space-4);">
            ${action}
          </div>
        ` : ''}
      </div>
    `;
  }
  
  /**
   * Error State Component
   * Display when an error occurs
   * 
   * @param {Object} options - Error state configuration
   * @param {string} options.title - Error title
   * @param {string} options.message - Error message
   * @param {string} options.action - HTML for action button
   * @param {string} options.customClass - Additional CSS classes
   */
  export function ErrorState({ 
    title = 'Something went wrong',
    message = 'An error occurred while loading this content.',
    action = '',
    customClass = ''
  }) {
    const errorIcon = `
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
    `;
  
    return `
      <div class="error-state ${customClass}" style="text-align: center; padding: var(--space-10);">
        <div style="width: 64px; height: 64px; margin: 0 auto var(--space-4); color: var(--color-danger-500); opacity: 0.8;">
          ${errorIcon}
        </div>
        <h3 style="font-size: var(--font-size-xl); font-weight: var(--font-weight-bold); color: var(--color-text-primary); margin-bottom: var(--space-2);">
          ${escapeHtml(title)}
        </h3>
        ${message ? `
          <p style="font-size: var(--font-size-sm); color: var(--color-text-secondary); max-width: 400px; margin: 0 auto var(--space-4);">
            ${escapeHtml(message)}
          </p>
        ` : ''}
        ${action ? `
          <div style="margin-top: var(--space-4);">
            ${action}
          </div>
        ` : ''}
      </div>
    `;
  }
  
  /**
   * No Results State Component
   * Display when search/filter returns no results
   */
  export function NoResultsState({
    query = '',
    message = '',
    action = '',
    customClass = ''
  }) {
    const searchIcon = `
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
      </svg>
    `;
  
    const defaultMessage = query 
      ? `No results found for "${query}"`
      : 'No results found';
  
    return EmptyState({
      icon: searchIcon,
      title: defaultMessage,
      message: message || 'Try adjusting your search or filters',
      action,
      customClass
    });
  }
  
  /**
   * Success State Component
   * Display success message
   */
  export function SuccessState({
    title = 'Success!',
    message = '',
    action = '',
    customClass = ''
  }) {
    const successIcon = `
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
    `;
  
    return `
      <div class="success-state ${customClass}" style="text-align: center; padding: var(--space-10);">
        <div style="width: 64px; height: 64px; margin: 0 auto var(--space-4); color: var(--color-success-500);">
          ${successIcon}
        </div>
        <h3 style="font-size: var(--font-size-xl); font-weight: var(--font-weight-bold); color: var(--color-text-primary); margin-bottom: var(--space-2);">
          ${escapeHtml(title)}
        </h3>
        ${message ? `
          <p style="font-size: var(--font-size-sm); color: var(--color-text-secondary); max-width: 400px; margin: 0 auto;">
            ${escapeHtml(message)}
          </p>
        ` : ''}
        ${action ? `
          <div style="margin-top: var(--space-4);">
            ${action}
          </div>
        ` : ''}
      </div>
    `;
  }
  
  /**
   * Maintenance State Component
   * Display during maintenance
   */
  export function MaintenanceState({
    title = 'Under Maintenance',
    message = 'We\'re currently performing scheduled maintenance. Please check back soon.',
    customClass = ''
  }) {
    const maintenanceIcon = `
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
      </svg>
    `;
  
    return EmptyState({
      icon: maintenanceIcon,
      title,
      message,
      customClass
    });
  }
  
  /**
   * Offline State Component
   * Display when offline
   */
  export function OfflineState({
    title = 'You\'re offline',
    message = 'Please check your internet connection and try again.',
    action = '',
    customClass = ''
  }) {
    const offlineIcon = `
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
              d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"/>
      </svg>
    `;
  
    return ErrorState({
      title,
      message,
      action,
      customClass
    });
  }
  
  /**
   * Permission Denied State Component
   */
  export function PermissionDeniedState({
    title = 'Access Denied',
    message = 'You don\'t have permission to view this content.',
    action = '',
    customClass = ''
  }) {
    const lockIcon = `
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
      </svg>
    `;
  
    return ErrorState({
      title,
      message,
      action,
      customClass
    });
  }
  
  /**
   * Coming Soon State Component
   */
  export function ComingSoonState({
    title = 'Coming Soon',
    message = 'This feature is currently under development.',
    customClass = ''
  }) {
    const rocketIcon = `
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
              d="M13 10V3L4 14h7v7l9-11h-7z"/>
      </svg>
    `;
  
    return EmptyState({
      icon: rocketIcon,
      title,
      message,
      customClass
    });
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
  
  // Export all state components
  export default {
    LoadingSkeleton,
    LoadingSpinner,
    EmptyState,
    ErrorState,
    NoResultsState,
    SuccessState,
    MaintenanceState,
    OfflineState,
    PermissionDeniedState,
    ComingSoonState
  };