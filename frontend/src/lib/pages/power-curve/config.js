// ============================================
// FILE: pages/power-curve/config.js
// Power Curve page configuration
// ============================================

const PowerCurveConfig = {
  // Page metadata
  id: 'power-curve',
  title: 'Power Curve Analysis',
  subtitle: 'Best power outputs across all durations',
  icon: 'activity',
  
  // Data requirements
  dataRequirements: {
    powerCurve: { weighted: false },
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
    enableWeightedToggle: true,
    enableInteraction: true
  },
  
  // Time range options
  timeRanges: [
    { label: '30 Days', days: 30, shortLabel: '30d' },
    { label: '90 Days', days: 90, shortLabel: '90d', default: true },
    { label: '180 Days', days: 180, shortLabel: '180d' },
    { label: '1 Year', days: 365, shortLabel: '1 Year' },
    { label: 'All Time', days: null, shortLabel: 'All' }
  ],
  
  // Chart configurations
  charts: {
    powerCurve: {
      type: 'scatter',
      height: 420,
      responsive: true,
      showLegend: false,
      defaultRange: 90, // days
      logScale: true // X-axis is logarithmic
    }
  },
  
  // UI settings
  ui: {
    metricsCount: 4, // 5s, 1m, 5m, 20m
    infoCardsCount: 2
  },
  
  // Key duration points (seconds)
  keyDurations: [
    {
      duration: 5,
      label: '5s',
      shortLabel: 'Peak 5s',
      description: 'Sprint power',
      variant: 'primary',
      icon: 'zap'
    },
    {
      duration: 60,
      label: '1m',
      shortLabel: 'Peak 1m',
      description: 'Anaerobic capacity',
      variant: 'purple',
      icon: 'clock'
    },
    {
      duration: 300,
      label: '5m',
      shortLabel: 'Peak 5m',
      description: 'VO2max power',
      variant: 'green',
      icon: 'bar-chart-2'
    },
    {
      duration: 1200,
      label: '20m',
      shortLabel: 'Peak 20m',
      description: 'FTP estimate',
      variant: 'amber',
      icon: 'target'
    }
  ],
  
  // Info card content
  infoCards: [
    {
      id: 'understanding',
      title: 'Understanding Power Curve',
      icon: 'lightbulb',
      factors: [
        {
          title: 'Maximum Mean Power',
          description: 'Shows your best average power for any given duration from seconds to hours',
          icon: 'zap'
        },
        {
          title: 'Power Profile',
          description: 'Identifies your strengths - sprinter, time trialist, or all-rounder',
          icon: 'bar-chart-2'
        },
        {
          title: 'Track Progress',
          description: 'Monitor improvements across different energy systems over time',
          icon: 'trending-up'
        }
      ],
      insight: {
        title: 'Power Curve Analysis',
        text: 'Your power curve reveals physiological capabilities across all durations. Short efforts (5-30s) indicate neuromuscular power, mid-range (1-5m) shows VO2max capacity, and longer durations (20-60m) reflect threshold and endurance.'
      }
    },
    {
      id: 'applications',
      title: 'Training Applications',
      icon: 'sliders',
      factors: [
        {
          title: 'Identify Weaknesses',
          description: 'Dips in your curve reveal areas needing focused training attention',
          icon: 'check-circle'
        },
        {
          title: 'Set Training Zones',
          description: 'Use curve data to establish accurate power zones for structured workouts',
          icon: 'zap'
        },
        {
          title: 'Race Pacing',
          description: 'Inform pacing strategies based on sustainable power for event durations',
          icon: 'clock'
        },
        {
          title: 'Monitor Fitness',
          description: 'Track how your curve shifts upward as fitness improves over training blocks',
          icon: 'trending-up'
        }
      ]
    }
  ],
  
  // Chart marker colors
  markerColors: {
    '5': '#3b82f6',    // 5s - Blue
    '60': '#8b5cf6',   // 1m - Purple
    '300': '#10b981',  // 5m - Green
    '1200': '#f59e0b'  // 20m - Amber
  }
};

export default PowerCurveConfig;