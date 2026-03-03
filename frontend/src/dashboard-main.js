/**
 * Main entry point for dashboard (dashboard.html)
 *
 * Note: CSS is loaded via HTML <link> tags for better caching
 * This file only imports JavaScript modules
 */

// Import core modules in dependency order
import './lib/core/config.js';
import './lib/core/eventBus.js';
import './lib/core/state.js';
import './lib/core/api.js';
import errorBoundary from './lib/core/errorBoundary.js';
import { notify } from './lib/core/utils.js';

import React from 'react';
import * as ReactDOMClient from 'react-dom/client';
import DashboardApp from './react/app/DashboardApp.jsx';

const createRoot =
  ReactDOMClient.createRoot || ReactDOMClient.default?.createRoot;

window.notify = notify;

const mountDashboardApp = () => {
  const rootElement = document.getElementById('dashboard-root');
  if (!rootElement) {
    console.error('[Dashboard] Missing #dashboard-root for React app');
    return null;
  }
  if (typeof createRoot !== 'function') {
    console.error('[Dashboard] react-dom/client.createRoot is unavailable');
    return null;
  }
  const root = createRoot(rootElement);
  root.render(React.createElement(DashboardApp));
  return root;
};

mountDashboardApp();

// Initialize Feather Icons
document.addEventListener('DOMContentLoaded', () => {
  if (typeof feather !== 'undefined') {
    feather.replace();
  }
});

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
