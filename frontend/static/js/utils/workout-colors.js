// ============================================
// FILE: static/js/utils/workout-colors.js
// Shared interval color mapping (matches workout card preview colors)
// ============================================

import { getZoneForPower } from '../pages/workout-builder/zones.js';

const ZONE_CLASS_MAP = {
  Z1: 'workout-card__interval-bar--recovery',
  Z2: 'workout-card__interval-bar--endurance',
  Z3: 'workout-card__interval-bar--tempo',
  Z4: 'workout-card__interval-bar--threshold',
  Z5: 'workout-card__interval-bar--vo2max',
  Z6: 'workout-card__interval-bar--anaerobic',
  Z7: 'workout-card__interval-bar--sprint'
};

export function getIntervalColorClass(interval, powerPercent) {
  if (!Number.isFinite(powerPercent)) {
    return 'workout-card__interval-bar--default';
  }

  const zone = getZoneForPower(powerPercent);
  if (!zone) {
    return 'workout-card__interval-bar--default';
  }

  return ZONE_CLASS_MAP[zone.id] || 'workout-card__interval-bar--default';
}

export function getIntervalPowerPercent(interval, ftp) {
  const low = interval?.target_power_low || 0;
  const high = interval?.target_power_high || 0;
  const avg = (low + high) / 2;

  if (interval?.target_power_type === 'percent_ftp') {
    return avg;
  }

  if (!ftp) {
    return avg;
  }

  return (avg / ftp) * 100;
}
