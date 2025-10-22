// ============================================
// FILE: static/js/services/InsightService.js
// AI-powered insights and recommendations generation
// ============================================

import CONFIG from '../core/config.js';

class InsightService {
  constructor() {
    this.thresholds = CONFIG.TSB_THRESHOLDS;
  }

  // ========== TRAINING LOAD INSIGHTS ==========

  /**
   * Generate insights from training load data
   * @param {Object} data - Training load data with current and daily
   * @returns {Array<Object>} Array of insight objects
   */
  generateTrainingLoadInsights(data) {
    const insights = [];

    if (!data || !data.current) {
      return insights;
    }

    const { ctl, atl, tsb } = data.current;

    // TSB-based insights
    insights.push(...this.analyzeTSB(tsb, ctl, atl));

    // CTL vs ATL ratio insights
    if (ctl > 0 && atl > 0) {
      const ratio = atl / ctl;
      
      if (ratio > 1.3) {
        insights.push({
          type: 'warning',
          title: 'High Acute Load',
          text: `Your fatigue (ATL: ${atl.toFixed(1)}) is significantly higher than your fitness (CTL: ${ctl.toFixed(1)}). Consider reducing training intensity.`,
          priority: 2,
          category: 'load'
        });
      }
    }

    // Trend analysis from daily data
    if (data.daily && data.daily.length > 7) {
      insights.push(...this.analyzeLoadTrend(data.daily));
    }

    return insights;
  }

  /**
   * Analyze TSB (Training Stress Balance)
   * @param {number} tsb - Current TSB value
   * @param {number} ctl - Current CTL
   * @param {number} atl - Current ATL
   * @returns {Array<Object>} TSB insights
   */
  analyzeTSB(tsb, ctl, atl) {
    const insights = [];

    if (tsb >= this.thresholds.veryFresh) {
      insights.push({
        type: 'success',
        title: 'Peak Freshness',
        text: `You're in peak form (TSB: ${tsb.toFixed(1)})! This is an excellent time for races or peak performances.`,
        priority: 1,
        category: 'form',
        recommendations: [
          'Schedule important events or races',
          'Focus on maintaining form with quality sessions',
          'Avoid building volume too quickly'
        ]
      });
    } else if (tsb >= this.thresholds.fresh) {
      insights.push({
        type: 'success',
        title: 'Fresh and Ready',
        text: `You're well-rested (TSB: ${tsb.toFixed(1)}). Good form for hard training or events.`,
        priority: 2,
        category: 'form'
      });
    } else if (tsb >= this.thresholds.neutral) {
      insights.push({
        type: 'info',
        title: 'Neutral Form',
        text: `You're in a neutral training state (TSB: ${tsb.toFixed(1)}). Balanced between fitness and fatigue.`,
        priority: 3,
        category: 'form'
      });
    } else if (tsb >= this.thresholds.fatigued) {
      insights.push({
        type: 'warning',
        title: 'Building Fatigue',
        text: `You're accumulating fatigue (TSB: ${tsb.toFixed(1)}). Consider adding recovery days soon.`,
        priority: 2,
        category: 'recovery',
        recommendations: [
          'Plan recovery days in next 3-5 days',
          'Reduce training intensity',
          'Focus on sleep and nutrition'
        ]
      });
    } else if (tsb >= this.thresholds.veryFatigued) {
      insights.push({
        type: 'warning',
        title: 'Significant Fatigue',
        text: `You're heavily fatigued (TSB: ${tsb.toFixed(1)}). Recovery should be prioritized now.`,
        priority: 1,
        category: 'recovery',
        recommendations: [
          'Take 2-3 easy days immediately',
          'Reduce volume by 40-50%',
          'Monitor for overtraining symptoms'
        ]
      });
    } else {
      insights.push({
        type: 'danger',
        title: 'Critical Fatigue',
        text: `You're in deep fatigue (TSB: ${tsb.toFixed(1)}). Immediate recovery required to avoid overtraining.`,
        priority: 1,
        category: 'recovery',
        recommendations: [
          'Take 3-5 complete rest days',
          'Consult with coach if available',
          'Monitor health markers closely',
          'Consider professional guidance'
        ]
      });
    }

    return insights;
  }

