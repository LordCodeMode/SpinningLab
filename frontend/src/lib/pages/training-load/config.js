// ============================================
// FILE: pages/training-load/config.js
// Training Load page configuration
// ============================================

const TrainingLoadConfig = {
  // Page metadata
  id: 'training-load',
  title: 'Training Load Analysis',
  subtitle: 'Track your fitness, fatigue, and form over time',
  icon: 'trending-up',
  
  // Data requirements
  dataRequirements: {
    trainingLoad: { days: 90 },
    settings: true
  },
  
  // Cache settings
  cache: {
    enabled: true,
    duration: 5 * 60 * 1000 // 5 minutes
  },
  
  // Refresh settings
  refresh: {
    auto: false,
    interval: null
  },
  
  // Feature flags
  features: {
    showInsights: true,
    showInfo: true,
    showCharts: true,
    enableTimeRangeSelection: true,
    enableInteraction: true
  },
  
  // Time range options
  timeRanges: [
    { label: '30 Days', days: 30, shortLabel: '30d' },
    { label: '90 Days', days: 90, shortLabel: '90d', default: true },
    { label: '180 Days', days: 180, shortLabel: '180d' },
    { label: '1 Year', days: 365, shortLabel: '1 Year' }
  ],
  
  // Chart configurations
  charts: {
    trainingLoad: {
      type: 'line',
      height: 420,
      responsive: true,
      showLegend: true,
      defaultRange: 90 // days
    }
  },
  
  // UI settings
  ui: {
    metricsCount: 3,
    insightsLimit: 5,
    infoCardsCount: 3
  },
  
  // Metric definitions
  metrics: [
    {
      id: 'ctl',
      label: 'Fitness (CTL)',
      subtitle: 'Chronic Training Load',
      variant: 'primary',
      format: 'decimal',
      decimals: 1,
      description: 'Long-term fitness indicator'
    },
    {
      id: 'atl',
      label: 'Fatigue (ATL)',
      subtitle: 'Acute Training Load',
      variant: 'danger',
      format: 'decimal',
      decimals: 1,
      description: 'Short-term fatigue indicator'
    },
    {
      id: 'tsb',
      label: 'Form (TSB)',
      subtitle: 'Training Stress Balance',
      variant: 'success',
      format: 'decimal',
      decimals: 1,
      description: 'Current form indicator'
    }
  ],
  
  // TSB status thresholds
  tsbThresholds: {
    veryFresh: 25,
    fresh: 10,
    neutral: -10,
    fatigued: -20,
    veryFatigued: -30
  },
  
  // Info cards content
  infoCards: [
    {
      id: 'ctl',
      title: 'CTL (Fitness)',
      icon: 'zap',
      variant: 'primary',
      description: 'Chronic Training Load represents your long-term fitness. A higher CTL means you\'re more fit. It\'s calculated as a 42-day exponentially weighted average of your daily training stress.'
    },
    {
      id: 'atl',
      title: 'ATL (Fatigue)',
      icon: 'alert-circle',
      variant: 'danger',
      description: 'Acute Training Load represents your short-term fatigue. High ATL means you need recovery. It\'s calculated as a 7-day exponentially weighted average of recent training stress.'
    },
    {
      id: 'tsb',
      title: 'TSB (Form)',
      icon: 'smile',
      variant: 'warning',
      description: 'Training Stress Balance (CTL - ATL) indicates your form. Positive values mean you\'re fresh, negative means fatigued. Aim for slight positive TSB before important events.'
    }
  ]
};

export default TrainingLoadConfig;