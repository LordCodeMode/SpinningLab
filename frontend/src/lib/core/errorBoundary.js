/**
 * Error Boundary System
 * Gracefully handle errors and prevent app crashes
 */

class ErrorBoundary {
  constructor() {
    this.errorHandlers = new Map();
    this.globalErrorHandler = null;
    this.setupGlobalHandlers();
  }

  /**
   * Setup global error handlers
   */
  setupGlobalHandlers() {
    // Handle uncaught errors
    window.addEventListener('error', (event) => {
      console.error('[ErrorBoundary] Uncaught error:', event.error);
      this.handleError(event.error, {
        type: 'uncaught',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
      event.preventDefault();
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      console.error('[ErrorBoundary] Unhandled promise rejection:', event.reason);
      this.handleError(event.reason, {
        type: 'promise',
        promise: event.promise
      });
      event.preventDefault();
    });
  }

  /**
   * Register an error handler for a specific scope
   * @param {string} scope - Scope identifier (e.g., 'page:overview', 'api', 'chart')
   * @param {Function} handler - Error handler function
   */
  register(scope, handler) {
    this.errorHandlers.set(scope, handler);
  }

  /**
   * Unregister an error handler
   * @param {string} scope - Scope identifier
   */
  unregister(scope) {
    this.errorHandlers.delete(scope);
  }

  /**
   * Set global error handler (fallback)
   * @param {Function} handler - Global error handler
   */
  setGlobalHandler(handler) {
    this.globalErrorHandler = handler;
  }

  /**
   * Handle an error
   * @param {Error} error - Error object
   * @param {Object} context - Additional context
   */
  handleError(error, context = {}) {
    const errorInfo = {
      message: error?.message || 'Unknown error',
      stack: error?.stack,
      timestamp: new Date().toISOString(),
      ...context
    };

    // Try scope-specific handlers first
    if (context.scope && this.errorHandlers.has(context.scope)) {
      const handler = this.errorHandlers.get(context.scope);
      try {
        handler(error, errorInfo);
        return;
      } catch (handlerError) {
        console.error('[ErrorBoundary] Error in scope handler:', handlerError);
      }
    }

    // Fall back to global handler
    if (this.globalErrorHandler) {
      try {
        this.globalErrorHandler(error, errorInfo);
        return;
      } catch (handlerError) {
        console.error('[ErrorBoundary] Error in global handler:', handlerError);
      }
    }

    // Default fallback: show error message
    this.showDefaultError(error, errorInfo);
  }

  /**
   * Show default error UI
   * @param {Error} error - Error object
   * @param {Object} errorInfo - Error information
   */
  showDefaultError(error, errorInfo) {
    const { notify } = window;
    if (notify) {
      notify(`Error: ${error?.message || 'Something went wrong'}`, 'error');
    }
  }

  /**
   * Wrap an async function with error handling
   * @param {Function} fn - Async function
   * @param {Object} options - Options
   * @returns {Function} Wrapped function
   */
  wrap(fn, options = {}) {
    return async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        this.handleError(error, {
          scope: options.scope,
          context: options.context,
          args
        });

        if (options.rethrow) {
          throw error;
        }

        return options.fallback;
      }
    };
  }

  /**
   * Try to execute a function, catch and handle errors
   * @param {Function} fn - Function to execute
   * @param {Object} options - Options
   * @returns {Promise} Result or fallback
   */
  async try(fn, options = {}) {
    try {
      return await fn();
    } catch (error) {
      this.handleError(error, {
        scope: options.scope,
        context: options.context
      });

      if (options.rethrow) {
        throw error;
      }

      return options.fallback;
    }
  }
}

// Create singleton instance
const errorBoundary = new ErrorBoundary();

/**
 * Render error UI in a container
 * @param {HTMLElement|string} container - Container element or selector
 * @param {Error} error - Error object
 * @param {Object} options - Display options
 */
export function renderError(container, error, options = {}) {
  const element = typeof container === 'string'
    ? document.querySelector(container)
    : container;

  if (!element) return;

  const {
    title = 'Something went wrong',
    message = error?.message || 'An unexpected error occurred',
    showStack = false,
    retry = null,
    actions = []
  } = options;

  const actionsHtml = actions.length > 0
    ? actions.map(action => `
        <button class="btn ${action.variant || 'btn--secondary'}" onclick="${action.onclick}">
          ${action.label}
        </button>
      `).join('')
    : retry
      ? `<button class="btn btn--primary" onclick="${retry}">Try Again</button>`
      : '';

  const stackHtml = showStack && error?.stack
    ? `<pre style="
        margin-top: 16px;
        padding: 12px;
        background: var(--color-gray-100);
        border-radius: var(--radius-md);
        font-size: 12px;
        overflow-x: auto;
        max-height: 200px;
      ">${escapeHtml(error.stack)}</pre>`
    : '';

  element.innerHTML = `
    <div class="error-state" style="
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--space-10);
      text-align: center;
      min-height: 300px;
    ">
      <svg style="
        width: 64px;
        height: 64px;
        margin-bottom: 16px;
        color: var(--color-error-500);
        opacity: 0.8;
      " fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
      <h3 style="
        font-size: 1.25rem;
        font-weight: 700;
        margin-bottom: 8px;
        color: var(--color-text-primary);
      ">${escapeHtml(title)}</h3>
      <p style="
        margin-bottom: 16px;
        color: var(--color-text-secondary);
        max-width: 400px;
      ">${escapeHtml(message)}</p>
      <div style="display: flex; gap: 12px;">
        ${actionsHtml}
      </div>
      ${stackHtml}
    </div>
  `;
}

/**
 * Create an error boundary for a page
 * @param {string} pageName - Page name
 * @param {Function} loadFn - Page load function
 * @param {Object} options - Options
 * @returns {Function} Wrapped load function
 */
export function createPageBoundary(pageName, loadFn, options = {}) {
  const {
    container = '#pageContent',
    onError = null,
    showStack = false
  } = options;

  // Register page-specific error handler
  errorBoundary.register(`page:${pageName}`, (error, errorInfo) => {
    console.error(`[Page:${pageName}] Error:`, error, errorInfo);

    if (onError) {
      onError(error, errorInfo);
    }

    // Resolve container (string selector or element), create fallback if missing
    let target = typeof container === 'string'
      ? document.querySelector(container)
      : container;

    if (!target && typeof container === 'string' && container.startsWith('#')) {
      const fallback = document.createElement('div');
      fallback.id = container.slice(1);
      document.body.appendChild(fallback);
      target = fallback;
    }

    // Render error UI
    renderError(target || container, error, {
      title: `Failed to Load ${pageName}`,
      message: error?.message || 'An error occurred while loading this page',
      showStack,
      retry: `window.router.refresh()`
    });
  });

  // Return wrapped load function
  return errorBoundary.wrap(loadFn, {
    scope: `page:${pageName}`,
    rethrow: false
  });
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export { errorBoundary };
export default errorBoundary;
