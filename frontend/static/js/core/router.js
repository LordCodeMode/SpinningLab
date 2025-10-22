// ============================================
// FILE: static/js/core/router.js
// UPDATED: Integrated with state.js and eventBus.js
// ============================================

import { eventBus, EVENTS } from './eventBus.js';
import { state } from './state.js';

export class Router {
    constructor() {
        this.pages = new Map();
        this.currentPage = null;
        this.isNavigating = false;
    }

    registerPage(name, pageModule) {
        this.pages.set(name, pageModule);
        console.log(`[Router] Registered page: ${name}`);
    }

    async navigateTo(page, updateHistory = true) {
        // Prevent multiple simultaneous navigations
        if (this.isNavigating) {
            console.log(`[Router] Navigation already in progress`);
            return;
        }

        console.log(`[Router] Navigating to: ${page}`);
        
        if (!this.pages.has(page)) {
            console.error(`[Router] Page not found: ${page}`);
            this.showError(`Page "${page}" not found`);
            return;
        }

        this.isNavigating = true;

        try {
            // Emit page unload event for current page
            if (this.currentPage) {
                eventBus.emit(EVENTS.PAGE_UNLOAD, this.currentPage);
                
                // Call onHide lifecycle method if exists
                const currentPageModule = this.pages.get(this.currentPage);
                if (currentPageModule && typeof currentPageModule.onHide === 'function') {
                    try {
                        await currentPageModule.onHide();
                    } catch (error) {
                        console.warn(`[Router] Error in onHide for ${this.currentPage}:`, error);
                    }
                }
            }
            
            // Update URL if needed
            if (updateHistory && location.hash !== `#${page}`) {
                history.pushState({ page }, '', `#${page}`);
            }
            
            // Update navigation UI
            this.updateNavigation(page);
            
            // Update state
            state.setCurrentPage(page);
            
            // Load the page
            await this.loadPage(page);
            
            this.currentPage = page;
            
            // Emit page load event
            eventBus.emit(EVENTS.PAGE_LOAD, page);
            
            console.log(`[Router] Successfully navigated to: ${page}`);
            
        } catch (error) {
            console.error(`[Router] Navigation failed:`, error);
            this.showError(`Failed to load ${page}: ${error.message}`);
            
            // Emit error event
            eventBus.emit(EVENTS.DATA_ERROR, { 
                context: 'navigation', 
                page, 
                error: error.message 
            });
        } finally {
            this.isNavigating = false;
        }
    }

    async loadPage(page) {
        const pageModule = this.pages.get(page);
        
        if (!pageModule) {
            throw new Error(`Page module not found: ${page}`);
        }

        try {
            console.log(`[Router] Loading page module: ${page}`);
            
            // Check if module has a load method
            if (typeof pageModule.load !== 'function') {
                throw new Error(`Page module ${page} does not have a load() method`);
            }
            
            // Call onShow lifecycle method if exists (before load)
            if (typeof pageModule.onShow === 'function') {
                try {
                    await pageModule.onShow();
                } catch (error) {
                    console.warn(`[Router] Error in onShow for ${page}:`, error);
                }
            }
            
            // Load page content
            await pageModule.load();
            
        } catch (error) {
            console.error(`[Router] Error loading page ${page}:`, error);
            throw error;
        }
    }

