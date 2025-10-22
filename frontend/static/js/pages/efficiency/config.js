// FILE: pages/efficiency/config.js
export default {
  id: 'efficiency',
  title: 'Efficiency Analysis',
  subtitle: 'Power to heart rate efficiency',
  icon: 'percent',
  dataRequirements: { efficiency: { days: 120 } },
  cache: { enabled: true, duration: 5 * 60 * 1000 }
};