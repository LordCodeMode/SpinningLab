/**
 * Main entry point for authentication page (index.html)
 */

import React from 'react';
import * as ReactDOMClient from 'react-dom/client';
import AuthApp from './react/auth/AuthApp.jsx';

const createRoot =
  ReactDOMClient.createRoot || ReactDOMClient.default?.createRoot;

const mountAuth = () => {
  const rootElement = document.getElementById('auth-root');
  if (!rootElement) {
    console.error('[Auth] Missing #auth-root');
    return;
  }
  if (typeof createRoot !== 'function') {
    console.error('[Auth] react-dom/client.createRoot is unavailable');
    return;
  }
  const root = createRoot(rootElement);
  root.render(React.createElement(AuthApp));
};

mountAuth();
