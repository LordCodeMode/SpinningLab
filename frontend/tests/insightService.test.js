import { describe, it, expect } from 'vitest';
import { InsightService } from '../static/js/services/InsightService.js';

const service = new InsightService();

describe('InsightService', () => {
  it('returns TSB insights based on freshness', () => {
    const insights = service.generateTrainingLoadInsights({
      current: { ctl: 50, atl: 40, tsb: 15 },
      daily: []
    });

    expect(insights.length).toBeGreaterThan(0);
    expect(insights[0].category).toBeDefined();
  });

  it('detects training load trends', () => {
    const daily = Array.from({ length: 14 }).map((_, index) => ({
      ctl: index < 7 ? 40 : 50
    }));

    const insights = service.analyzeLoadTrend(daily);
    expect(insights.length).toBeGreaterThan(0);
    expect(insights[0].title).toMatch(/Fitness/);
  });

  it('generates power curve profile insights', () => {
    const insights = service.generatePowerCurveInsights({
      durations: [5, 60, 300, 1200],
      powers: [1400, 600, 400, 300]
    }, { ftp: 280, weight: 70 });

    expect(Array.isArray(insights)).toBe(true);
  });

  it('returns fitness state insights', () => {
    const insights = service.generateFitnessStateInsights({
      status: 'optimal',
      status_description: 'Balanced form for quality work.',
      recommendations: ['Maintain intensity']
    });

    expect(insights.length).toBeGreaterThan(0);
  });
});
