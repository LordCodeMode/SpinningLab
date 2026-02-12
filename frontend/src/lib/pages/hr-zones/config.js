// FILE: pages/hr-zones/config.js
export default {
  id: 'hr-zones',
  title: 'Heart Rate Zones',
  subtitle: 'Time distribution across HR zones',
  icon: 'heart',
  dataRequirements: { hrZones: { days: 90 } },
  cache: { enabled: true, duration: 5 * 60 * 1000 }
};