  /**
   * Analyze training load trend
   * @param {Array} daily - Daily training load data
   * @returns {Array<Object>} Trend insights
   */
  analyzeLoadTrend(daily) {
    const insights = [];
    const recent = daily.slice(-7);
    const older = daily.slice(-14, -7);

    if (recent.length < 7 || older.length < 7) {
      return insights;
    }

    // Calculate average CTL change
    const recentAvgCTL = recent.reduce((sum, d) => sum + d.ctl, 0) / recent.length;
    const olderAvgCTL = older.reduce((sum, d) => sum + d.ctl, 0) / older.length;
    const ctlChange = ((recentAvgCTL - olderAvgCTL) / olderAvgCTL) * 100;

    if (ctlChange > 5) {
      insights.push({
        type: 'info',
        title: 'Fitness Building',
        text: `Your fitness (CTL) has increased ${ctlChange.toFixed(1)}% over the past two weeks. Consistent progress!`,
        priority: 3,
        category: 'progress'
      });
    } else if (ctlChange < -5) {
      insights.push({
        type: 'info',
        title: 'Fitness Declining',
        text: `Your fitness (CTL) has decreased ${Math.abs(ctlChange).toFixed(1)}% over the past two weeks. Consider increasing training load if intentional taper is not planned.`,
        priority: 3,
        category: 'progress'
      });
    }

    return insights;
  }

  // ========== POWER CURVE INSIGHTS ==========

  /**
   * Generate insights from power curve analysis
   * @param {Object} data - Power curve data
   * @param {Object} settings - User settings (FTP, weight)
   * @returns {Array<Object>} Array of insight objects
   */
  generatePowerCurveInsights(data, settings) {
    const insights = [];

    if (!data || !data.durations || !data.powers || !settings) {
      return insights;
    }

    // Analyze power profile
    const profile = this.analyzePowerProfile(data, settings);
    insights.push(...profile);

    // Compare to benchmarks
    if (settings.ftp) {
      const benchmarks = this.compareToBenchmarks(data, settings.ftp, settings.weight);
      insights.push(...benchmarks);
    }

    return insights;
  }

  /**
   * Analyze athlete's power profile
   * @param {Object} data - Power curve data
   * @param {Object} settings - User settings
   * @returns {Array<Object>} Profile insights
   */
  analyzePowerProfile(data, settings) {
    const insights = [];

    // Find indices for key durations
    const indices = {
      sprint: data.durations.indexOf(5),
      minute: data.durations.indexOf(60),
      fiveMin: data.durations.indexOf(300),
      twentyMin: data.durations.indexOf(1200)
    };

    if (indices.sprint >= 0 && indices.twentyMin >= 0) {
      const sprintPower = data.powers[indices.sprint];
      const ftpProxy = data.powers[indices.twentyMin];
      
      if (ftpProxy > 0) {
        const sprintRatio = sprintPower / ftpProxy;
        
        if (sprintRatio > 7) {
          insights.push({
            type: 'success',
            title: 'Elite Sprinter',
            text: `Your 5-second power is ${sprintRatio.toFixed(1)}x your FTP. You have exceptional sprint capabilities!`,
            priority: 2,
            category: 'profile'
          });
        } else if (sprintRatio > 5) {
          insights.push({
            type: 'info',
            title: 'Strong Sprinter',
            text: `Your 5-second power is ${sprintRatio.toFixed(1)}x your FTP. Good sprint potential with room to develop.`,
            priority: 3,
            category: 'profile'
          });
        }
      }
    }

    return insights;
  }

