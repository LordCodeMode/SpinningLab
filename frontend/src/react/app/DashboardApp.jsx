import React, { useCallback, useEffect, useMemo, useState } from 'react';
import DashboardShell from '../shell/DashboardShell.jsx';
import { DashboardContext } from './DashboardContext.jsx';

import OverviewApp from '../overview/OverviewApp.jsx';
import TrainingLoadApp from '../training-load/TrainingLoadApp.jsx';
import ComparisonsApp from '../comparisons/ComparisonsApp.jsx';
import PowerCurveApp from '../power-curve/PowerCurveApp.jsx';
import CriticalPowerApp from '../critical-power/CriticalPowerApp.jsx';
import EfficiencyApp from '../efficiency/EfficiencyApp.jsx';
import BestPowersApp from '../best-powers/BestPowersApp.jsx';
import ZonesApp from '../zones/ZonesApp.jsx';
import HrZonesApp from '../hr-zones/HrZonesApp.jsx';
import Vo2maxApp from '../vo2max/Vo2maxApp.jsx';
import CalendarApp from '../calendar/CalendarApp.jsx';
import WorkoutLibraryApp from '../workout-library/WorkoutLibraryApp.jsx';
import WorkoutBuilderApp from '../workout-builder/WorkoutBuilderApp.jsx';
import TrainingPlansApp from '../training-plans/TrainingPlansApp.jsx';
import LiveTrainingApp from '../live-training/LiveTrainingApp.jsx';
import ActivitiesApp from '../activities/ActivitiesApp.jsx';
import ActivityDetailApp from '../activity/ActivityDetailApp.jsx';
import UploadApp from '../upload/UploadApp.jsx';
import SettingsApp from '../settings/SettingsApp.jsx';

import CONFIG from '../../lib/core/config.js';
import Services from '../../lib/services/index.js';
import { AuthAPI } from '../../lib/core/api.js';
import { notify } from '../../lib/core/utils.js';

const TOKEN_STORAGE_KEY = CONFIG.TOKEN_STORAGE_KEY || 'training_dashboard_token';
const DISPLAY_NAME_STORAGE_KEY = CONFIG.DISPLAY_NAME_STORAGE_KEY || 'training_dashboard_display_name';

const ROUTES = {
  overview: OverviewApp,
  activities: ActivitiesApp,
  activity: ActivityDetailApp,
  settings: SettingsApp,
  upload: UploadApp,
  'training-load': TrainingLoadApp,
  comparisons: ComparisonsApp,
  'power-curve': PowerCurveApp,
  'critical-power': CriticalPowerApp,
  efficiency: EfficiencyApp,
  'best-powers': BestPowersApp,
  zones: ZonesApp,
  'hr-zones': HrZonesApp,
  vo2max: Vo2maxApp,
  calendar: CalendarApp,
  'workout-library': WorkoutLibraryApp,
  'workout-builder': WorkoutBuilderApp,
  'training-plans': TrainingPlansApp,
  'live-training': LiveTrainingApp
};

const parseHash = () => {
  const raw = window.location.hash || '';
  const clean = raw.replace(/^#\/?/, '');
  const [path, query] = clean.split('?');
  const segments = (path || '').split('/').filter(Boolean);
  const page = segments[0] || 'overview';
  const params = new URLSearchParams(query || '');
  if (segments[1] && page === 'activity') {
    params.set('id', segments[1]);
  }
  return { page, params };
};

const DashboardApp = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [activePage, setActivePage] = useState(() => parseHash().page);
  const [routeParams, setRouteParams] = useState(() => parseHash().params);
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
    const { page, params } = parseHash();
    setActivePage(page);
    setRouteParams(params);
  }, []);

  const handleNavigate = useCallback((pageKey) => {
    if (!pageKey) return;
    const nextHash = pageKey.startsWith('#') ? pageKey : `#${pageKey}`;
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    }
    const { page, params } = parseHash();
    setActivePage(page);
    setRouteParams(params);
  }, []);

  const clearAuthStorage = useCallback(() => {
    const tokenKeys = [
      TOKEN_STORAGE_KEY,
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
        const user = await AuthAPI.me();
        setCurrentUser(user);
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

  const PageComponent = ROUTES[activePage] || null;
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
        displayName={displayName}
        avatarInitial={avatarInitial}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
      >
        {isReady && PageComponent
          ? (activePage === 'activity'
            ? <PageComponent activityId={activityId} />
            : <PageComponent />)
          : null}
      </DashboardShell>
    </DashboardContext.Provider>
  );
};

export default DashboardApp;
