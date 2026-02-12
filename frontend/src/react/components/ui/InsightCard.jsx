import React from 'react';

/**
 * Insight Card Component
 * Display AI-generated insights with icon and actions
 */
export function InsightCard({
  id,
  type = 'info',
  icon,
  title,
  text,
  actions,
  children,
  priority,
  className = ''
}) {
  const defaultIcons = {
    info: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
    ),
    success: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
    ),
    warning: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
      </svg>
    ),
    danger: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
    )
  };

  const iconToUse = icon || defaultIcons[type];

  return (
    <div id={id} className={`insight-card insight-card--${type} ${className}`}>
      <div className="insight-card__icon">
        {iconToUse}
      </div>
      <div className="insight-card__content">
        <div className="insight-card__header">
          {title && <h4 className="insight-card__title">{title}</h4>}
          {priority?.show && (
            <div className={`insight-card__priority insight-card__priority--${priority.level}`}>
              Priority {priority.level}
            </div>
          )}
        </div>
        {text && <p className="insight-card__text">{text}</p>}
        {children}
        {actions && (
          <div className="insight-card__actions">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Insight Grid Component
 * Container for multiple insights
 */
export function InsightGrid({
  insights = [],
  children,
  columns = 1,
  className = ''
}) {
  const gridClass = columns === 2 ? 'insights-grid--two' : '';

  if (children) {
    return (
      <div className={`insights-grid ${gridClass} ${className}`}>
        {children}
      </div>
    );
  }

  if (!insights || insights.length === 0) return null;

  return (
    <div className={`insights-grid ${gridClass} ${className}`}>
      {insights.map((insight, index) => (
        <InsightCard key={index} {...insight} />
      ))}
    </div>
  );
}

/**
 * Insight Badge Component
 * Small inline insight indicator
 */
export function InsightBadge({
  type = 'info',
  text,
  children,
  icon,
  className = ''
}) {
  const defaultIcons = {
    info: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
    ),
    success: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
      </svg>
    ),
    warning: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
      </svg>
    ),
    danger: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
      </svg>
    )
  };

  const iconToUse = icon || defaultIcons[type];

  return (
    <div className={`insight-badge insight-badge--${type} ${className}`}>
      <div className="insight-badge__icon">
        {iconToUse}
      </div>
      <span>{children || text}</span>
    </div>
  );
}

/**
 * Recommendation List Component
 * List of actionable recommendations
 */
export function RecommendationList({
  title = 'Recommendations',
  recommendations = [],
  children,
  className = ''
}) {
  if (children) {
    return (
      <div className={`recommendation-list ${className}`}>
        <div className="recommendation-list__title">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
            />
          </svg>
          {title}
        </div>
        {children}
      </div>
    );
  }

  if (!recommendations || recommendations.length === 0) return null;

  const checkIcon = (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
    </svg>
  );

  return (
    <div className={`recommendation-list ${className}`}>
      <div className="recommendation-list__title">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
          />
        </svg>
        {title}
      </div>
      {recommendations.map((rec, index) => (
        <div key={index} className="recommendation-item">
          <div className="recommendation-item__icon">
            {rec.icon || checkIcon}
          </div>
          <div className="recommendation-item__content">
            {rec.title && <div className="recommendation-item__title">{rec.title}</div>}
            <div className="recommendation-item__text">{rec.text}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Insight Panel Component
 * Full insight panel with multiple sections
 */
export function InsightPanel({
  title,
  insights = [],
  recommendations = [],
  className = ''
}) {
  return (
    <div className={`insight-panel ${className}`}>
      {title && <h3 className="insight-panel__title">{title}</h3>}
      {insights.length > 0 && (
        <InsightGrid insights={insights} />
      )}
      {recommendations.length > 0 && (
        <RecommendationList recommendations={recommendations} />
      )}
    </div>
  );
}

/**
 * Insight Metric Component
 * Metric display within an insight
 */
export function InsightMetric({
  label,
  value,
  change,
  className = ''
}) {
  return (
    <div className={`insight-metric ${className}`}>
      <div className="insight-metric__label">{label}</div>
      <div className="insight-metric__value">{value}</div>
      {change && (
        <div className={`insight-metric__change insight-metric__change--${change >= 0 ? 'positive' : 'negative'}`}>
          {change >= 0 ? '+' : ''}{change}%
        </div>
      )}
    </div>
  );
}

/**
 * Insight Timeline Component
 * Timeline of insights
 */
export function InsightTimeline({
  items = [],
  className = ''
}) {
  if (!items || items.length === 0) return null;

  return (
    <div className={`insight-timeline ${className}`}>
      {items.map((item, index) => (
        <div key={index} className="insight-timeline__item">
          <div className="insight-timeline__marker" />
          <div className="insight-timeline__content">
            {item.date && <div className="insight-timeline__date">{item.date}</div>}
            {item.title && <div className="insight-timeline__title">{item.title}</div>}
            {item.description && <div className="insight-timeline__description">{item.description}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Insight Stats Component
 * Stats summary for insights
 */
export function InsightStats({
  stats = [],
  className = ''
}) {
  if (!stats || stats.length === 0) return null;

  return (
    <div className={`insight-stats ${className}`}>
      {stats.map((stat, index) => (
        <div key={index} className="insight-stats__item">
          <div className="insight-stats__value">{stat.value}</div>
          <div className="insight-stats__label">{stat.label}</div>
        </div>
      ))}
    </div>
  );
}

/**
 * Quick Insight Component
 * Compact insight for quick display
 */
export function QuickInsight({
  type = 'info',
  text,
  children,
  className = ''
}) {
  return (
    <div className={`quick-insight quick-insight--${type} ${className}`}>
      {children || text}
    </div>
  );
}

export default InsightCard;
