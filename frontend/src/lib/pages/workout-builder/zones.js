/**
 * Power Zone System for Workout Builder
 * Provides power zone visualization and calculations
 */

/**
 * Power zone definitions (matching backend zones.py)
 */
export const POWER_ZONES = [
  {
    id: 'Z1',
    name: 'Recovery',
    min: 0,
    max: 55,
    color: '#c7f6c1',
    description: 'Active recovery',
  },
  {
    id: 'Z2',
    name: 'Endurance',
    min: 55,
    max: 75,
    color: '#9ce4a5',
    description: 'Base endurance training',
  },
  {
    id: 'Z3',
    name: 'Tempo',
    min: 75,
    max: 90,
    color: '#ffe285',
    description: 'Tempo/sweet spot',
  },
  {
    id: 'Z4',
    name: 'Threshold',
    min: 90,
    max: 105,
    color: '#fab57e',
    description: 'Lactate threshold',
  },
  {
    id: 'Z5',
    name: 'VO2max',
    min: 105,
    max: 120,
    color: '#f1998e',
    description: 'VO2 max intervals',
  },
  {
    id: 'Z6',
    name: 'Anaerobic',
    min: 120,
    max: 150,
    color: '#d67777',
    description: 'Anaerobic capacity',
  },
  {
    id: 'Z7',
    name: 'Sprint',
    min: 150,
    max: 200,
    color: '#c9a0db',
    description: 'Neuromuscular power',
  },
];

/**
 * Get zone for a given power percentage
 * @param {number} powerPercent - Power as percentage of FTP
 * @returns {object|null} Zone object or null if not found
 */
export function getZoneForPower(powerPercent) {
  return POWER_ZONES.find(zone => {
    return powerPercent >= zone.min && powerPercent < zone.max;
  }) || POWER_ZONES[POWER_ZONES.length - 1]; // Default to Z7 if above max
}

/**
 * Get zone color for a given power percentage
 * @param {number} powerPercent - Power as percentage of FTP
 * @returns {string} Hex color code
 */
export function getZoneColor(powerPercent) {
  const zone = getZoneForPower(powerPercent);
  return zone ? zone.color : '#94a3b8'; // Default gray if not found
}

/**
 * Get zone by ID
 * @param {string} zoneId - Zone ID (e.g., 'Z1', 'Z2')
 * @returns {object|null} Zone object or null
 */
export function getZoneById(zoneId) {
  return POWER_ZONES.find(zone => zone.id === zoneId) || null;
}

/**
 * Render power zone bands for timeline
 * @param {number} height - Canvas height in pixels
 * @param {number} maxPower - Maximum power percent to display (default 200)
 * @returns {string} HTML string for zone bands
 */
export function renderZoneBands(height, maxPower = 200) {
  const bands = [];

  // Render zones in reverse order (highest first) for proper layering
  for (let i = POWER_ZONES.length - 1; i >= 0; i--) {
    const zone = POWER_ZONES[i];

    // Calculate band position and height
    const topPercent = Math.min(zone.max, maxPower);
    const bottomPercent = zone.min;

    const top = height - ((topPercent / maxPower) * height);
    const bandHeight = ((topPercent - bottomPercent) / maxPower) * height;

    bands.push(`
      <div class="timeline-zone-band"
           style="top: ${top}px; height: ${bandHeight}px; color: ${zone.color};"
           data-zone-id="${zone.id}"
           title="${zone.name}: ${zone.min}-${zone.max}% FTP">
        <span class="timeline-zone-label">${zone.id}</span>
      </div>
    `);
  }

  return `<div class="timeline-zone-bands">${bands.join('')}</div>`;
}

/**
 * Get zone badge HTML for a block
 * @param {number} powerPercent - Average power percentage
 * @returns {string} HTML for zone badge
 */
export function renderZoneBadge(powerPercent) {
  const zone = getZoneForPower(powerPercent);
  if (!zone) return '';

  return `
    <div class="timeline-block__zone-badge"
         style="background-color: ${zone.color}; color: #000;">
      ${zone.id}
    </div>
  `;
}

/**
 * Calculate time in each zone for a workout
 * @param {Array} intervals - Array of interval objects with power and duration
 * @returns {object} Object with zone IDs as keys and time in seconds as values
 */
export function calculateTimeInZones(intervals) {
  const timeInZones = {};

  // Initialize all zones to 0
  POWER_ZONES.forEach(zone => {
    timeInZones[zone.id] = 0;
  });

  // Sum up time in each zone
  intervals.forEach(interval => {
    const avgPower = (interval.target_power_low + interval.target_power_high) / 2;
    const zone = getZoneForPower(avgPower);

    if (zone) {
      timeInZones[zone.id] += interval.duration;
    }
  });

  return timeInZones;
}

/**
 * Get zone distribution summary
 * @param {Array} intervals - Array of interval objects
 * @returns {Array} Array of { zone, time, percent } objects
 */
export function getZoneDistribution(intervals) {
  const timeInZones = calculateTimeInZones(intervals);
  const totalTime = intervals.reduce((sum, interval) => sum + interval.duration, 0);

  return POWER_ZONES.map(zone => ({
    zone: zone,
    time: timeInZones[zone.id],
    percent: totalTime > 0 ? (timeInZones[zone.id] / totalTime) * 100 : 0,
  })).filter(item => item.time > 0); // Only return zones with time
}

/**
 * Format time in zone for display
 * @param {number} seconds - Time in seconds
 * @returns {string} Formatted time string
 */
export function formatTimeInZone(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;

  if (minutes === 0) {
    return `${secs}s`;
  } else if (secs === 0) {
    return `${minutes}m`;
  } else {
    return `${minutes}m ${secs}s`;
  }
}

/**
 * Get recommended zone for workout type
 * @param {string} workoutType - Type of workout
 * @returns {object|null} Recommended zone object
 */
export function getRecommendedZone(workoutType) {
  const recommendations = {
    'Recovery': 'Z1',
    'Endurance': 'Z2',
    'Sweet Spot': 'Z3',
    'Tempo': 'Z3',
    'Threshold': 'Z4',
    'VO2max': 'Z5',
    'Anaerobic': 'Z6',
    'Sprint': 'Z7',
  };

  const zoneId = recommendations[workoutType];
  return zoneId ? getZoneById(zoneId) : null;
}

/**
 * Validate if power is within reasonable range
 * @param {number} powerPercent - Power percentage
 * @returns {object} { valid: boolean, message: string }
 */
export function validatePower(powerPercent) {
  if (powerPercent < 0) {
    return { valid: false, message: 'Power cannot be negative' };
  }

  if (powerPercent > 200) {
    return { valid: false, message: 'Power exceeds 200% FTP (unrealistic)' };
  }

  if (powerPercent > 150) {
    return {
      valid: true,
      message: 'Warning: Very high power (>150% FTP). Sustainable for short durations only.',
    };
  }

  return { valid: true, message: '' };
}

/**
 * Get zone color as CSS variable
 * @param {string} zoneId - Zone ID
 * @returns {string} CSS variable name
 */
export function getZoneCSSVariable(zoneId) {
  const zoneNumber = zoneId.replace('Z', '');
  return `var(--zone-${zoneNumber}-color)`;
}

export default {
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
  getZoneCSSVariable,
};
