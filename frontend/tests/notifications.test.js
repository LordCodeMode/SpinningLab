import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { notify } from '../static/js/utils/notifications.js';

describe('notifications', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates and removes notifications', () => {
    notify('Hello world', 'success', 10);

    const container = document.getElementById('notification-container');
    expect(container).toBeTruthy();
    expect(container?.children.length).toBe(1);

    const styles = document.getElementById('notification-styles');
    expect(styles).toBeTruthy();

    vi.runAllTimers();
    expect(container?.children.length).toBe(0);
  });
});