    updateNavigation(activePage) {
        // Update sidebar navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            const isActive = item.dataset.page === activePage;
            item.classList.toggle('active', isActive);
            
            // Update ARIA attributes for accessibility
            item.setAttribute('aria-current', isActive ? 'page' : 'false');
        });
        
        // Update page title
        this.updatePageTitle(activePage);
        
        // Emit UI event
        eventBus.emit('ui:navigation:updated', { page: activePage });
    }

    updatePageTitle(page) {
        const titleElement = document.getElementById('page-title');
        if (!titleElement) return;
        
        const titles = {
            // Core pages
            'overview': 'Dashboard',
            'activities': 'Activities',
            'upload': 'Upload Files',
            'settings': 'Settings',
            
            // Power Analysis
            'power-curve': 'Power Curve Analysis',
            'critical-power': 'Critical Power',
            'best-powers': 'Best Power Values',
            'zones': 'Power Zones',
            
            // Performance
            'training-load': 'Training Load',
            'hr-zones': 'Heart Rate Zones',
            'vo2max': 'VO2Max Estimation',
            'efficiency': 'Efficiency Analysis',
            
            // Additional
            'fitness-state': 'Fitness State'
        };
        
        const title = titles[page] || this.formatPageName(page);
        titleElement.textContent = title;
        
        // Also update document title
        document.title = `${title} - Training Analytics Pro`;
    }

    formatPageName(page) {
        // Convert kebab-case to Title Case
        return page
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    showLoading() {
        const contentElement = document.getElementById('page-content');
        if (contentElement) {
            contentElement.innerHTML = `
                <div class="loading">
                    <div class="spinner"></div>
                    <p style="margin-top: 16px; color: var(--text-tertiary);">Loading...</p>
                </div>
            `;
        }
        
        state.setLoading(true);
    }

    showError(message) {
        const contentElement = document.getElementById('page-content');
        if (contentElement) {
            contentElement.innerHTML = `
                <div class="no-data">
                    <h3>Error</h3>
                    <p>${message}</p>
                    <button class="btn btn-primary" onclick="location.hash='#overview'">
                        Return to Dashboard
                    </button>
                </div>
            `;
        }
        
        state.setLoading(false);
    }

    async init() {
        console.log('[Router] Initializing...');
        
        // Handle browser back/forward buttons
        window.addEventListener('popstate', (e) => {
            if (e.state && e.state.page) {
                this.navigateTo(e.state.page, false);
            } else {
                const hash = window.location.hash.slice(1);
                if (hash && this.pages.has(hash)) {
                    this.navigateTo(hash, false);
                }
            }
        });
        
        // Get initial page from URL hash or default to overview
        const hash = window.location.hash.slice(1);
        const initialPage = hash && this.pages.has(hash) ? hash : 'overview';
        
        console.log(`[Router] Initial page: ${initialPage}`);
        await this.navigateTo(initialPage, false);
        
        console.log('[Router] Initialization complete');
        
        // Emit router ready event
        eventBus.emit('router:ready');
    }

    // Helper method to get current page
    getCurrentPage() {
        return this.currentPage;
    }

    // Helper method to check if a page exists
    hasPage(page) {
        return this.pages.has(page);
    }

    // Get all registered page names
    getPages() {
        return Array.from(this.pages.keys());
    }

    // Method to refresh current page
    async refresh() {
        if (!this.currentPage) {
            console.warn('[Router] No current page to refresh');
            return;
        }
        
        const pageModule = this.pages.get(this.currentPage);
        
        if (!pageModule) {
            console.error(`[Router] Page module not found: ${this.currentPage}`);
            return;
        }
        
        try {
            console.log(`[Router] Refreshing page: ${this.currentPage}`);
            
            // Emit refresh event
            eventBus.emit(EVENTS.PAGE_REFRESH, this.currentPage);
            
            // Try refresh method first
            if (typeof pageModule.refresh === 'function') {
                await pageModule.refresh();
            } 
            // Fallback to load method
            else if (typeof pageModule.load === 'function') {
                await pageModule.load();
            } else {
                console.warn(`[Router] Page ${this.currentPage} has no refresh or load method`);
            }
            
            console.log(`[Router] Page refreshed: ${this.currentPage}`);
            
        } catch (error) {
            console.error(`[Router] Error refreshing page:`, error);
            eventBus.emit(EVENTS.DATA_ERROR, { 
                context: 'page_refresh', 
                page: this.currentPage, 
                error: error.message 
            });
            throw error;
        }
    }
}

// Create and export singleton instance
export const router = new Router();

// Make available globally for debugging
if (typeof window !== 'undefined') {
    window.router = router;
}

export default router;