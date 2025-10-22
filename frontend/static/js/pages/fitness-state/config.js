// FILE: pages/fitness-state/config.js
export default {
  id: 'fitness-state',
  title: 'Fitness State',
  subtitle: 'Comprehensive training state analysis',
  icon: 'thermometer',
  dataRequirements: { fitnessState: true },
  cache: { enabled: true, duration: 2 * 60 * 1000 }
};