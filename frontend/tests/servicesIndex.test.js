import { describe, it, expect } from 'vitest';
import Services, {
  Services as ServicesNamespace,
  dataService,
  cacheService,
  chartService,
  insightService,
  analyticsService,
  uploadService
} from '../static/js/services/index.js';

describe('services index', () => {
  it('exports singleton services and registers window.Services', () => {
    expect(dataService).toBeDefined();
    expect(cacheService).toBeDefined();
    expect(chartService).toBeDefined();
    expect(insightService).toBeDefined();
    expect(analyticsService).toBeDefined();
    expect(uploadService).toBeDefined();

    expect(Services).toBeDefined();
    expect(ServicesNamespace).toBeDefined();
    expect(window.Services).toBe(ServicesNamespace);
    expect(ServicesNamespace.api).toBeDefined();
  });
});
