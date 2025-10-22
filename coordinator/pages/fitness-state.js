// static/js/coordinator/pages/fitness-state.js
import { AnalysisAPI } from '../../core/api.js';
import { notify } from '../../core/utils.js';

export class FitnessStatePage {
  constructor() {
    this.isLoaded = false;
    this.templateUrl = 'static/js/templates/fitness-state.html';
  }

  async onShow() {
    console.log('[FitnessState] Loading page data');
    await this.loadData();
  }

  onHide() {
    console.log('[FitnessState] Page hidden');
  }

  async loadData() {
    try {
      const fitnessState = await AnalysisAPI.fitnessState();
      
      // Update metrics
      const ctlEl = document.getElementById('fitness-ctl');
      const atlEl = document.getElementById('fitness-atl');
      const tsbEl = document.getElementById('fitness-tsb');
      
      if (ctlEl) ctlEl.textContent = fitnessState.ctl?.toFixed(1) ?? '-';
      if (atlEl) atlEl.textContent = fitnessState.atl?.toFixed(1) ?? '-';
      if (tsbEl) tsbEl.textContent = fitnessState.tsb?.toFixed(1) ?? '-';
      
      // Update status
      const statusEl = document.getElementById('fitness-status');
      if (statusEl) {
        statusEl.textContent = fitnessState.status_description || 'Unknown status';
        statusEl.className = `status-indicator status-${fitnessState.status}`;
      }
      
      // Update recommendations
      const recEl = document.getElementById('fitness-recommendations');
      if (recEl) {
        if (fitnessState.recommendations && fitnessState.recommendations.length > 0) {
          recEl.innerHTML = `
            <h4>Recommendations</h4>
            <ul>${fitnessState.recommendations.map(rec => `<li>${rec}</li>`).join('')}</ul>
          `;
          recEl.style.display = 'block';
        } else {
          recEl.style.display = 'none';
        }
      }
      
      // Update chart placeholders
      const loadChartEl = document.getElementById('fitness-load-chart');
      const efficiencyChartEl = document.getElementById('fitness-efficiency-chart');
      
      if (loadChartEl) {
        loadChartEl.innerHTML = '<div class="no-data">Training Load Chart - Coming Soon</div>';
      }
      
      if (efficiencyChartEl) {
        efficiencyChartEl.innerHTML = '<div class="no-data">Efficiency Chart - Coming Soon</div>';
      }
      
    } catch (error) {
      console.error('Error loading fitness state:', error);
      notify(`Error loading fitness state: ${error.message}`, 'error');
      
      // Reset to default values
      const ctlEl = document.getElementById('fitness-ctl');
      const atlEl = document.getElementById('fitness-atl');
      const tsbEl = document.getElementById('fitness-tsb');
      const statusEl = document.getElementById('fitness-status');
      
      if (ctlEl) ctlEl.textContent = '-';
      if (atlEl) atlEl.textContent = '-';
      if (tsbEl) tsbEl.textContent = '-';
      if (statusEl) {
        statusEl.textContent = 'Unable to determine status';
        statusEl.className = 'status-indicator';
      }
    }
  }

  async refresh() {
    await this.loadData();
  }
}

export const fitnessStatePage = new FitnessStatePage();