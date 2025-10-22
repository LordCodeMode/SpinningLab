// ============================================
// FILE: pages/critical-power/config.js
// Critical Power Page Configuration
// ============================================

export default {
  id: 'critical-power',
  title: 'Critical Power',
  subtitle: 'CP & W\' physiological model',
  icon: 'target',
  description: 'Two-parameter power-duration model comparing theoretical predictions with actual performance',
  dataRequirements: { 
    criticalPower: true,
    powerCurve: true 
  },
  cache: { 
    enabled: true, 
    duration: 5 * 60 * 1000 
  },
  
  // Chart configuration
  chart: {
    colors: {
      actual: '#8b5cf6',
      model: '#3b82f6',
      difference: '#f59e0b'
    },
    durations: [
      1, 2, 3, 5, 10, 15, 20, 30, 45, 60, 
      90, 120, 180, 300, 600, 900, 1200, 
      1800, 2400, 3000, 3600
    ]
  },
  
  // Metric thresholds for insights
  thresholds: {
    cpPerKg: {
      elite: 5.5,
      competitive: 4.5,
      trained: 3.5
    },
    wPrime: {
      high: 25000,
      moderate: 18000,
      low: 12000
    },
    fitQuality: {
      excellent: 0.95,
      good: 0.90,
      acceptable: 0.85
    }
  }
};