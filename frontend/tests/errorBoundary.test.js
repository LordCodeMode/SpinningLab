import { describe, it, expect, vi, beforeEach } from 'vitest';
import { errorBoundary, renderError, createPageBoundary } from '../static/js/core/errorBoundary.js';

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // Clear all registered handlers
    errorBoundary.errorHandlers.clear();
    errorBoundary.globalErrorHandler = null;
    document.body.innerHTML = '';
  });

  describe('register/unregister', () => {
    it('should register an error handler', () => {
      const handler = vi.fn();
      errorBoundary.register('test-scope', handler);

      expect(errorBoundary.errorHandlers.has('test-scope')).toBe(true);
    });

    it('should unregister an error handler', () => {
      const handler = vi.fn();
      errorBoundary.register('test-scope', handler);
      errorBoundary.unregister('test-scope');

      expect(errorBoundary.errorHandlers.has('test-scope')).toBe(false);
    });
  });

  describe('handleError', () => {
    it('should call scope-specific handler when available', () => {
      const scopeHandler = vi.fn();
      const error = new Error('Test error');

      errorBoundary.register('test-scope', scopeHandler);
      errorBoundary.handleError(error, { scope: 'test-scope' });

      expect(scopeHandler).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          message: 'Test error',
          scope: 'test-scope'
        })
      );
    });

    it('should fall back to global handler when scope handler unavailable', () => {
      const globalHandler = vi.fn();
      const error = new Error('Test error');

      errorBoundary.setGlobalHandler(globalHandler);
      errorBoundary.handleError(error);

      expect(globalHandler).toHaveBeenCalled();
    });

    it('should not throw if no handlers are registered', () => {
      const error = new Error('Test error');

      expect(() => {
        errorBoundary.handleError(error);
      }).not.toThrow();
    });
  });

  describe('wrap', () => {
    it('should execute function normally when no error', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      const wrapped = errorBoundary.wrap(fn);

      const result = await wrapped();

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalled();
    });

    it('should catch and handle errors', async () => {
      const error = new Error('Test error');
      const fn = vi.fn().mockRejectedValue(error);
      const handler = vi.fn();

      errorBoundary.register('test', handler);
      const wrapped = errorBoundary.wrap(fn, { scope: 'test' });

      await wrapped();

      expect(handler).toHaveBeenCalled();
    });

    it('should return fallback value on error', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Test'));
      const wrapped = errorBoundary.wrap(fn, { fallback: 'fallback-value' });

      const result = await wrapped();

      expect(result).toBe('fallback-value');
    });

    it('should rethrow error when rethrow option is true', async () => {
      const error = new Error('Test error');
      const fn = vi.fn().mockRejectedValue(error);
      const wrapped = errorBoundary.wrap(fn, { rethrow: true });

      await expect(wrapped()).rejects.toThrow('Test error');
    });
  });

  describe('try', () => {
    it('should execute function and return result', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const result = await errorBoundary.try(fn);

      expect(result).toBe('success');
    });

    it('should handle errors and return fallback', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Test'));

      const result = await errorBoundary.try(fn, { fallback: 'fallback' });

      expect(result).toBe('fallback');
    });
  });
});

describe('renderError', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
  });

  it('should render error UI', () => {
    const error = new Error('Test error message');

    renderError(container, error);

    expect(container.innerHTML).toContain('Something went wrong');
    expect(container.innerHTML).toContain('Test error message');
  });

  it('should accept custom title and message', () => {
    const error = new Error('Original message');

    renderError(container, error, {
      title: 'Custom Title',
      message: 'Custom message'
    });

    expect(container.innerHTML).toContain('Custom Title');
    expect(container.innerHTML).toContain('Custom message');
    expect(container.innerHTML).not.toContain('Original message');
  });

  it('should add retry button when retry function provided', () => {
    const error = new Error('Test');

    renderError(container, error, {
      retry: 'window.location.reload()'
    });

    expect(container.innerHTML).toContain('Try Again');
    expect(container.innerHTML).toContain('window.location.reload()');
  });

  it('should show stack trace when showStack is true', () => {
    const error = new Error('Test');
    error.stack = 'Error: Test\n  at test.js:1:1';

    renderError(container, error, {
      showStack: true
    });

    expect(container.innerHTML).toContain('Error: Test');
    expect(container.innerHTML).toContain('at test.js:1:1');
  });
});

describe('createPageBoundary', () => {
  let loadFn, container;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'pageContent';
    document.body.appendChild(container);

    loadFn = vi.fn().mockResolvedValue(undefined);
  });

  it('should register page-specific error handler', () => {
    createPageBoundary('test-page', loadFn);

    expect(errorBoundary.errorHandlers.has('page:test-page')).toBe(true);
  });

  it('should execute load function when wrapped', async () => {
    const wrapped = createPageBoundary('test-page', loadFn);

    await wrapped();

    expect(loadFn).toHaveBeenCalled();
  });

  it('should render error UI on failure', async () => {
    const failingFn = vi.fn().mockRejectedValue(new Error('Load failed'));
    const wrapped = createPageBoundary('test-page', failingFn, {
      container
    });

    await wrapped();

    // Need to wait for async rendering
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(container.innerHTML).toContain('Failed to Load test-page');
  });

  it('should call custom onError handler', async () => {
    const onError = vi.fn();
    const failingFn = vi.fn().mockRejectedValue(new Error('Test'));
    const wrapped = createPageBoundary('test-page', failingFn, {
      container: '#pageContent',
      onError
    });

    await wrapped();

    expect(onError).toHaveBeenCalled();
  });
});
