// FILE: pages/vo2max/config.js
export default {
  id: 'vo2max',
  title: 'VO2 Max Estimation',
  subtitle: 'Maximal oxygen uptake estimates',
  icon: 'wind',
  dataRequirements: { vo2max: { days: 180 } },
  cache: { enabled: true, duration: 5 * 60 * 1000 }
};