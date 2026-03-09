import { lazy } from 'react';

export const DEFAULT_DASHBOARD_PAGE = 'overview';

const createPage = (definition) => Object.freeze(definition);

export const DASHBOARD_PAGES = Object.freeze([
  createPage({
    id: 'overview',
    title: 'Dashboard',
    subtitle: 'Your training metrics and recent performance',
    navLabel: 'Overview',
    section: 'Dashboard',
    icon: 'home',
    navVisible: true,
    component: lazy(() => import('../../react/overview/OverviewApp.jsx')),
  }),
  createPage({
    id: 'training-load',
    title: 'Training Load',
    subtitle: 'Track fitness, fatigue, and form over time',
    navLabel: 'Training Load',
    section: 'Performance',
    icon: 'trending-up',
    navVisible: true,
    component: lazy(() => import('../../react/training-load/TrainingLoadApp.jsx')),
  }),
  createPage({
    id: 'comparisons',
    title: 'Comparisons',
    subtitle: 'Historical trends and year-over-year performance',
    navLabel: 'Comparisons',
    section: 'Performance',
    icon: 'bar-chart-2',
    navVisible: true,
    component: lazy(() => import('../../react/comparisons/ComparisonsApp.jsx')),
  }),
  createPage({
    id: 'power-curve',
    title: 'Power Curve',
    subtitle: 'Best power outputs across all durations',
    navLabel: 'Power Curve',
    section: 'Performance',
    icon: 'activity',
    navVisible: true,
    component: lazy(() => import('../../react/power-curve/PowerCurveApp.jsx')),
  }),
  createPage({
    id: 'critical-power',
    title: 'Critical Power',
    subtitle: "CP and W' physiological model",
    navLabel: 'Critical Power',
    section: 'Performance',
    icon: 'target',
    navVisible: true,
    component: lazy(() => import('../../react/critical-power/CriticalPowerApp.jsx')),
  }),
  createPage({
    id: 'efficiency',
    title: 'Efficiency',
    subtitle: 'Power to heart rate efficiency trends',
    navLabel: 'Efficiency',
    section: 'Performance',
    icon: 'percent',
    navVisible: true,
    component: lazy(() => import('../../react/efficiency/EfficiencyApp.jsx')),
  }),
  createPage({
    id: 'best-powers',
    title: 'Best Powers',
    subtitle: 'Personal power records across key durations',
    navLabel: 'Best Powers',
    section: 'Performance',
    icon: 'award',
    navVisible: true,
    component: lazy(() => import('../../react/best-powers/BestPowersApp.jsx')),
  }),
  createPage({
    id: 'zones',
    title: 'Power Zones',
    subtitle: 'Time distribution across power zones',
    navLabel: 'Power Zones',
    section: 'Analysis',
    icon: 'layers',
    navVisible: true,
    component: lazy(() => import('../../react/zones/ZonesApp.jsx')),
  }),
  createPage({
    id: 'hr-zones',
    title: 'Heart Rate Zones',
    subtitle: 'Time distribution across heart rate zones',
    navLabel: 'HR Zones',
    section: 'Analysis',
    icon: 'heart',
    navVisible: true,
    component: lazy(() => import('../../react/hr-zones/HrZonesApp.jsx')),
  }),
  createPage({
    id: 'vo2max',
    title: 'VO2 Max',
    subtitle: 'Maximal oxygen uptake estimates',
    navLabel: 'VO2 Max',
    section: 'Analysis',
    icon: 'wind',
    navVisible: true,
    component: lazy(() => import('../../react/vo2max/Vo2maxApp.jsx')),
  }),
  createPage({
    id: 'calendar',
    title: 'Calendar',
    subtitle: 'Plan and review your training schedule',
    navLabel: 'Calendar',
    section: 'Workout Planning',
    icon: 'calendar',
    navVisible: true,
    component: lazy(() => import('../../react/calendar/CalendarApp.jsx')),
  }),
  createPage({
    id: 'workout-library',
    title: 'Workout Library',
    subtitle: 'Browse and manage your workout collection',
    navLabel: 'Workout Library',
    section: 'Workout Planning',
    icon: 'book',
    navVisible: true,
    component: lazy(() => import('../../react/workout-library/WorkoutLibraryApp.jsx')),
  }),
  createPage({
    id: 'workout-builder',
    title: 'Workout Builder',
    subtitle: 'Create and edit custom workouts',
    navLabel: 'Workout Builder',
    section: 'Workout Planning',
    icon: 'edit',
    navVisible: true,
    component: lazy(() => import('../../react/workout-builder/WorkoutBuilderApp.jsx')),
  }),
  createPage({
    id: 'live-training',
    title: 'Live Training',
    subtitle: 'Run workouts and connected trainer sessions live',
    navLabel: 'Live Training',
    section: 'Workout Planning',
    icon: 'bluetooth',
    navVisible: true,
    component: lazy(() => import('../../react/live-training/LiveTrainingApp.jsx')),
  }),
  createPage({
    id: 'training-plans',
    title: 'Training Plans',
    subtitle: 'Create and schedule structured training blocks',
    navLabel: 'Training Plans',
    section: 'Workout Planning',
    icon: 'layers',
    navVisible: true,
    component: lazy(() => import('../../react/training-plans/TrainingPlansApp.jsx')),
  }),
  createPage({
    id: 'activities',
    title: 'Activities',
    subtitle: 'Browse and analyze your imported sessions',
    navLabel: 'Activities',
    section: 'Data',
    icon: 'list',
    navVisible: true,
    component: lazy(() => import('../../react/activities/ActivitiesApp.jsx')),
  }),
  createPage({
    id: 'activity',
    title: 'Activity Detail',
    subtitle: 'Session detail, streams, and advanced metrics',
    navLabel: 'Activity Detail',
    section: null,
    icon: 'activity',
    navVisible: false,
    component: lazy(() => import('../../react/activity/ActivityDetailApp.jsx')),
  }),
  createPage({
    id: 'upload',
    title: 'Upload',
    subtitle: 'Import FIT files and refresh activity data',
    navLabel: 'Upload',
    section: 'Data',
    icon: 'upload',
    navVisible: true,
    component: lazy(() => import('../../react/upload/UploadApp.jsx')),
  }),
  createPage({
    id: 'settings',
    title: 'Settings',
    subtitle: 'Profile, zones, Strava, and platform configuration',
    navLabel: 'Settings',
    section: 'Data',
    icon: 'settings',
    navVisible: true,
    component: lazy(() => import('../../react/settings/SettingsApp.jsx')),
  }),
]);

