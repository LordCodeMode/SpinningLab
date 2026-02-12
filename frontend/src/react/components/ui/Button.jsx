import React from 'react';

/**
 * Button Component
 * Primary action button with variants and states
 */
export function Button({
  text = '',
  children,
  variant = 'primary',
  size = 'md',
  icon = null,
  iconPosition = 'left',
  onClick,
  type = 'button',
  disabled = false,
  loading = false,
  block = false,
  className = '',
  id = '',
  ...props
}) {
  const blockClass = block ? 'btn--block' : '';
  const loadingClass = loading ? 'btn--loading' : '';

  const content = children || text;

  return (
    <button
      id={id || undefined}
      className={`btn btn--${variant} btn--${size} ${blockClass} ${loadingClass} ${className}`}
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      {...props}
    >
      {iconPosition === 'left' && icon && <span>{icon}</span>}
      {content && <span>{content}</span>}
      {iconPosition === 'right' && icon && <span>{icon}</span>}
    </button>
  );
}

/**
 * Button Group Component
 * Container for multiple buttons
 */
export function ButtonGroup({
  children,
  attached = false,
  className = ''
}) {
  const attachedClass = attached ? 'btn-group--attached' : '';

  return (
    <div className={`btn-group ${attachedClass} ${className}`}>
      {children}
    </div>
  );
}

/**
 * Icon Button Component
 * Button with only an icon
 */
export function IconButton({
  icon,
  children,
  variant = 'secondary',
  size = 'md',
  title = '',
  onClick,
  disabled = false,
  className = '',
  id = '',
  ...props
}) {
  return (
    <button
      id={id || undefined}
      className={`icon-btn icon-btn--${size} ${variant ? `icon-btn--${variant}` : ''} ${className}`}
      title={title}
      onClick={onClick}
      disabled={disabled}
      {...props}
    >
      {icon || children}
    </button>
  );
}

/**
 * Floating Action Button Component
 */
export function FAB({
  icon,
  children,
  onClick,
  title = '',
  className = ''
}) {
  const defaultIcon = (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/>
    </svg>
  );

  return (
    <button
      className={`fab ${className}`}
      onClick={onClick}
      title={title}
    >
      {icon || children || defaultIcon}
    </button>
  );
}

/**
 * Link Button Component
 * Button styled as a link
 */
export function LinkButton({
  text = '',
  children,
  href = '#',
  icon,
  className = '',
  onClick
}) {
  return (
    <a
      href={href}
      className={`btn btn--link ${className}`}
      onClick={onClick}
    >
      {icon && <span>{icon}</span>}
      {children || text}
    </a>
  );
}

export default Button;
