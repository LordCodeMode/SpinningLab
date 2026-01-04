/**
 * Main entry point for authentication page (index.html)
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import AuthApp from './react/auth/AuthApp.jsx';

const mountAuth = () => {
  const rootElement = document.getElementById('auth-root');
  if (!rootElement) {
    console.error('[Auth] Missing #auth-root');
    return;
  }
  const root = createRoot(rootElement);
  root.render(React.createElement(AuthApp));
};

mountAuth();