const pageById = new Map(DASHBOARD_PAGES.map((page) => [page.id, page]));

export const DASHBOARD_NAV_SECTIONS = Object.freeze(
  ['Dashboard', 'Performance', 'Analysis', 'Workout Planning', 'Data'].map((section) => ({
    id: section.toLowerCase().replace(/\s+/g, '-'),
    label: section,
    pages: DASHBOARD_PAGES.filter((page) => page.section === section && page.navVisible),
  })),
);

export const getDashboardPageMeta = (pageId) =>
  pageById.get(pageId) || pageById.get(DEFAULT_DASHBOARD_PAGE) || null;

export const getDashboardPageComponent = (pageId) =>
  getDashboardPageMeta(pageId)?.component || null;

export const isKnownDashboardPage = (pageId) => pageById.has(pageId);

export const parseDashboardHash = (rawHash = window.location.hash || '') => {
  const clean = rawHash.replace(/^#\/?/, '');
  const [path, query] = clean.split('?');
  const segments = (path || '').split('/').filter(Boolean);
  const requestedPage = segments[0] || DEFAULT_DASHBOARD_PAGE;
  const page = isKnownDashboardPage(requestedPage) ? requestedPage : DEFAULT_DASHBOARD_PAGE;
  const params = new URLSearchParams(query || '');

  if (segments[1] && page === 'activity') {
    params.set('id', segments[1]);
  }

  return { page, params, segments };
};
