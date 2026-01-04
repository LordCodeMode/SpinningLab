/**
 * Main entry point for dashboard (dashboard.html)
 *
 * Note: CSS is loaded via HTML <link> tags for better caching
 * This file only imports JavaScript modules
 */

// Import core modules in dependency order
import '../static/js/core/config.js';
import '../static/js/core/eventBus.js';
import '../static/js/core/state.js';
import '../static/js/core/utils.js';
import '../static/js/core/api.js';
import errorBoundary from '../static/js/core/errorBoundary.js';
import '../static/js/core/router.js';

import React from 'react';
import { createRoot } from 'react-dom/client';
import DashboardShell from './react/shell/DashboardShell.jsx';

window.__DASHBOARD_MANUAL_INIT__ = true;

const mountDashboardShell = () => {
  const rootElement = document.getElementById('dashboard-root');
  if (!rootElement) {
    console.error('[Dashboard] Missing #dashboard-root for React shell');
    return null;
  }
  const root = createRoot(rootElement);
  root.render(React.createElement(DashboardShell));
  return root;
};

const waitForShell = () => new Promise((resolve) => {
  if (document.getElementById('pageContent')) {
    resolve();
    return;
  }
  window.addEventListener('dashboard:shell-ready', () => resolve(), { once: true });
});

mountDashboardShell();

// Initialize Feather Icons
document.addEventListener('DOMContentLoaded', () => {
  if (typeof feather !== 'undefined') {
    feather.replace();
  }
});

const bootDashboard = async () => {
  await waitForShell();
  const module = await import('../static/js/core/dashboard.js');
  if (module?.initDashboard) {
    await module.initDashboard();
  }
};

bootDashboard();

// Setup global error handler with user-friendly messages
errorBoundary.setGlobalHandler((error, errorInfo) => {
  console.error('[Global Error]', error, errorInfo);

  // Show user-friendly notification
  if (window.notify) {
    const message = error?.message || 'Something went wrong. Please try refreshing the page.';
    window.notify(message, 'error');
  }

  // For critical errors, offer to reload
  if (errorInfo.type === 'uncaught' || error?.name === 'TypeError') {
    setTimeout(() => {
      if (confirm('A critical error occurred. Would you like to reload the page?')) {
        window.location.reload();
      }
    }, 1000);
  }
});

// Service Worker registration (optional - for PWA features)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.log('ServiceWorker registration failed:', error);
    });
  });
}

// Log app version in console (useful for debugging)
console.log(`Training Dashboard v${__APP_VERSION__ || '1.0.0'}`);
