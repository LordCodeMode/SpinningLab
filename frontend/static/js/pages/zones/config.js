// FILE: pages/zones/config.js
export default {
  id: 'zones',
  title: 'Power Zones',
  subtitle: 'Time distribution across power zones',
  icon: 'layers',
  dataRequirements: { powerZones: { days: 90 } },
  cache: { enabled: true, duration: 5 * 60 * 1000 }
};