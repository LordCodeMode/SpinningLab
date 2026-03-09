import * as Sentry from '@sentry/browser';

let monitoringEnabled = false;

export function initMonitoring(appName) {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  const environment = import.meta.env.MODE;

  if (!dsn || !['production', 'staging'].includes(environment)) {
    return;
  }

  Sentry.init({
    dsn,
    environment,
    release: __APP_VERSION__ || '1.0.0',
    tracesSampleRate: 0
  });

  monitoringEnabled = true;
  Sentry.setTag('app', appName);
}

export function captureError(error, context = {}) {
  if (!monitoringEnabled) return;
  Sentry.captureException(error, { extra: context });
}

export function setMonitoringUser(user) {
  if (!monitoringEnabled) return;
  if (!user) {
    Sentry.setUser(null);
    return;
  }
  Sentry.setUser({
    id: user.id,
    username: user.username,
    email: user.email
  });
}

export function setMonitoringTag(key, value) {
  if (!monitoringEnabled) return;
  Sentry.setTag(key, value);
}
