import React from 'react';

/**
 * Badge Component
 * Labels, tags, and status indicators
 */
export function Badge({
  text = '',
  children,
  variant = 'primary',
  style = 'default',
  size = 'md',
  icon,
  removable = false,
  onRemove,
  pulse = false,
  className = ''
}) {
  const styleClass = style !== 'default' ? `badge--${style}` : '';
  const pulseClass = pulse ? 'badge--pulse' : '';
  const removableClass = removable ? 'badge--removable' : '';

  return (
    <span className={`badge badge--${variant} badge--${size} ${styleClass} ${pulseClass} ${removableClass} ${className}`}>
      {icon}
      {children || text}
      {removable && (
        <button className="badge__remove" onClick={onRemove}>
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      )}
    </span>
  );
}

/**
 * Status Badge Component
 * Badge with predefined status styles
 */
export function StatusBadge({
  status = 'active',
  text,
  children,
  className = ''
}) {
  const displayText = children || text || status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <span className={`badge badge--status badge--status-${status} ${className}`}>
      {displayText}
    </span>
  );
}

/**
 * Notification Badge Component
 * Small badge for notification counts
 */
export function NotificationBadge({
  count = 0,
  max = 99,
  className = ''
}) {
  const displayCount = count > max ? `${max}+` : String(count);

  return (
    <span className={`badge badge--notification ${className}`}>
      {count > 0 ? displayCount : ''}
    </span>
  );
}

/**
 * Gradient Badge Component
 * Badge with gradient background
 */
export function GradientBadge({
  text = '',
  children,
  icon,
  className = ''
}) {
  return (
    <span className={`badge badge--gradient ${className}`}>
      {icon}
      {children || text}
    </span>
  );
}

/**
 * Badge Group Component
 * Container for multiple badges
 */
export function BadgeGroup({
  children,
  className = ''
}) {
  return (
    <div className={`badge-group ${className}`}>
      {children}
    </div>
  );
}

/**
 * Interactive Badge Component
 * Clickable badge
 */
export function InteractiveBadge({
  text = '',
  children,
  variant = 'primary',
  onClick,
  icon,
  className = ''
}) {
  return (
    <span
      className={`badge badge--${variant} badge--interactive ${className}`}
      onClick={onClick}
      role="button"
      tabIndex="0"
      onKeyPress={(e) => e.key === 'Enter' && onClick?.(e)}
    >
      {icon}
      {children || text}
    </span>
  );
}

export default Badge;
