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
    container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 10px;
      pointer-events: none;
    `;
    document.body.appendChild(container);
  }

  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.style.cssText = `
    min-width: 300px;
    max-width: 500px;
    padding: 16px 20px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    display: flex;
    align-items: center;
    gap: 12px;
    pointer-events: auto;
    animation: slideIn 0.3s ease-out;
    border-left: 4px solid ${getTypeColor(type)};
  `;

  // Get icon for notification type
  const icon = getTypeIcon(type);

  notification.innerHTML = `
    <div style="flex-shrink: 0; color: ${getTypeColor(type)};">
      ${icon}
    </div>
    <div style="flex: 1; color: #374151; font-size: 14px; line-height: 1.5;">
      ${message}
    </div>
    <button onclick="this.parentElement.remove()" style="
      flex-shrink: 0;
      background: none;
      border: none;
      cursor: pointer;
      padding: 4px;
      color: #9CA3AF;
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
      </svg>
    </button>
  `;

  // Add animation styles if not already present
  if (!document.getElementById('notification-styles')) {
    const style = document.createElement('style');
    style.id = 'notification-styles';
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      @keyframes slideOut {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(400px);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }

  container.appendChild(notification);

  // Auto-remove after duration
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-in';
    setTimeout(() => notification.remove(), 300);
  }, duration);

  console.log(`[Notification] ${type.toUpperCase()}: ${message}`);
}

/**
 * Get color based on notification type
 */
function getTypeColor(type) {
  const colors = {
    success: '#10B981',
    error: '#EF4444',
    warning: '#F59E0B',
    info: '#3B82F6'
  };
  return colors[type] || colors.info;
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
