// FILE: pages/best-powers/config.js
export default {
  id: 'best-powers',
  title: 'Best Power Values',
  subtitle: 'Your personal power records',
  icon: 'award',
  dataRequirements: { bestPowerValues: true, settings: true },
  cache: { enabled: true, duration: 5 * 60 * 1000 }
};