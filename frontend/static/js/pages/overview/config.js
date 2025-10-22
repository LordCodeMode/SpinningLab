// ============================================
// FILE: pages/overview/config.js
// Overview page configuration
// ============================================

const OverviewConfig = {
  // Page metadata
  id: 'overview',
  title: 'Dashboard Overview',
  subtitle: 'Your training metrics and recent performance',
  icon: 'home',
  
  // Data requirements
  dataRequirements: {
    trainingLoad: { days: 30 },
    activities: { limit: 5 },
    settings: true,
    fitnessState: true
  },
  
  // Cache settings
  cache: {
    enabled: true,
    duration: 2 * 60 * 1000 // 2 minutes
  },
  
  // Refresh settings
  refresh: {
    auto: false,
    interval: null
  },
  
  // Feature flags
  features: {
    showInsights: true,
    showActivities: true,
    showCharts: true,
    enableInteraction: true
  },
  
  // Chart configurations
  charts: {
    trainingLoad: {
      type: 'line',
      height: 400,
      responsive: true,
      defaultRange: 30, // days
      availableRanges: [30, 90, 180]
    }
  },
  
  // UI settings
  ui: {
    metricsCount: 4,
    insightsLimit: 3,
    activitiesLimit: 5
  },
  
  // Metric definitions
  metrics: [
    {
      id: 'ctl',
      label: 'Fitness (CTL)',
      subtitle: 'Chronic Training Load',
      variant: 'primary',
      format: 'decimal',
      decimals: 1
    },
    {
      id: 'atl',
      label: 'Fatigue (ATL)',
      subtitle: 'Acute Training Load',
      variant: 'purple',
      format: 'decimal',
      decimals: 1
    },
    {
      id: 'tsb',
      label: 'Form (TSB)',
      subtitle: 'Training Stress Balance',
      variant: 'green',
      format: 'decimal',
      decimals: 1
    },
    {
      id: 'fitness_charge',
      label: 'Fitness Charge',
      subtitle: 'Overall readiness',
      variant: 'amber',
      format: 'percentage',
      decimals: 0
    }
  ]
};

export default OverviewConfig;