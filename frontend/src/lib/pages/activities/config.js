// FILE: pages/activities/config.js
export default {
  id: 'activities',
  title: 'Activities',
  subtitle: 'View and analyze your training activities',
  icon: 'list',
  dataRequirements: { activities: { limit: 20 } },
  cache: { enabled: true, duration: 2 * 60 * 1000 }
};