  /**
   * Compare power to benchmarks
   * @param {Object} data - Power curve data
   * @param {number} ftp - Functional Threshold Power
   * @param {number} weight - Body weight in kg
   * @returns {Array<Object>} Benchmark insights
   */
  compareToBenchmarks(data, ftp, weight) {
    const insights = [];

    if (!weight) return insights;

    const ftpWkg = ftp / weight;

    // Recreational benchmarks (W/kg)
    const benchmarks = {
      worldClass: 6.0,
      elite: 5.0,
      excellent: 4.0,
      good: 3.5,
      moderate: 3.0
    };

    let level = 'beginner';
    if (ftpWkg >= benchmarks.worldClass) level = 'world-class';
    else if (ftpWkg >= benchmarks.elite) level = 'elite';
    else if (ftpWkg >= benchmarks.excellent) level = 'excellent';
    else if (ftpWkg >= benchmarks.good) level = 'good';
    else if (ftpWkg >= benchmarks.moderate) level = 'moderate';

    insights.push({
      type: 'info',
      title: `Power Profile: ${level.charAt(0).toUpperCase() + level.slice(1)}`,
      text: `Your FTP of ${ftpWkg.toFixed(2)} W/kg places you in the ${level} category.`,
      priority: 3,
      category: 'benchmark'
    });

    return insights;
  }

  // ========== EFFICIENCY INSIGHTS ==========

  /**
   * Generate insights from efficiency analysis
   * @param {Object} data - Efficiency data
   * @returns {Array<Object>} Array of insight objects
   */
  generateEfficiencyInsights(data) {
    const insights = [];

    if (!data || !data.current_ef) {
      return insights;
    }

    const { current_ef, avg_ef, trend } = data;

    // Current EF analysis
    if (current_ef > 1.0) {
      insights.push({
        type: 'success',
        title: 'Excellent Efficiency',
        text: `Your current efficiency factor (${current_ef.toFixed(2)}) indicates excellent aerobic fitness. Power output is well-supported by cardiovascular system.`,
        priority: 2,
        category: 'efficiency'
      });
    } else if (current_ef >= 0.85) {
      insights.push({
        type: 'info',
        title: 'Good Efficiency',
        text: `Your efficiency factor of ${current_ef.toFixed(2)} is in the good range. Continue building aerobic base.`,
        priority: 3,
        category: 'efficiency'
      });
    } else if (current_ef >= 0.70) {
      insights.push({
        type: 'warning',
        title: 'Moderate Efficiency',
        text: `Your efficiency factor of ${current_ef.toFixed(2)} suggests room for aerobic development. Focus on Zone 2 endurance work.`,
        priority: 2,
        category: 'efficiency',
        recommendations: [
          'Increase Zone 2 training volume',
          'Focus on longer, steady rides',
          'Monitor heart rate drift in long sessions'
        ]
      });
    }

    // Trend analysis
    if (trend) {
      if (trend === 'improving') {
        insights.push({
          type: 'success',
          title: 'Efficiency Improving',
          text: 'Your efficiency factor is trending upward. Your training is paying off!',
          priority: 3,
          category: 'progress'
        });
      } else if (trend === 'declining') {
        insights.push({
          type: 'warning',
          title: 'Efficiency Declining',
          text: 'Your efficiency factor is trending downward. This may indicate fatigue or training stress.',
          priority: 2,
          category: 'recovery'
        });
      }
    }

    return insights;
  }

  // ========== FITNESS STATE INSIGHTS ==========

  /**
   * Generate insights from fitness state analysis
   * @param {Object} data - Fitness state data
   * @returns {Array<Object>} Array of insight objects
   */
  generateFitnessStateInsights(data) {
    const insights = [];

    if (!data || !data.status) {
      return insights;
    }

    const typeMap = {
      peak: 'success',
      optimal: 'success',
      good: 'info',
      overreaching: 'warning',
      fatigued: 'warning',
      unknown: 'info'
    };

    insights.push({
      type: typeMap[data.status] || 'info',
      title: `Fitness State: ${data.status.charAt(0).toUpperCase() + data.status.slice(1)}`,
      text: data.status_description,
      priority: 1,
      category: 'state',
      recommendations: data.recommendations || []
    });

    return insights;
  }

  // ========== ZONE DISTRIBUTION INSIGHTS ==========

