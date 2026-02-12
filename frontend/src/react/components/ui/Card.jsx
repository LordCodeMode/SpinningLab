import React from 'react';

/**
 * Base Card Component
 * Standard card with header, body, and optional footer
 */
export function Card({
  id,
  title,
  subtitle,
  icon,
  children,
  footer,
  clickable = false,
  noHover = false,
  className = '',
  onClick
}) {
  const clickableClass = clickable ? 'card--clickable' : '';
  const noHoverClass = noHover ? 'card--no-hover' : '';

  return (
    <div
      id={id}
      className={`card ${clickableClass} ${noHoverClass} ${className}`}
      onClick={onClick}
    >
      {(title || icon) && (
        <div className="card__header">
          {icon && <div className="card__icon">{icon}</div>}
          <div>
            {title && <h3 className="card__title">{title}</h3>}
            {subtitle && <p className="card__subtitle">{subtitle}</p>}
          </div>
        </div>
      )}

      <div className="card__body">
        {children}
      </div>

      {footer && (
        <div className="card__footer">
          {footer}
        </div>
      )}
    </div>
  );
}

/**
 * Card Header Component (for manual composition)
 */
export function CardHeader({
  title,
  subtitle,
  icon,
  actions,
  children
}) {
  return (
    <div className="card__header">
      {icon && <div className="card__icon">{icon}</div>}
      <div style={{ flex: 1 }}>
        {title && <h3 className="card__title">{title}</h3>}
        {subtitle && <p className="card__subtitle">{subtitle}</p>}
        {children}
      </div>
      {actions && <div className="card__actions">{actions}</div>}
    </div>
  );
}

/**
 * Card Body Component (for manual composition)
 */
export function CardBody({
  children,
  className = ''
}) {
  return (
    <div className={`card__body ${className}`}>
      {children}
    </div>
  );
}

/**
 * Card Footer Component (for manual composition)
 */
export function CardFooter({
  children,
  className = ''
}) {
  return (
    <div className={`card__footer ${className}`}>
      {children}
    </div>
  );
}

/**
 * Activities Card Component
 * Specialized card for displaying activities list
 */
export function ActivitiesCard({
  id,
  title = 'Recent Activities',
  icon,
  children,
  className = ''
}) {
  const defaultIcon = (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
      />
    </svg>
  );

  return (
    <div id={id} className={`activities-card ${className}`}>
      <div className="activities-card-header">
        <div className="activities-card-icon">
          {icon || defaultIcon}
        </div>
        <div>
          <div className="activities-card-title">{title}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

/**
 * Analysis Card Component
 * Specialized card for analysis/stats displays
 */
export function AnalysisCard({
  id,
  title,
  subtitle,
  icon,
  children,
  stats = [],
  className = ''
}) {
  return (
    <div id={id} className={`card ${className}`}>
      {title && (
        <div className="card__header">
          {icon && <div className="card__icon">{icon}</div>}
          <div>
            <h3 className="card__title">{title}</h3>
            {subtitle && <p className="card__subtitle">{subtitle}</p>}
          </div>
        </div>
      )}
      <div className="card__body">
        {children}
        {stats.length > 0 && (
          <div className="analysis-stats">
            {stats.map((stat, index) => (
              <div key={index} className="analysis-stat">
                <div className="analysis-stat__value">{stat.value}</div>
                <div className="analysis-stat__label">{stat.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Compact Card Component
 * Smaller card for dashboard widgets
 */
export function CompactCard({
  id,
  title,
  value,
  icon,
  trend,
  className = ''
}) {
  return (
    <div id={id} className={`card compact-card ${className}`}>
      <div className="card__body" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        {icon && (
          <div className="card__icon" style={{ flexShrink: 0 }}>
            {icon}
          </div>
        )}
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-secondary)',
            fontWeight: 'var(--font-weight-semibold)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            {title}
          </div>
          <div style={{
            fontSize: 'var(--font-size-2xl)',
            fontWeight: 'var(--font-weight-extrabold)',
            color: 'var(--color-text-primary)',
            marginTop: 'var(--space-1)'
          }}>
            {value}
          </div>
          {trend && (
            <div className={`compact-card__trend compact-card__trend--${trend.direction}`}>
              {trend.direction === 'up' ? '↑' : '↓'} {trend.value}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Info Card Component
 * Card with icon and description
 */
export function InfoCard({
  id,
  title,
  description,
  icon,
  variant = 'info',
  action,
  className = ''
}) {
  return (
    <div id={id} className={`info-card info-card--${variant} ${className}`}>
      {icon && (
        <div className="info-card__icon">
          {icon}
        </div>
      )}
      <div className="info-card__content">
        {title && <h4 className="info-card__title">{title}</h4>}
        {description && <p className="info-card__description">{description}</p>}
        {action && <div className="info-card__action">{action}</div>}
      </div>
    </div>
  );
}

/**
 * Feature Card Component
 * Highlighted card for features or callouts
 */
export function FeatureCard({
  id,
  title,
  description,
  icon,
  badge,
  action,
  className = ''
}) {
  return (
    <div id={id} className={`feature-card ${className}`}>
      <div className="feature-card__header">
        {icon && (
          <div className="feature-card__icon">
            {icon}
          </div>
        )}
        {badge && <div className="feature-card__badge">{badge}</div>}
      </div>
      <div className="feature-card__content">
        {title && <h3 className="feature-card__title">{title}</h3>}
        {description && <p className="feature-card__description">{description}</p>}
      </div>
      {action && (
        <div className="feature-card__action">
          {action}
        </div>
      )}
    </div>
  );
}

export default Card;
