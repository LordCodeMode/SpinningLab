// ============================================
// FILE: static/js/core/charts.js
// Chart.js management and configuration
// ============================================

import CONFIG from './config.js';

class ChartManager {
  constructor() {
    this.instances = new Map(); // canvasId -> Chart instance
    this.defaultOptions = {
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
              weight: '500'
            }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 12,
          titleFont: {
            size: 13,
            weight: '600'
          },
          bodyFont: {
            size: 12
          },
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          cornerRadius: 6
        }
      },
      scales: {}
    };
  }
  
  // ========== CHART AVAILABILITY ==========
  
  isChartAvailable() {
    return typeof Chart !== 'undefined';
  }
  
  ensureChartJS() {
    if (!this.isChartAvailable()) {
      throw new Error('Chart.js is not loaded. Please include Chart.js library.');
    }
  }
  
  // ========== CHART CREATION ==========
  
  /**
   * Create a new chart
   * @param {string} canvasId - Canvas element ID
   * @param {string} type - Chart type (line, bar, etc.)
   * @param {Object} data - Chart data
   * @param {Object} options - Chart options
   * @returns {Chart} Chart instance
   */
  create(canvasId, type, data, options = {}) {
    this.ensureChartJS();
    
    // Destroy existing chart if present
    this.destroy(canvasId);
    
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
      console.error(`[Charts] Canvas element not found: ${canvasId}`);
      return null;
    }
    
    const ctx = canvas.getContext('2d');
    const mergedOptions = this.mergeOptions(options);
    
    try {
      const chart = new Chart(ctx, {
        type,
        data,
        options: mergedOptions
      });
      
      this.instances.set(canvasId, chart);
      console.log(`[Charts] Created ${type} chart: ${canvasId}`);
      
      return chart;
      
    } catch (error) {
      console.error(`[Charts] Error creating chart ${canvasId}:`, error);
      return null;
    }
  }
  
  /**
   * Create a line chart
   */
  createLineChart(canvasId, data, options = {}) {
    return this.create(canvasId, 'line', data, {
      ...options,
      options: {
        ...options.options,
        elements: {
          line: {
            tension: 0.4
          },
          point: {
            radius: 3,
            hitRadius: 8,
            hoverRadius: 5
          }
        }
      }
    });
  }
  
  /**
   * Create a bar chart
   */
  createBarChart(canvasId, data, options = {}) {
    return this.create(canvasId, 'bar', data, options);
  }
  
  /**
   * Create a doughnut chart
   */
  createDoughnutChart(canvasId, data, options = {}) {
    return this.create(canvasId, 'doughnut', data, {
      ...options,
      options: {
        ...options.options,
        cutout: '70%'
      }
    });
  }
  
  /**
   * Create a scatter chart
   */
  createScatterChart(canvasId, data, options = {}) {
    return this.create(canvasId, 'scatter', data, options);
  }
  
  // ========== CHART MANAGEMENT ==========
  
  /**
   * Get a chart instance
   * @param {string} canvasId - Canvas element ID
   * @returns {Chart|null}
   */
  get(canvasId) {
    return this.instances.get(canvasId) || null;
  }
  
  /**
   * Update chart data
   * @param {string} canvasId - Canvas element ID
   * @param {Object} newData - New chart data
   */
  update(canvasId, newData) {
    const chart = this.get(canvasId);
    if (!chart) {
      console.warn(`[Charts] Chart not found: ${canvasId}`);
      return;
    }
    
    if (newData.labels) {
      chart.data.labels = newData.labels;
    }
    
    if (newData.datasets) {
      chart.data.datasets = newData.datasets;
    }
    
    chart.update();
  }
  
  /**
   * Destroy a chart
   * @param {string} canvasId - Canvas element ID
   */
  destroy(canvasId) {
    const chart = this.get(canvasId);
    if (chart) {
      chart.destroy();
      this.instances.delete(canvasId);
      console.log(`[Charts] Destroyed chart: ${canvasId}`);
    }
  }
  
  /**
   * Destroy all charts
   */
  destroyAll() {
    this.instances.forEach((chart, id) => {
      chart.destroy();
      console.log(`[Charts] Destroyed chart: ${id}`);
    });
    this.instances.clear();
  }
  
  // ========== HELPERS ==========
  
  mergeOptions(customOptions) {
    return this.deepMerge(this.defaultOptions, customOptions);
  }
  
  deepMerge(target, source) {
    const output = { ...target };
    
    if (this.isObject(target) && this.isObject(source)) {
      Object.keys(source).forEach(key => {
        if (this.isObject(source[key])) {
          if (!(key in target)) {
            Object.assign(output, { [key]: source[key] });
          } else {
            output[key] = this.deepMerge(target[key], source[key]);
          }
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }
    
    return output;
  }
  
  isObject(item) {
    return item && typeof item === 'object' && !Array.isArray(item);
  }
  
  // ========== PRESET CONFIGURATIONS ==========
  
  /**
   * Get configuration for training load chart
   */
  getTrainingLoadConfig(data) {
    return {
      labels: data.labels,
      datasets: [
        {
          label: 'CTL (Fitness)',
          data: data.ctl,
          borderColor: CONFIG.CHART_COLORS.primary,
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4
        },
        {
          label: 'ATL (Fatigue)',
          data: data.atl,
          borderColor: CONFIG.CHART_COLORS.danger,
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4
        },
        {
          label: 'TSB (Form)',
          data: data.tsb,
          borderColor: CONFIG.CHART_COLORS.success,
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4
        }
      ]
    };
  }
  
  /**
   * Get configuration for power curve chart
   */
  getPowerCurveConfig(data) {
    return {
      labels: data.labels,
      datasets: [
        {
          label: 'Power (W)',
          data: data.powers,
          borderColor: CONFIG.CHART_COLORS.primary,
          backgroundColor: 'rgba(59, 130, 246, 0.2)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 2,
          pointHoverRadius: 5
        }
      ]
    };
  }
  
  /**
   * Get configuration for heart rate zones chart
   */
  getHRZonesConfig(data) {
    return {
      labels: data.labels,
      datasets: [
        {
          label: 'Time in Zone',
          data: data.values,
          backgroundColor: data.colors || [
            CONFIG.CHART_COLORS.z1,
            CONFIG.CHART_COLORS.z2,
            CONFIG.CHART_COLORS.z3,
            CONFIG.CHART_COLORS.z4,
            CONFIG.CHART_COLORS.z5
          ],
          borderWidth: 0
        }
      ]
    };
  }
  
  /**
   * Get configuration for power zones chart
   */
  getPowerZonesConfig(data) {
    return {
      labels: data.labels,
      datasets: [
        {
          label: 'Time in Zone',
          data: data.values,
          backgroundColor: data.colors || CONFIG.POWER_ZONES.map(z => z.color),
          borderWidth: 0
        }
      ]
    };
  }
  
  // ========== COLOR UTILITIES ==========
  
  /**
   * Get color from config
   */
  getColor(name) {
    return CONFIG.CHART_COLORS[name] || CONFIG.CHART_COLORS.primary;
  }
  
  /**
   * Get gradient
   */
  createGradient(ctx, color1, color2) {
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, color1);
    gradient.addColorStop(1, color2);
    return gradient;
  }
  
  /**
   * Convert hex to rgba
   */
  hexToRgba(hex, alpha = 1) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return hex;
    
    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);
    
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  
  // ========== DEBUG ==========
  
  debug() {
    console.log('[Charts] Active Charts:', Array.from(this.instances.keys()));
    console.log('[Charts] Total Instances:', this.instances.size);
  }
  
  getActiveCharts() {
    return Array.from(this.instances.keys());
  }
}

// Create singleton instance
export const chartManager = new ChartManager();

// Export convenience functions
export const createChart = (id, type, data, options) => 
  chartManager.create(id, type, data, options);

export const createLineChart = (id, data, options) => 
  chartManager.createLineChart(id, data, options);

export const createBarChart = (id, data, options) => 
  chartManager.createBarChart(id, data, options);

export const updateChart = (id, data) => 
  chartManager.update(id, data);

export const destroyChart = (id) => 
  chartManager.destroy(id);

export const destroyAllCharts = () => 
  chartManager.destroyAll();

// Make available globally
if (typeof window !== 'undefined') {
  window.chartManager = chartManager;
}

export default chartManager;