import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import DashboardShell from '../shell/DashboardShell.jsx';
import { DashboardContext } from './DashboardContext.jsx';

import CONFIG from '../../lib/core/config.js';
import Services from '../../lib/services/index.js';
import { AuthAPI } from '../../lib/core/api.js';
import { notify } from '../../lib/core/utils.js';
import { setMonitoringUser, setMonitoringTag } from '../../lib/core/monitoring.js';
import {
  getDashboardPageComponent,
  getDashboardPageMeta,
  parseDashboardHash
} from '../../lib/pages/registry.js';

const DISPLAY_NAME_STORAGE_KEY = CONFIG.DISPLAY_NAME_STORAGE_KEY || 'training_dashboard_display_name';

const DashboardApp = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [activePage, setActivePage] = useState(() => parseDashboardHash().page);
  const [routeParams, setRouteParams] = useState(() => parseDashboardHash().params);
  const [isReady, setIsReady] = useState(false);

  const displayName = useMemo(() => {
    if (currentUser?.name?.trim()) return currentUser.name.trim();
    const stored = localStorage.getItem(DISPLAY_NAME_STORAGE_KEY);
    if (stored?.trim()) return stored.trim();
    if (currentUser?.username) return currentUser.username;
    if (currentUser?.email) {
      const [local] = currentUser.email.split('@');
      if (local) return local;
    }
    return 'User';
  }, [currentUser]);

  const avatarInitial = useMemo(() => {
    if (!displayName) return 'U';
    return displayName.charAt(0).toUpperCase();
  }, [displayName]);

  const syncHash = useCallback(() => {
    const { page, params } = parseDashboardHash();
    setActivePage(page);
    setRouteParams(params);
  }, []);

  const handleNavigate = useCallback((pageKey) => {
    if (!pageKey) return;
    const nextHash = pageKey.startsWith('#') ? pageKey : `#${pageKey}`;
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    }
    const { page, params } = parseDashboardHash();
    setActivePage(page);
    setRouteParams(params);
  }, []);

  const clearAuthStorage = useCallback(() => {
    const tokenKeys = [
      'training_dashboard_token',
      'auth_token',
      'token',
      'access_token',
      'jwt',
      'authToken',
      'bearerToken'
    ];

    tokenKeys.forEach((key) => {
      if (localStorage.getItem(key)) {
        localStorage.removeItem(key);
      }
    });

    const userKeys = ['user', 'currentUser', 'userData'];
    userKeys.forEach((key) => {
      if (localStorage.getItem(key)) {
        localStorage.removeItem(key);
      }
    });

    localStorage.removeItem(DISPLAY_NAME_STORAGE_KEY);
    sessionStorage.clear();
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      try {
        await AuthAPI.logout();
      } catch (error) {
        console.warn('[Dashboard] Backend logout failed (ignored):', error?.message || error);
      }
    } finally {
      setMonitoringUser(null);
      clearAuthStorage();
      window.location.replace('/index.html');
    }
  }, [clearAuthStorage]);

  const forceUpdateHeaderStats = useCallback(async () => {
    try {
      if (Services?.data?.clearAllCaches) {
        Services.data.clearAllCaches();
      }
      if (Services?.data?.prefetchCommonData) {
        await Services.data.prefetchCommonData({ forceRefresh: true });
      }
    } catch (error) {
      console.warn('[Dashboard] Header stat refresh failed:', error);
    }
  }, []);

  const updateDisplayName = useCallback((name) => {
    const trimmed = name?.trim();
    if (trimmed) {
      localStorage.setItem(DISPLAY_NAME_STORAGE_KEY, trimmed);
    } else {
      localStorage.removeItem(DISPLAY_NAME_STORAGE_KEY);
    }
    setCurrentUser((prev) => (prev ? { ...prev, name: trimmed } : prev));
  }, []);

  const handleStravaOAuth = useCallback(async () => {
    const params = new URLSearchParams();
    if (window.location.search?.length > 1) {
      params.append('code', new URLSearchParams(window.location.search).get('code'));
    } else if (window.location.hash?.includes('?')) {
      const [, query] = window.location.hash.split('?');
      const hashParams = new URLSearchParams(query);
      if (hashParams.get('code')) {
        params.append('code', hashParams.get('code'));
      }
    }

    const code = params.get('code');
    if (!code) return;

    try {
      const response = await Services.api.stravaCallback(code);
      if (response?.success) {
        notify(`Connected to Strava as ${response.athlete?.firstname || ''} ${response.athlete?.lastname || ''}`.trim(), 'success');
      } else {
        notify('Connected to Strava', 'success');
      }
    } catch (error) {
      console.error('[Dashboard] Strava OAuth exchange failed:', error);
      notify('Failed to connect to Strava. Please try again.', 'error');
    } finally {
      const cleanPath = window.location.pathname;
      window.history.replaceState({}, document.title, `${cleanPath}#/settings`);
      setActivePage('settings');
    }
  }, []);

  useEffect(() => {
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, [syncHash]);

  useEffect(() => {
    const init = async () => {
      try {
        let user = null;
        try {
          user = await AuthAPI.me();
        } catch (error) {
          await AuthAPI.refresh();
          user = await AuthAPI.me();
        }
        setCurrentUser(user);
        setMonitoringUser(user);
        await handleStravaOAuth();
        setIsReady(true);
      } catch (error) {
        console.error('[Dashboard] Authentication failed:', error);
        clearAuthStorage();
        window.location.replace('/index.html');
      }
    };

    init();
  }, [clearAuthStorage, handleStravaOAuth]);

  useEffect(() => {
    setMonitoringTag('dashboard_route', activePage);
  }, [activePage]);

  const pageMeta = getDashboardPageMeta(activePage);
  const PageComponent = getDashboardPageComponent(activePage);
  const activityId = routeParams?.get('id') || routeParams?.get('activity_id');

  const contextValue = useMemo(() => ({
    currentUser,
    displayName,
    updateDisplayName,
    forceUpdateHeaderStats
  }), [currentUser, displayName, updateDisplayName, forceUpdateHeaderStats]);

  return (
    <DashboardContext.Provider value={contextValue}>
      <DashboardShell
        activePage={activePage}
        activePageMeta={pageMeta}
        displayName={displayName}
        avatarInitial={avatarInitial}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
      >
        <Suspense fallback={null}>
          {isReady && PageComponent
            ? (activePage === 'activity'
              ? <PageComponent activityId={activityId} />
              : <PageComponent />)
            : null}
        </Suspense>
      </DashboardShell>
    </DashboardContext.Provider>
  );
};

export default DashboardApp;
