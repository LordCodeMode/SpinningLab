import { describe, it, expect } from 'vitest';
import { ChartService } from '../static/js/services/ChartService.js';

const service = new ChartService();

describe('ChartService', () => {
  it('returns empty chart data for empty training load', () => {
    const data = service.prepareTrainingLoadChart([]);
    expect(data.labels).toHaveLength(0);
    expect(data.datasets).toHaveLength(0);
    expect(data.meta.hasTss).toBe(false);
  });

  it('prepares training load chart with TSS and distance', () => {
    const data = service.prepareTrainingLoadChart([
      { date: '2025-01-01', ctl: 10, tss: 50, distance: 20000, label: 'Jan 1' },
      { date: '2025-01-02', ctl: 11, tss: 60, distance: 0, label: 'Jan 2' }
    ]);

    expect(data.datasets.length).toBeGreaterThan(1);
    expect(data.meta.hasTss).toBe(true);
  });

  it('builds power curve chart data and options', () => {
    const curve = service.preparePowerCurveChart({
      durations: [5, 60, 300],
      powers: [900, 400, 300],
      weighted: false
    });

    expect(curve.datasets[0].label).toContain('Power');
    expect(curve.meta.formattedLabels.length).toBe(3);

    const options = service.getPowerCurveChartOptions(false);
    expect(options.scales.x.type).toBe('logarithmic');
  });

  it('handles color utilities', () => {
    expect(service.hexToRgba('#ff0000', 0.5)).toBe('rgba(255, 0, 0, 0.5)');
    expect(service.darkenColor('#ffffff', 10)).toMatch(/^#/);
    expect(service.createGradient('power')).toBe(service.colors.gradientPower[0]);
  });
});
