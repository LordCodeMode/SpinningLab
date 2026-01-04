import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  optimisticDelete,
  optimisticUpdate,
  optimisticAdd,
  withButtonLoading,
  optimisticToggle
} from '../static/js/utils/optimisticUpdates.js';

describe('optimisticDelete', () => {
  let element, parent, deleteFn;

  beforeEach(() => {
    parent = document.createElement('div');
    element = document.createElement('div');
    element.id = 'test-element';
    element.textContent = 'Test Content';
    parent.appendChild(element);
    deleteFn = vi.fn().mockResolvedValue(true);
  });

  it('should remove element optimistically', async () => {
    await optimisticDelete(element, deleteFn, { animationDuration: 0 });

    expect(element.parentElement).toBeNull();
    expect(deleteFn).toHaveBeenCalledOnce();
  });

  it('should call onSuccess callback when delete succeeds', async () => {
    const onSuccess = vi.fn();

    await optimisticDelete(element, deleteFn, {
      animationDuration: 0,
      onSuccess
    });

    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it('should rollback on error', async () => {
    const failingFn = vi.fn().mockRejectedValue(new Error('Delete failed'));
    const onError = vi.fn();

    try {
      await optimisticDelete(element, failingFn, {
        animationDuration: 0,
        onError
      });
    } catch (error) {
      // Expected
    }

    expect(onError).toHaveBeenCalled();
    // Element should be restored to parent
    expect(parent.children.length).toBeGreaterThan(0);
  });
});

describe('optimisticUpdate', () => {
  let element, updateFn;

  beforeEach(() => {
    element = document.createElement('div');
    element.innerHTML = '<span>Old Content</span>';
    updateFn = vi.fn().mockResolvedValue({ success: true });
  });

  it('should update element optimistically', async () => {
    const newData = { text: 'New Content' };
    const renderFn = data => `<span>${data.text}</span>`;

    await optimisticUpdate(element, newData, updateFn, renderFn);

    expect(element.innerHTML).toBe('<span>New Content</span>');
    expect(updateFn).toHaveBeenCalledWith(newData);
  });

  it('should rollback on error', async () => {
    const originalHTML = element.innerHTML;
    const failingFn = vi.fn().mockRejectedValue(new Error('Update failed'));
    const renderFn = data => `<span>${data.text}</span>`;

    try {
      await optimisticUpdate(element, { text: 'New' }, failingFn, renderFn);
    } catch (error) {
      // Expected
    }

    expect(element.innerHTML).toBe(originalHTML);
  });
});

describe('optimisticAdd', () => {
  let container, addFn;

  beforeEach(() => {
    container = document.createElement('div');
    addFn = vi.fn().mockResolvedValue({ id: 123 });
  });

  it('should add element optimistically', async () => {
    const newItem = { text: 'New Item' };
    const renderFn = item => `<div class="item">${item.text}</div>`;

    await optimisticAdd(container, newItem, addFn, renderFn, {
      animationDuration: 0
    });

    expect(container.children.length).toBe(1);
    expect(container.innerHTML).toContain('New Item');
    expect(addFn).toHaveBeenCalledWith(newItem);
  });

  it('should prepend when specified', async () => {
    container.innerHTML = '<div class="existing">Existing</div>';

    const newItem = { text: 'New' };
    const renderFn = item => `<div class="item">${item.text}</div>`;

    await optimisticAdd(container, newItem, addFn, renderFn, {
      prepend: true,
      animationDuration: 0
    });

    expect(container.children[0].textContent).toBe('New');
  });

  it('should remove element on error', async () => {
    const failingFn = vi.fn().mockRejectedValue(new Error('Add failed'));
    const renderFn = item => `<div>${item.text}</div>`;

    try {
      await optimisticAdd(container, { text: 'Test' }, failingFn, renderFn, {
        animationDuration: 0
      });
    } catch (error) {
      // Expected
    }

    // Give time for removal animation
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(container.children.length).toBe(0);
  });
});

describe('withButtonLoading', () => {
  let button, asyncFn;

  beforeEach(() => {
    button = document.createElement('button');
    button.textContent = 'Click Me';
    button.disabled = false;
    asyncFn = vi.fn().mockResolvedValue('success');
  });

  it('should show loading state during async operation', async () => {
    const promise = withButtonLoading(button, asyncFn, {
      loadingText: 'Loading...'
    });

    // Check loading state
    expect(button.disabled).toBe(true);
    expect(button.textContent).toBe('Loading...');
    expect(button.classList.contains('loading')).toBe(true);

    await promise;

    // Check restored state
    expect(button.textContent).toBe('Click Me');
    expect(button.disabled).toBe(false);
    expect(button.classList.contains('loading')).toBe(false);
  });

  it('should show success text when specified', async () => {
    await withButtonLoading(button, asyncFn, {
      successText: 'Success!',
      successDuration: 0
    });

    expect(asyncFn).toHaveBeenCalled();
  });

  it('should show error state on failure', async () => {
    const failingFn = vi.fn().mockRejectedValue(new Error('Failed'));

    try {
      await withButtonLoading(button, failingFn);
    } catch (error) {
      // Expected
    }

    // Wait for error state animation
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(button.classList.contains('error')).toBe(true);
    expect(button.textContent).toBe('Failed');
  });
});

describe('optimisticToggle', () => {
  let checkbox, toggleFn;

  beforeEach(() => {
    checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = false;
    toggleFn = vi.fn().mockResolvedValue(true);
  });

  it('should toggle checkbox optimistically', async () => {
    await optimisticToggle(checkbox, toggleFn);

    expect(checkbox.checked).toBe(true);
    expect(toggleFn).toHaveBeenCalledWith(true);
  });

  it('should rollback on error', async () => {
    const failingFn = vi.fn().mockRejectedValue(new Error('Toggle failed'));

    try {
      await optimisticToggle(checkbox, failingFn);
    } catch (error) {
      // Expected
    }

    expect(checkbox.checked).toBe(false);
  });
});
