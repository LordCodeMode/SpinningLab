// ============================================
// FILE: static/js/services/ChartService.js
// Chart.js data preparation and formatting
// ============================================

import CONFIG from '../core/config.js';

class ChartService {
  constructor() {
    this.colors = CONFIG.CHART_COLORS;
  }

  // ========== TRAINING LOAD CHARTS ==========

  /**
   * Prepare training load data for Chart.js line chart
   * @param {Array} data - Training load daily data
   * @returns {Object} Chart.js dataset configuration
   */
  prepareTrainingLoadChart(data) {
    if (!data || data.length === 0) {
      return this.getEmptyChartData();
    }

    const labels = data.map(d => this.formatDate(d.date));
    
    return {
      labels,
      datasets: [
        {
          label: 'CTL (Fitness)',
          data: data.map(d => d.ctl),
          borderColor: this.colors.primary,
          backgroundColor: this.hexToRgba(this.colors.primary, 0.1),
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: this.colors.primary,
          pointHoverBorderWidth: 2,
          pointHoverBorderColor: '#fff'
        },
        {
          label: 'ATL (Fatigue)',
          data: data.map(d => d.atl),
          borderColor: this.colors.danger,
          backgroundColor: this.hexToRgba(this.colors.danger, 0.1),
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: this.colors.danger,
          pointHoverBorderWidth: 2,
          pointHoverBorderColor: '#fff'
        },
        {
          label: 'TSB (Form)',
          data: data.map(d => d.tsb),
          borderColor: this.colors.warning,
          backgroundColor: this.hexToRgba(this.colors.warning, 0.1),
          borderWidth: 2,
          fill: false,
          tension: 0.4,
          borderDash: [5, 5],
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: this.colors.warning,
          pointHoverBorderWidth: 2,
          pointHoverBorderColor: '#fff'
        }
      ]
    };
  }

