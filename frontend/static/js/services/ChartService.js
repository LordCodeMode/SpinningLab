// ============================================
// FILE: static/js/services/ChartService.js
// Chart.js data preparation and formatting
// ============================================

import CONFIG from '../core/config.js';

class ChartService {
  constructor() {
    this.colors = CONFIG.CHART_COLORS;
    this.lastPowerCurveRange = {
      minDuration: 1,
      maxDuration: 3600
    };
  }

  // ========== TRAINING LOAD CHARTS ==========

  /**
   * Prepare training load data for Chart.js line chart
   * @param {Array} data - Training load daily data
   * @returns {Object} Chart.js dataset configuration
   */
  prepareTrainingLoadChart(data, { mode = 'daily' } = {}) {
    if (!data || data.length === 0) {
      return {
        ...this.getEmptyChartData(),
        meta: { mode, hasTss: false, hasDistance: false, labelsDetailed: [] }
      };
    }

    const toNumber = (value) => {
      const num = Number(value);
      return Number.isFinite(num) ? num : 0;
    };

    const labels = data.map(d => d.label || this.formatDate(d.date));
    const labelsDetailed = data.map(d => d.tooltip || d.label || this.formatDetailedDuration(d.date, mode, d.endDate));

    const ctlValues = data.map(d => toNumber(d.ctl));
    const tssValues = data.map(d => toNumber(d.tss));
    const distanceValues = data.map(d => toNumber(d.distance));

    const hasTss = tssValues.some(v => Math.abs(v) > 0.01);
    const hasDistance = distanceValues.some(v => Math.abs(v) > 0.01);

    const datasets = [];

    if (hasTss) {
      datasets.push({
        type: 'bar',
        label: mode === 'weekly' ? 'Weekly TSS' : 'Daily TSS',
        data: tssValues,
        backgroundColor: this.hexToRgba(this.colors.warning, 0.35),
        borderColor: this.hexToRgba(this.colors.warning, 0.7),
        borderWidth: 1,
        borderRadius: 6,
        barPercentage: 0.6,
        categoryPercentage: 0.7,
        yAxisID: 'y1',
        order: 1
      });
    }

    datasets.push({
      label: 'CTL (Fitness)',
      data: ctlValues,
      borderColor: this.colors.primary,
      backgroundColor: this.hexToRgba(this.colors.primary, 0.08),
      borderWidth: 3,
      fill: false,
      tension: 0.35,
      pointRadius: 0,
      pointHoverRadius: 5,
      pointHoverBackgroundColor: this.colors.primary,
      pointHoverBorderWidth: 2,
      pointHoverBorderColor: '#fff',
      cubicInterpolationMode: 'monotone',
      yAxisID: 'y',
      order: 2
    });

    if (hasDistance) {
      datasets.push({
        label: mode === 'weekly' ? 'Weekly Distance (km)' : 'Distance (km)',
        data: distanceValues.map(v => Number(v.toFixed(3))),
        borderColor: this.colors.info,
        backgroundColor: this.hexToRgba(this.colors.info, 0.08),
        borderWidth: 3,
        fill: false,
        tension: 0.35,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: this.colors.info,
        pointHoverBorderWidth: 2,
        pointHoverBorderColor: '#fff',
        cubicInterpolationMode: 'monotone',
        yAxisID: hasTss ? 'y2' : 'y1',
        order: hasTss ? 3 : 2
      });
    }

    return {
      labels,
      datasets,
      meta: {
        mode,
        hasTss,
        hasDistance,
        labelsDetailed
      }
    };
  }

