import { describe, it, expect } from 'vitest';
import {
  POWER_ZONES,
  getZoneForPower,
  getZoneColor,
  getZoneById,
  renderZoneBands,
  renderZoneBadge,
  calculateTimeInZones,
  getZoneDistribution,
  formatTimeInZone,
  getRecommendedZone,
  validatePower,
  getZoneCSSVariable
} from '../static/js/pages/workout-builder/zones.js';
import { getIntervalColorClass, getIntervalPowerPercent } from '../static/js/utils/workout-colors.js';

describe('Workout zones utilities', () => {
  it('maps power percentages to zones and colors', () => {
    const zone = getZoneForPower(50);
    expect(zone.id).toBe('Z1');
    expect(getZoneForPower(180).id).toBe('Z7');
    expect(getZoneColor(95)).toBe(POWER_ZONES[3].color);
    expect(getZoneById('Z4').name).toBe('Threshold');
  });

  it('renders zone bands and badges', () => {
    const bands = renderZoneBands(200, 200);
    expect(bands.match(/timeline-zone-band\"/g)?.length).toBe(POWER_ZONES.length);
    const badge = renderZoneBadge(60);
    expect(badge).toContain('Z2');
  });

  it('calculates zone time and distributions', () => {
    const intervals = [
      { duration: 300, target_power_low: 50, target_power_high: 50 },
      { duration: 600, target_power_low: 110, target_power_high: 110 }
    ];

    const time = calculateTimeInZones(intervals);
    expect(time.Z1).toBe(300);
    expect(time.Z5).toBe(600);

    const distribution = getZoneDistribution(intervals);
    const z1 = distribution.find(item => item.zone.id === 'Z1');
    expect(z1?.percent).toBeCloseTo(33.33, 1);
  });

  it('formats durations and recommendations', () => {
    expect(formatTimeInZone(30)).toBe('30s');
    expect(formatTimeInZone(60)).toBe('1m');
    expect(formatTimeInZone(90)).toBe('1m 30s');
    expect(getRecommendedZone('VO2max').id).toBe('Z5');
    expect(getZoneCSSVariable('Z4')).toBe('var(--zone-4-color)');
  });

  it('validates power ranges', () => {
    expect(validatePower(-1).valid).toBe(false);
    expect(validatePower(210).valid).toBe(false);
    const warn = validatePower(160);
    expect(warn.valid).toBe(true);
    expect(warn.message).toContain('Warning');
  });

  it('computes interval colors and power percent', () => {
    const interval = { target_power_low: 200, target_power_high: 200, target_power_type: 'watts' };
    expect(getIntervalPowerPercent(interval, 400)).toBe(50);
    expect(getIntervalColorClass(interval, 50)).toContain('workout-card__interval-bar--recovery');

    const percentInterval = { target_power_low: 90, target_power_high: 90, target_power_type: 'percent_ftp' };
    expect(getIntervalPowerPercent(percentInterval, 0)).toBe(90);
    expect(getIntervalColorClass(percentInterval, NaN)).toBe('workout-card__interval-bar--default');
  });
});