  /**
   * Generate insights from zone distribution
   * @param {Array} zones - Zone distribution data
   * @param {string} model - Training model (polarized, pyramidal, threshold)
   * @returns {Array<Object>} Array of insight objects
   */
  generateZoneInsights(zones, model = 'polarized') {
    const insights = [];

    if (!zones || zones.length === 0) {
      return insights;
    }

    // Calculate total time
    const totalSeconds = zones.reduce((sum, z) => sum + (z.seconds || z.seconds_in_zone), 0);
    
    if (totalSeconds === 0) {
      return insights;
    }

    // Calculate zone percentages
    const z1Pct = this.getZonePercentage(zones, 0, totalSeconds);
    const z2Pct = this.getZonePercentage(zones, 1, totalSeconds);
    const z3Pct = this.getZonePercentage(zones, 2, totalSeconds);
    const z4Pct = this.getZonePercentage(zones, 3, totalSeconds);
    const z5PlusPct = 100 - (z1Pct + z2Pct + z3Pct + z4Pct);

    // Low intensity (Z1 + Z2)
    const lowIntensity = z1Pct + z2Pct;
    
    // High intensity (Z4+)
    const highIntensity = z4Pct + z5PlusPct;

    // Polarized model analysis (80% low, 20% high, minimal Z3)
    if (model === 'polarized') {
      if (lowIntensity >= 75 && highIntensity >= 15 && z3Pct < 15) {
        insights.push({
          type: 'success',
          title: 'Well-Polarized Training',
          text: `Your training distribution (${lowIntensity.toFixed(0)}% easy, ${z3Pct.toFixed(0)}% moderate, ${highIntensity.toFixed(0)}% hard) follows the polarized model well.`,
          priority: 2,
          category: 'distribution'
        });
      } else if (z3Pct > 20) {
        insights.push({
          type: 'warning',
          title: 'Too Much Moderate Intensity',
          text: `You're spending ${z3Pct.toFixed(0)}% of time in Zone 3. For polarized training, aim for <15%. Either go easier or harder.`,
          priority: 2,
          category: 'distribution',
          recommendations: [
            'Reduce Zone 3 intensity work',
            'Make easy days truly easy (Z1-Z2)',
            'Make hard days properly hard (Z4-Z5)'
          ]
        });
      }
    }

    return insights;
  }

  /**
   * Get percentage of time in specific zone
   * @param {Array} zones - Zone data
   * @param {number} index - Zone index
   * @param {number} totalSeconds - Total time
   * @returns {number} Percentage
   */
  getZonePercentage(zones, index, totalSeconds) {
    if (!zones[index] || totalSeconds === 0) return 0;
    const seconds = zones[index].seconds || zones[index].seconds_in_zone || 0;
    return (seconds / totalSeconds) * 100;
  }

  // ========== HELPER METHODS ==========

  /**
   * Sort insights by priority
   * @param {Array<Object>} insights - Array of insights
   * @returns {Array<Object>} Sorted insights
   */
  sortByPriority(insights) {
    return insights.sort((a, b) => (a.priority || 999) - (b.priority || 999));
  }

  /**
   * Filter insights by type
   * @param {Array<Object>} insights - Array of insights
   * @param {string} type - Insight type
   * @returns {Array<Object>} Filtered insights
   */
  filterByType(insights, type) {
    return insights.filter(i => i.type === type);
  }

  /**
   * Filter insights by category
   * @param {Array<Object>} insights - Array of insights
   * @param {string} category - Category name
   * @returns {Array<Object>} Filtered insights
   */
  filterByCategory(insights, category) {
    return insights.filter(i => i.category === category);
  }

  /**
   * Get highest priority insights
   * @param {Array<Object>} insights - Array of insights
   * @param {number} count - Number of insights to return
   * @returns {Array<Object>} Top insights
   */
  getTopInsights(insights, count = 3) {
    return this.sortByPriority(insights).slice(0, count);
  }
}

// Create singleton instance
const insightService = new InsightService();

// Make available globally for debugging
if (typeof window !== 'undefined') {
  window.insightService = insightService;
}

export { InsightService };
export default insightService;