  /**
   * Get training load chart options
   * @returns {Object} Chart.js options
   */
  getTrainingLoadChartOptions(meta = {}) {
    const {
      hasTss = false,
      hasDistance = false,
      mode = 'daily',
      labelsDetailed = []
    } = meta;

    const tssAxisId = 'y1';
    const distanceAxisId = hasTss ? 'y2' : 'y1';

    const scales = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      layout: {
        padding: {
          top: 12,
          right: 18,
          bottom: 6,
          left: 12
        }
      },
      elements: {
        line: {
          borderJoinStyle: 'round',
          borderCapStyle: 'round'
        },
        point: {
          radius: 0,
          hitRadius: 12,
          hoverRadius: 6
        }
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
            title: (items) => {
              if (!items?.length) return '';
              const index = items[0].dataIndex;
              return labelsDetailed[index] || items[0].label;
            },
            label: (context) => {
              const axis = context.dataset.yAxisID || 'y';
              const value = context.parsed.y;
              if (axis === tssAxisId) {
                return `${context.dataset.label}: ${Math.round(value)} TSS`;
              }
              if (hasDistance && axis === distanceAxisId && context.dataset.label?.toLowerCase().includes('distance')) {
                const formatted = Math.abs(value) >= 10 ? value.toFixed(1) : value.toFixed(2);
                return `${context.dataset.label}: ${formatted} km`;
              }
              return `${context.dataset.label}: ${value.toFixed(1)}`;
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
          },
          title: {
            display: true,
            text: 'CTL (Fitness)',
            font: { size: 12, weight: '600' },
            color: '#475569'
          }
        }
      }
    };

    if (hasTss) {
      scales.scales.y1 = {
        position: 'right',
        beginAtZero: true,
        grid: {
          drawOnChartArea: false
        },
        ticks: {
          font: { size: 11 },
          color: this.colors.warning,
          callback: (value) => Math.round(value)
        },
        title: {
          display: true,
          text: mode === 'weekly' ? 'Weekly TSS' : 'Daily TSS',
          font: { size: 12, weight: '600' },
          color: this.colors.warning
        }
      };
    }

    if (hasDistance) {
      scales.scales[distanceAxisId] = {
        position: 'right',
        beginAtZero: true,
        offset: hasTss,
        grid: {
          drawOnChartArea: false
        },
        ticks: {
          font: { size: 11 },
          color: this.colors.info,
          callback: (value) => (Math.abs(value) >= 10 ? value.toFixed(1) : value.toFixed(2))
        },
        title: {
          display: true,
          text: mode === 'weekly' ? 'Weekly Distance (km)' : 'Distance (km)',
          font: { size: 12, weight: '600' },
          color: this.colors.info
        }
      };
    }

    return scales;
  }

  // ========== POWER CURVE CHARTS ==========

  /**
   * Prepare power curve data for Chart.js
   * @param {Object} data - Power curve data
   * @returns {Object} Chart.js dataset configuration
   */
  preparePowerCurveChart(data) {
    if (!data || !Array.isArray(data.durations) || !Array.isArray(data.powers)) {
      return this.getEmptyChartData();
    }

    const maxLength = Math.min(data.durations.length, data.powers.length);
    const points = [];

    for (let i = 0; i < maxLength; i += 1) {
      const duration = Number(data.durations[i]);
      const power = Number(data.powers[i]);

      if (!Number.isFinite(duration) || !Number.isFinite(power) || duration <= 0) {
        continue;
      }

      points.push({ x: Math.max(1, duration), y: power });
    }

    if (points.length === 0) {
      return this.getEmptyChartData();
    }

    points.sort((a, b) => a.x - b.x);

    const durations = points.map(point => point.x);

    this.lastPowerCurveRange = {
      minDuration: durations[0],
      maxDuration: durations[durations.length - 1]
    };

    return {
      labels: durations,
      datasets: [
        {
          label: data.weighted ? 'Power (W/kg)' : 'Power (W)',
          data: points,
          parsing: false,
          borderColor: this.colors.primary,
          backgroundColor: this.hexToRgba(this.colors.primary, 0.12),
          borderWidth: 3,
          fill: true,
          tension: 0.35,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointBackgroundColor: '#fff',
          pointBorderColor: this.colors.primary,
          pointBorderWidth: 3,
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderWidth: 4,
          spanGaps: false
        }
      ],
      meta: {
        durations,
        formattedLabels: durations.map(d => this.formatDuration(d))
      }
    };
  }

  /**
   * Get power curve chart options
   * @param {boolean} weighted - Whether showing watts per kg
   * @returns {Object} Chart.js options
   */
  getPowerCurveChartOptions(weighted = false) {
    const minDuration = Math.max(1, this.lastPowerCurveRange?.minDuration || 1);
    const maxDuration = Math.max(minDuration, this.lastPowerCurveRange?.maxDuration || 3600);

    const tickCandidates = [
      1, 2, 3, 5, 10, 15, 20, 30,
      45, 60, 90, 120, 180, 300,
      600, 900, 1200, 1800, 2400, 3600,
      5400, 7200, 10800, 14400
    ];

    while (tickCandidates[tickCandidates.length - 1] < maxDuration) {
      tickCandidates.push(tickCandidates[tickCandidates.length - 1] * 2);
    }

    const filteredTicks = tickCandidates.filter(value => value >= minDuration && value <= maxDuration * 1.1);

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      parsing: false,
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            usePointStyle: false,
            padding: 15,
            font: { size: 12, weight: '600' },
            color: '#4b5563'
          }
        },
        tooltip: {
          backgroundColor: 'rgba(30, 41, 59, 0.95)',
          titleColor: '#e2e8f0',
          bodyColor: '#e2e8f0',
          borderColor: this.hexToRgba(this.colors.primary, 0.4),
          borderWidth: 1,
          padding: 14,
          displayColors: false,
          callbacks: {
            title: (items) => {
              if (!items?.length) return '';
              const seconds = items[0].parsed.x;
              return this.formatDurationDetail(seconds);
            },
            label: (context) => {
              const power = context.parsed.y;
              if (power == null) return '';
              const unit = weighted ? 'W/kg' : 'W';
              return `Power: ${power.toFixed(weighted ? 2 : 0)} ${unit}`;
            }
          }
        }
      },
      scales: {
        x: {
          type: 'logarithmic',
          min: minDuration,
          max: maxDuration * 1.05,
          title: {
            display: true,
            text: 'Duration',
            font: { size: 12, weight: 'bold' }
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.04)',
            lineWidth: 1,
            drawBorder: false
          },
          ticks: {
            callback: (value) => this.formatDuration(value),
            maxRotation: 0,
            minRotation: 0,
            autoSkip: false,
            padding: 10,
            color: '#6b7280',
            font: { size: 12, weight: '500' }
          },
          afterBuildTicks: (scale) => {
            const ticks = filteredTicks.map(value => ({ value }));
            const unique = [];
            const used = new Set();
            ticks.forEach(tick => {
              if (!used.has(tick.value)) {
                unique.push(tick);
                used.add(tick.value);
              }
            });
            scale.ticks = unique;
            return scale.ticks;
          }
        },
        y: {
          beginAtZero: false,
          title: {
            display: true,
            text: weighted ? 'Power (W/kg)' : 'Power (W)',
            font: { size: 12, weight: 'bold' },
            color: '#4b5563'
          },
          grid: {
            color: 'rgba(148, 163, 184, 0.12)',
            drawBorder: false
          },
          ticks: {
            color: '#6b7280',
            font: { size: 12, weight: '500' },
            padding: 8
          }
        }
      }
    };
    return options;
  }

  // ========== EFFICIENCY CHARTS ==========

  /**
   * Prepare efficiency data for Chart.js
   * @param {Array} data - Efficiency timeseries data
   * @returns {Object} Chart.js dataset configuration
   */
  prepareEfficiencyChart(data, { includeRolling = true, rollingWindow = 5 } = {}) {
    if (!Array.isArray(data) || data.length === 0) {
      return {
        ...this.getEmptyChartData(),
        meta: { hasRolling: false, hasIntensity: false }
      };
    }

    const sorted = [...data].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    const labels = sorted.map(d => this.formatDate(d.date));
    const efficiencyValues = sorted.map(d => d.ef);

    const datasets = [
      {
        label: 'Efficiency Factor',
        data: efficiencyValues,
        borderColor: this.colors.success,
        backgroundColor: this.hexToRgba(this.colors.success, 0.12),
        borderWidth: 3,
        fill: false,
        tension: 0.35,
        pointRadius: 3,
        pointHoverRadius: 6,
        pointBackgroundColor: this.colors.success,
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        yAxisID: 'y'
      }
    ];

    let hasRolling = false;
    if (includeRolling && sorted.length >= rollingWindow) {
      const rolling = this.calculateRollingAverage(efficiencyValues, rollingWindow);
      datasets.push({
        label: `${rollingWindow}-Session Avg`,
        data: rolling,
        borderColor: this.colors.info,
        backgroundColor: 'transparent',
        borderWidth: 2,
        fill: false,
        tension: 0.2,
        pointRadius: 0,
        borderDash: [6, 4],
        yAxisID: 'y'
      });
      hasRolling = true;
    }

    const intensityValues = sorted.map(d => d.intensityFactor ?? null);
    const hasIntensity = intensityValues.some(v => Number.isFinite(v));

    if (hasIntensity) {
      datasets.push({
        type: 'bar',
        label: 'Intensity Factor (IF)',
        data: intensityValues.map(v => Number.isFinite(v) ? v : null),
        backgroundColor: this.hexToRgba(this.colors.primary, 0.25),
        borderColor: this.hexToRgba(this.colors.primary, 0.6),
        borderWidth: 1,
        borderRadius: 4,
        yAxisID: 'y1',
        order: 0,
        barPercentage: 0.65,
        categoryPercentage: 0.75
      });
    }

    return {
      labels,
      datasets,
      meta: {
        hasRolling,
        hasIntensity,
        rollingWindow,
        labelsDetailed: sorted.map(d => this.formatDateLong(d.date)),
        timeseries: sorted
      }
    };
  }

  calculateRollingAverage(values, window) {
    const result = [];
    for (let i = 0; i < values.length; i++) {
      if (!Number.isFinite(values[i])) {
        result.push(null);
        continue;
      }

      const start = Math.max(0, i - window + 1);
      const slice = values.slice(start, i + 1).filter(v => Number.isFinite(v));
      if (slice.length < window) {
        result.push(null);
      } else {
        const avg = slice.reduce((sum, v) => sum + v, 0) / slice.length;
        result.push(Number(avg.toFixed(3)));
      }
    }
    return result;
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

  formatDateLong(date) {
    const d = new Date(date);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  getEfficiencyChartOptions(meta = {}) {
    const { hasRolling = false, hasIntensity = false, timeseries = [], labelsDetailed = [] } = meta;

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      layout: {
        padding: {
          top: 12,
          right: 20,
          bottom: 6,
          left: 10
        }
      },
      elements: {
        line: {
          borderJoinStyle: 'round',
          borderCapStyle: 'round'
        },
        point: {
          radius: 3,
          hitRadius: 10,
          hoverRadius: 6
        }
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            usePointStyle: true,
            padding: 14,
            font: { size: 12, weight: '600' }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          padding: 12,
          borderColor: this.hexToRgba(this.colors.primary, 0.3),
          borderWidth: 1,
          displayColors: true,
          callbacks: {
            title: (items) => {
              if (!items?.length) return '';
              const index = items[0].dataIndex;
              return labelsDetailed[index] || items[0].label;
            },
            label: (context) => {
              const value = Number(context.parsed.y);
              if (context.dataset.label?.includes('Intensity')) {
                return `${context.dataset.label}: ${value.toFixed(2)}`;
              }
              if (context.dataset.label?.includes('Avg')) {
                return `${context.dataset.label}: ${value.toFixed(3)}`;
              }
              return `${context.dataset.label}: ${value.toFixed(3)}`;
            },
            afterBody: (items) => {
              if (!items?.length) return '';
              const index = items[0].dataIndex;
              const sample = timeseries[index];
              if (!sample) return '';
              const lines = [];
              if (Number.isFinite(sample.np)) lines.push(`NP: ${sample.np.toFixed(0)} W`);
              if (Number.isFinite(sample.hr)) lines.push(`HR: ${sample.hr.toFixed(0)} bpm`);
              if (Number.isFinite(sample.intensityFactor)) lines.push(`IF: ${sample.intensityFactor.toFixed(2)}`);
              return lines.length ? `\n${lines.join(' · ')}` : '';
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            maxRotation: 45,
            minRotation: 0,
            font: { size: 11 }
          }
        },
        y: {
          beginAtZero: false,
          grid: { color: 'rgba(148, 163, 184, 0.14)' },
          title: {
            display: true,
            text: 'Efficiency Factor',
            font: { size: 12, weight: '600' },
            color: '#425466'
          }
        },
        y1: hasIntensity ? {
          position: 'right',
          beginAtZero: false,
          grid: { drawOnChartArea: false },
          ticks: {
            font: { size: 11 },
            color: this.colors.primary,
            callback: (value) => value.toFixed(2)
          },
          title: {
            display: true,
            text: 'Intensity Factor',
            font: { size: 12, weight: '600' },
            color: this.colors.primary
          }
        } : undefined
      }
    };

    if (!hasIntensity && options.scales?.y1) {
      delete options.scales.y1;
    }

    return options;
  }

  /**
   * Format duration in seconds to readable string
   * @param {number} seconds - Duration in seconds
   * @returns {string} Formatted duration
   */
  formatDuration(seconds) {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      if (remainingSeconds === 0) return `${minutes}m`;
      if (minutes < 10) return `${minutes}m ${remainingSeconds}s`;
      return `${minutes}m`;
    }
    const hours = Math.floor(seconds / 3600);
    const remainingMinutes = Math.round((seconds % 3600) / 60);
    if (remainingMinutes === 0) return `${hours}h`;
    if (remainingMinutes < 10) return `${hours}h ${remainingMinutes}m`;
    return `${hours}h`;
  }

  /**
   * Format duration with minutes/seconds detail
   * @param {number} seconds - Duration in seconds
   * @returns {string} Detailed duration string
   */
  formatDurationDetail(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) {
      return '';
    }

    const wholeSeconds = Math.round(seconds);

    if (wholeSeconds < 60) {
      return `${wholeSeconds}s`;
    }

    const minutes = Math.floor(wholeSeconds / 60);
    const remainingSeconds = wholeSeconds % 60;

    if (minutes < 60) {
      return remainingSeconds === 0 ? `${minutes}m` : `${minutes}m ${remainingSeconds}s`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0 && remainingSeconds === 0) {
      return `${hours}h`;
    }

    const minutePart = remainingMinutes > 0 ? `${remainingMinutes}m` : '';
    const secondPart = remainingSeconds > 0 ? `${remainingSeconds}s` : '';
    return `${hours}h ${minutePart}${minutePart && secondPart ? ' ' : ''}${secondPart}`.trim();
  }

  formatDetailedDuration(date, mode = 'daily', endDate = null) {
    const ensureDate = (value) => {
      if (value instanceof Date) return value;
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    const start = ensureDate(date);
    if (!start) return String(date ?? '');

    const options = { month: 'short', day: 'numeric' };
    const startLabel = start.toLocaleDateString(undefined, options);

    if (mode === 'weekly' && endDate) {
      const end = ensureDate(endDate) || start;
      const endLabel = end.toLocaleDateString(undefined, options);
      return `${startLabel} – ${endLabel}`;
    }

    return startLabel;
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
