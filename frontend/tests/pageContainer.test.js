import { describe, it, expect } from 'vitest';
import { getPageContainer } from '../static/js/utils/page-container.js';

describe('page container lookup', () => {
  it('returns the first matching container', () => {
    document.body.innerHTML = `
      <div id="page-content"></div>
      <div id="react-page-content"></div>
      <div id="main-content"></div>
    `;
    const container = getPageContainer();
    expect(container?.id).toBe('react-page-content');
  });

  it('falls back to other containers when react container is missing', () => {
    document.body.innerHTML = `
      <div id="pageContent"></div>
      <div id="main-content"></div>
    `;
    const container = getPageContainer();
    expect(container?.id).toBe('pageContent');
  });
});