  /**
   * Get training load chart options
   * @returns {Object} Chart.js options
   */
  getTrainingLoadChartOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            usePointStyle: true,
            padding: 15,
            font: {
              size: 12,
              weight: '600'
            }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 12,
          titleFont: { size: 13, weight: 'bold' },
          bodyFont: { size: 12 },
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          displayColors: true,
          callbacks: {
            label: (context) => {
              return `${context.dataset.label}: ${context.parsed.y.toFixed(1)}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          },
          ticks: {
            maxRotation: 45,
            minRotation: 45,
            font: { size: 11 }
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(0, 0, 0, 0.05)'
          },
          ticks: {
            font: { size: 11 }
          }
        }
      }
    };
  }

  // ========== POWER CURVE CHARTS ==========

  /**
   * Prepare power curve data for Chart.js
   * @param {Object} data - Power curve data
   * @returns {Object} Chart.js dataset configuration
   */
  preparePowerCurveChart(data) {
    if (!data || !data.durations || !data.powers) {
      return this.getEmptyChartData();
    }

    const labels = data.durations.map(d => this.formatDuration(d));

    return {
      labels,
      datasets: [
        {
          label: data.weighted ? 'Power (W/kg)' : 'Power (W)',
          data: data.powers,
          borderColor: this.colors.gradientPower[0],
          backgroundColor: this.createGradient('power'),
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: this.colors.primary,
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointHoverBackgroundColor: this.colors.primary,
          pointHoverBorderWidth: 3
        }
      ]
    };
  }

  /**
   * Get power curve chart options
   * @param {boolean} weighted - Whether showing watts per kg
   * @returns {Object} Chart.js options
   */
  getPowerCurveChartOptions(weighted = false) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            usePointStyle: true,
            padding: 15,
            font: { size: 12, weight: '600' }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 12,
          callbacks: {
            label: (context) => {
              const value = context.parsed.y.toFixed(weighted ? 2 : 0);
              const unit = weighted ? 'W/kg' : 'W';
              return `Power: ${value} ${unit}`;
            }
          }
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Duration',
            font: { size: 12, weight: 'bold' }
          },
          grid: {
            display: false
          }
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: weighted ? 'Power (W/kg)' : 'Power (W)',
            font: { size: 12, weight: 'bold' }
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.05)'
          }
        }
      }
    };
  }

  // ========== EFFICIENCY CHARTS ==========

  /**
   * Prepare efficiency data for Chart.js
   * @param {Array} data - Efficiency timeseries data
   * @returns {Object} Chart.js dataset configuration
   */
  prepareEfficiencyChart(data) {
    if (!data || data.length === 0) {
      return this.getEmptyChartData();
    }

    const labels = data.map(d => this.formatDate(d.date));

    return {
      labels,
      datasets: [
        {
          label: 'Efficiency Factor',
          data: data.map(d => d.ef),
          borderColor: this.colors.success,
          backgroundColor: this.hexToRgba(this.colors.success, 0.1),
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointHoverRadius: 6,
          pointBackgroundColor: this.colors.success,
          pointBorderColor: '#fff',
          pointBorderWidth: 2
        }
      ]
    };
  }

  // ========== ZONE DISTRIBUTION CHARTS ==========

  /**
   * Prepare zone distribution for Chart.js bar chart
   * @param {Array} zones - Zone data with name and seconds
   * @returns {Object} Chart.js dataset configuration
   */
  prepareZoneDistributionChart(zones) {
    if (!zones || zones.length === 0) {
      return this.getEmptyChartData();
    }

    const labels = zones.map(z => z.name || z.zone_label);
    const hours = zones.map(z => (z.seconds || z.seconds_in_zone) / 3600);

    // Get colors from power zones config
    const colors = zones.map((z, i) => {
      const zoneConfig = CONFIG.POWER_ZONES[i];
      return zoneConfig ? zoneConfig.color : this.colors.primary;
    });

    return {
      labels,
      datasets: [
        {
          label: 'Time (hours)',
          data: hours,
          backgroundColor: colors,
          borderColor: colors.map(c => this.darkenColor(c, 20)),
          borderWidth: 2,
          borderRadius: 6,
          barThickness: 40
        }
      ]
    };
  }

  /**
   * Get zone distribution chart options
   * @returns {Object} Chart.js options
   */
  getZoneDistributionChartOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 12,
          callbacks: {
            label: (context) => {
              const hours = context.parsed.y.toFixed(2);
              const minutes = Math.round((context.parsed.y % 1) * 60);
              return `${Math.floor(parseFloat(hours))}h ${minutes}m`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          },
          ticks: {
            font: { size: 11, weight: '600' }
          }
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Time (hours)',
            font: { size: 12, weight: 'bold' }
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.05)'
          },
          ticks: {
            callback: (value) => value.toFixed(1)
          }
        }
      }
    };
  }

  // ========== VO2MAX CHARTS ==========

  /**
   * Prepare VO2Max trend data for Chart.js
   * @param {Array} data - VO2Max estimates over time
   * @returns {Object} Chart.js dataset configuration
   */
  prepareVO2MaxChart(data) {
    if (!data || data.length === 0) {
      return this.getEmptyChartData();
    }

    const labels = data.map(d => this.formatDate(d.date));

    return {
      labels,
      datasets: [
        {
          label: 'VO2Max (ml/kg/min)',
          data: data.map(d => d.vo2max),
          borderColor: this.colors.info,
          backgroundColor: this.hexToRgba(this.colors.info, 0.1),
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: this.colors.info,
          pointBorderColor: '#fff',
          pointBorderWidth: 2
        }
      ]
    };
  }

  // ========== CRITICAL POWER CHARTS ==========

  /**
   * Prepare critical power model chart
   * @param {Object} data - Critical power data
   * @returns {Object} Chart.js dataset configuration
   */
  prepareCriticalPowerChart(data) {
    if (!data || !data.durations || !data.actual) {
      return this.getEmptyChartData();
    }

    const labels = data.durations.map(d => this.formatDuration(d));

    return {
      labels,
      datasets: [
        {
          label: 'Actual Power',
          data: data.actual,
          borderColor: this.colors.primary,
          backgroundColor: this.colors.primary,
          borderWidth: 0,
          pointRadius: 5,
          pointHoverRadius: 7,
          showLine: false
        },
        {
          label: 'CP Model',
          data: data.predicted,
          borderColor: this.colors.danger,
          backgroundColor: 'transparent',
          borderWidth: 3,
          borderDash: [5, 5],
          pointRadius: 0,
          tension: 0.4
        }
      ]
    };
  }

  // ========== HELPER METHODS ==========

  /**
   * Format date for chart labels
   * @param {string|Date} date - Date to format
   * @returns {string} Formatted date
   */
  formatDate(date) {
    const d = new Date(date);
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${month}/${day}`;
  }

  /**
   * Format duration in seconds to readable string
   * @param {number} seconds - Duration in seconds
   * @returns {string} Formatted duration
   */
  formatDuration(seconds) {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    if (seconds < 7200) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h`;
  }

  /**
   * Convert hex color to rgba
   * @param {string} hex - Hex color
   * @param {number} alpha - Alpha value 0-1
   * @returns {string} RGBA color
   */
  hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  /**
   * Darken a hex color by percentage
   * @param {string} hex - Hex color
   * @param {number} percent - Percentage to darken
   * @returns {string} Darkened hex color
   */
  darkenColor(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) - amt;
    const G = (num >> 8 & 0x00FF) - amt;
    const B = (num & 0x0000FF) - amt;
    return '#' + (
      0x1000000 +
      (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
      (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
      (B < 255 ? (B < 1 ? 0 : B) : 255)
    ).toString(16).slice(1);
  }

  /**
   * Create gradient (placeholder - needs canvas context)
   * @param {string} type - Gradient type
   * @returns {string} Color fallback
   */
  createGradient(type) {
    // This would need canvas context in real implementation
    // Returning solid color as fallback
    const gradients = {
      power: this.colors.gradientPower[0],
      hr: this.colors.gradientHR[0],
      load: this.colors.gradientLoad[0]
    };
    return gradients[type] || this.colors.primary;
  }

  /**
   * Get empty chart data structure
   * @returns {Object} Empty chart data
   */
  getEmptyChartData() {
    return {
      labels: [],
      datasets: []
    };
  }

  /**
   * Get default chart options
   * @returns {Object} Default Chart.js options
   */
  getDefaultChartOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            usePointStyle: true,
            padding: 15,
            font: { size: 12, weight: '600' }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 12,
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(0, 0, 0, 0.05)'
          }
        }
      }
    };
  }

  /**
   * Destroy chart instance safely
   * @param {Object} chart - Chart.js instance
   */
  destroyChart(chart) {
    if (chart && typeof chart.destroy === 'function') {
      chart.destroy();
    }
  }
}

// Create singleton instance
const chartService = new ChartService();

// Make available globally for debugging
if (typeof window !== 'undefined') {
  window.chartService = chartService;
}

export { ChartService };
export default chartService;