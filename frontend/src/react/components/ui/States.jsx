import React from 'react';

/**
 * Loading Skeleton Component
 * Animated loading placeholder
 */
export function LoadingSkeleton({
  type = 'card',
  count = 1,
  className = ''
}) {
  const skeletons = {
    card: () => (
      <div className={`skeleton skeleton--card ${className}`} />
    ),
    metric: () => (
      <div className={`skeleton skeleton--metric ${className}`}>
        <div className="skeleton__circle" />
        <div className="skeleton__lines">
          <div className="skeleton__line skeleton__line--short" />
          <div className="skeleton__line skeleton__line--long" />
        </div>
      </div>
    ),
    chart: () => (
      <div className={`skeleton skeleton--chart ${className}`}>
        <div className="skeleton__header" />
        <div className="skeleton__chart-area" />
      </div>
    ),
    table: () => (
      <div className={`skeleton skeleton--table ${className}`}>
        {Array(5).fill(null).map((_, i) => (
          <div key={i} className="skeleton-table__row">
            <div className="skeleton-table__cell" />
            <div className="skeleton-table__cell" />
            <div className="skeleton-table__cell" />
            <div className="skeleton-table__cell" />
          </div>
        ))}
      </div>
    ),
    text: () => (
      <div className={`skeleton-text ${className}`}>
        <div className="skeleton-text__line" />
        <div className="skeleton-text__line" />
        <div className="skeleton-text__line" />
        <div className="skeleton-text__line" />
      </div>
    )
  };

  const SkeletonComponent = skeletons[type] || skeletons.card;

  return (
    <>
      {Array(count).fill(null).map((_, index) => (
        <SkeletonComponent key={index} />
      ))}
    </>
  );
}

/**
 * Loading Spinner Component
 * Simple spinner with optional text
 */
export function LoadingSpinner({
  text = 'Loading...',
  size = 'md',
  className = ''
}) {
  return (
    <div className={`loading ${className}`}>
      <div className={`spinner spinner--${size}`} />
      {text && <p className="loading__text">{text}</p>}
    </div>
  );
}

/**
 * Empty State Component
 * Display when no data is available
 */
export function EmptyState({
  icon,
  title = 'No data available',
  message,
  action,
  className = ''
}) {
  const defaultIcon = (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
      />
    </svg>
  );

  return (
    <div className={`empty-state ${className}`}>
      <div className="empty-state__icon">
        {icon || defaultIcon}
      </div>
      <h3 className="empty-state__title">{title}</h3>
      {message && <p className="empty-state__message">{message}</p>}
      {action && (
        <div className="empty-state__action empty-state__action--spaced">
          {action}
        </div>
      )}
    </div>
  );
}

/**
 * Error State Component
 * Display when an error occurs
 */
export function ErrorState({
  title = 'Something went wrong',
  message = 'An error occurred while loading this content.',
  action,
  className = ''
}) {
  const errorIcon = (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );

  return (
    <div className={`error-state error-state--panel ${className}`}>
      <div className="error-state__icon">
        {errorIcon}
      </div>
      <h3 className="error-state__title">
        {title}
      </h3>
      {message && (
        <p className="error-state__message">
          {message}
        </p>
      )}
      {action && (
        <div className="error-state__action">
          {action}
        </div>
      )}
    </div>
  );
}

/**
 * No Results State Component
 * Display when search/filter returns no results
 */
export function NoResultsState({
  query = '',
  message,
  action,
  className = ''
}) {
  const searchIcon = (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  );

  const defaultMessage = query
    ? `No results found for "${query}"`
    : 'No results found';

  return (
    <EmptyState
      icon={searchIcon}
      title={defaultMessage}
      message={message || 'Try adjusting your search or filters'}
      action={action}
      className={className}
    />
  );
}

/**
 * Success State Component
 * Display success message
 */
export function SuccessState({
  title = 'Success!',
  message,
  action,
  className = ''
}) {
  const successIcon = (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );

  return (
    <div className={`success-state success-state--panel ${className}`}>
      <div className="success-state__icon">
        {successIcon}
      </div>
      <h3 className="success-state__title">
        {title}
      </h3>
      {message && (
        <p className="success-state__message">
          {message}
        </p>
      )}
      {action && (
        <div className="success-state__action">
          {action}
        </div>
      )}
    </div>
  );
}

/**
 * Maintenance State Component
 * Display during maintenance
 */
export function MaintenanceState({
  title = 'Under Maintenance',
  message = "We're currently performing scheduled maintenance. Please check back soon.",
  className = ''
}) {
  const maintenanceIcon = (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
    </svg>
  );

  return (
    <EmptyState
      icon={maintenanceIcon}
      title={title}
      message={message}
      className={className}
    />
  );
}

/**
 * Offline State Component
 * Display when offline
 */
export function OfflineState({
  title = "You're offline",
  message = 'Please check your internet connection and try again.',
  action,
  className = ''
}) {
  return (
    <ErrorState
      title={title}
      message={message}
      action={action}
      className={className}
    />
  );
}

/**
 * Permission Denied State Component
 */
export function PermissionDeniedState({
  title = 'Access Denied',
  message = "You don't have permission to view this content.",
  action,
  className = ''
}) {
  return (
    <ErrorState
      title={title}
      message={message}
      action={action}
      className={className}
    />
  );
}

/**
 * Coming Soon State Component
 */
export function ComingSoonState({
  title = 'Coming Soon',
  message = 'This feature is currently under development.',
  className = ''
}) {
  const rocketIcon = (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M13 10V3L4 14h7v7l9-11h-7z"
      />
    </svg>
  );

  return (
    <EmptyState
      icon={rocketIcon}
      title={title}
      message={message}
      className={className}
    />
  );
}

export default LoadingSkeleton;
