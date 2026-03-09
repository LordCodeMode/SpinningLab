// ============================================
// FILE: static/js/utils/notifications.js
// Global notification system
// ============================================

/**
 * Show a notification to the user
 * @param {string} message - The message to display
 * @param {string} type - The type of notification: 'success', 'error', 'warning', 'info'
 * @param {number} duration - Duration in ms (default 4000)
 */
export function notify(message, type = 'info', duration = 4000) {
  // Create notification container if it doesn't exist
  let container = document.getElementById('notification-container');

  if (!container) {
    container = document.createElement('div');
    container.id = 'notification-container';
    container.className = 'notification-container';
    document.body.appendChild(container);
  }

  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification notification--toast notification-${type} show`;

  // Get icon for notification type
  const icon = getTypeIcon(type);

  notification.innerHTML = `
    <div class="notification-icon notification-icon--${type}">
      ${icon}
    </div>
    <div class="notification-message">
      ${message}
    </div>
    <button class="notification-close" type="button" aria-label="Close notification">
      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
      </svg>
    </button>
  `;

  const closeButton = notification.querySelector('.notification-close');
  closeButton?.addEventListener('click', () => notification.remove());

  container.appendChild(notification);

  // Auto-remove after duration
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, duration);

  console.log(`[Notification] ${type.toUpperCase()}: ${message}`);
}

/**
 * Get icon SVG based on notification type
 */
function getTypeIcon(type) {
  const icons = {
    success: `
      <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
    `,
    error: `
      <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
    `,
    warning: `
      <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
      </svg>
    `,
    info: `
      <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
    `
  };
  return icons[type] || icons.info;
}

// Export for use in other modules
export default notify;
