/**
 * Main entry point for authentication page (index.html)
 */

import React from 'react';
import * as ReactDOMClient from 'react-dom/client';
import * as feather from 'feather-icons';
import AuthApp from './react/auth/AuthApp.jsx';
import { initMonitoring } from './lib/core/monitoring.js';

const resolveFeatherApi = (candidate) => {
  if (!candidate) return null;
  if (typeof candidate.replace === 'function') return candidate;
  if (candidate.default && typeof candidate.default.replace === 'function') return candidate.default;
  if (candidate.feather && typeof candidate.feather.replace === 'function') return candidate.feather;
  if (candidate.default?.feather && typeof candidate.default.feather.replace === 'function') {
    return candidate.default.feather;
  }
  return null;
};

const rawFeatherApi = resolveFeatherApi(feather);
const featherApi = {
  replace: (...args) => rawFeatherApi?.replace?.(...args),
  toSvg: (...args) => rawFeatherApi?.toSvg?.(...args),
  icons: rawFeatherApi?.icons || {},
};

window.feather = featherApi;
globalThis.feather = featherApi;
initMonitoring('auth');

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
  featherApi.replace();
};

mountAuth();
