// ============================================
// ACTIVITIES PAGE - Full Implementation
// ============================================

// FILE: pages/activities/index.js
import Services from '../../services/index.js';
import { LoadingSkeleton } from '../../components/ui/index.js';
import CONFIG from './config.js';

class ActivitiesPage {
  constructor() {
    this.config = CONFIG;
    this.activities = [];
    this.currentPage = 0;
    this.limit = 20;
    this.filters = {
      sortBy: 'date',
      sortOrder: 'desc'
    };
  }

  async load() {
    try {
      Services.analytics.trackPageView('activities');
      this.renderLoading();
      
      this.activities = await Services.data.getActivities({ 
        limit: this.limit, 
        skip: this.currentPage * this.limit, 
        forceRefresh: true
      });
      
      this.render();
      this.setupEventListeners();
    } catch (error) {
      Services.analytics.trackError('activities_load', error.message);
      this.renderError(error);
    }
  }

  render() {
    const container = document.getElementById('pageContent');
    
    container.innerHTML = `
      <div class="act-section">
        <div class="act-header">
          <h1>Activities</h1>
          <p>View and analyze your training activities</p>
        </div>

        <!-- Filters -->
        <div class="act-filters">
          <span class="act-filter-label">Sort by:</span>
          <select class="act-filter-select" id="sortBy">
            <option value="date" ${this.filters.sortBy === 'date' ? 'selected' : ''}>Date</option>
            <option value="power" ${this.filters.sortBy === 'power' ? 'selected' : ''}>Avg Power</option>
            <option value="duration" ${this.filters.sortBy === 'duration' ? 'selected' : ''}>Duration</option>
            <option value="distance" ${this.filters.sortBy === 'distance' ? 'selected' : ''}>Distance</option>
          </select>

          <select class="act-filter-select" id="sortOrder">
            <option value="desc" ${this.filters.sortOrder === 'desc' ? 'selected' : ''}>Descending</option>
            <option value="asc" ${this.filters.sortOrder === 'asc' ? 'selected' : ''}>Ascending</option>
          </select>
        </div>

        <!-- Activities Table -->
        <div class="act-table-card">
          ${this.renderTable()}
        </div>

        <!-- Pagination -->
        ${this.renderPagination()}
      </div>
    `;
    
    if (typeof feather !== 'undefined') feather.replace();
  }

  renderTable() {
    if (!this.activities || this.activities.length === 0) {
      return `
        <div class="p-8 text-center text-secondary">
          <svg class="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
          </svg>
          <p>No activities found</p>
        </div>
      `;
    }

    return `
      <table class="act-table">
        <thead>
          <tr>
            <th>Activity Name</th>
            <th>Date</th>
            <th>Duration</th>
            <th>Distance</th>
            <th>Avg Power</th>
            <th>NP</th>
            <th>TSS</th>
          </tr>
        </thead>
        <tbody>
          ${this.activities.map(activity => `
            <tr onclick="window.router.navigateTo('activity/${activity.id}')">
              <td class="act-activity-name">${this.escapeHtml(activity.file_name || 'Untitled Ride')}</td>
              <td>${this.formatDate(activity.start_time)}</td>
              <td>${this.formatDuration(activity.duration)}</td>
              <td>${activity.distance ? activity.distance.toFixed(1) + ' km' : '-'}</td>
              <td>
                <span class="act-metric-badge power">
                  ${activity.avg_power ? Math.round(activity.avg_power) + 'W' : '-'}
                </span>
              </td>
              <td>${activity.normalized_power ? Math.round(activity.normalized_power) + 'W' : '-'}</td>
              <td>${activity.tss ? Math.round(activity.tss) : '-'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  renderPagination() {
    return `
      <div class="act-pagination">
        <button class="btn btn--sm" id="prevPage" ${this.currentPage === 0 ? 'disabled' : ''}>
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
          Previous
        </button>
        <span class="px-4">Page ${this.currentPage + 1}</span>
        <button class="btn btn--sm" id="nextPage" ${this.activities.length < this.limit ? 'disabled' : ''}>
          Next
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
          </svg>
        </button>
      </div>
    `;
  }

  setupEventListeners() {
    // Sort filters
    document.getElementById('sortBy')?.addEventListener('change', (e) => {
      this.filters.sortBy = e.target.value;
      this.applyFilters();
    });
    
    document.getElementById('sortOrder')?.addEventListener('change', (e) => {
      this.filters.sortOrder = e.target.value;
      this.applyFilters();
    });
    
    // Pagination
    document.getElementById('prevPage')?.addEventListener('click', () => this.previousPage());
    document.getElementById('nextPage')?.addEventListener('click', () => this.nextPage());
  }

  applyFilters() {
    // Sort activities locally
    this.activities.sort((a, b) => {
      let comparison = 0;
      switch (this.filters.sortBy) {
        case 'date':
          comparison = new Date(a.start_time) - new Date(b.start_time);
          break;
        case 'power':
          comparison = (a.average_power || 0) - (b.average_power || 0);
          break;
        case 'duration':
          comparison = (a.moving_time || 0) - (b.moving_time || 0);
          break;
        case 'distance':
          comparison = (a.distance || 0) - (b.distance || 0);
          break;
      }
      return this.filters.sortOrder === 'desc' ? -comparison : comparison;
    });
    
    this.render();
    this.setupEventListeners();
  }

  async previousPage() {
    if (this.currentPage > 0) {
      this.currentPage--;
      await this.load();
    }
  }

  async nextPage() {
    this.currentPage++;
    await this.load();
  }

  formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  }

  formatDuration(seconds) {
    if (!seconds) return '-';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  renderLoading() {
    document.getElementById('pageContent').innerHTML = LoadingSkeleton({ type: 'table', count: 1 });
  }

  renderError(error) {
    document.getElementById('pageContent').innerHTML = `
      <div class="error-state">
        <h3>Failed to Load Activities</h3>
        <p>${error.message}</p>
      </div>
    `;
  }

  onUnload() {
    this.activities = [];
  }
}

const activitiesPage = new ActivitiesPage();
export default activitiesPage;
