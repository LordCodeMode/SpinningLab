/**
 * Interval Templates for Workout Builder
 * Pre-built workout patterns for quick interval training
 */

/**
 * Template definitions
 * Each template includes a full workout structure
 */
export const INTERVAL_TEMPLATES = [
  // ========== VO2max Intervals ==========
  {
    id: 'vo2max_4x4',
    name: '4x4min VO2max',
    description: 'Classic Norwegian 4x4 intervals at VO2max intensity',
    workoutType: 'VO2max',
    intervals: [
      { type: 'warmup', duration: 900, power_low: 50, power_high: 65 }, // 15min warmup
      // 4 sets of 4min work + 3min recovery
      { type: 'work', duration: 240, power_low: 105, power_high: 115 },
      { type: 'recovery', duration: 180, power_low: 50, power_high: 60 },
      { type: 'work', duration: 240, power_low: 105, power_high: 115 },
      { type: 'recovery', duration: 180, power_low: 50, power_high: 60 },
      { type: 'work', duration: 240, power_low: 105, power_high: 115 },
      { type: 'recovery', duration: 180, power_low: 50, power_high: 60 },
      { type: 'work', duration: 240, power_low: 105, power_high: 115 },
      { type: 'cooldown', duration: 600, power_low: 50, power_high: 60 }, // 10min cooldown
    ],
    totalDuration: 3900, // 65 minutes
    estimatedTss: 82,
    tags: ['vo2max', 'intervals', 'classic'],
  },
  {
    id: 'vo2max_5x3',
    name: '5x3min VO2max',
    description: 'Shorter, more intense VO2max intervals',
    workoutType: 'VO2max',
    intervals: [
      { type: 'warmup', duration: 600, power_low: 50, power_high: 65 }, // 10min
      // 5 sets of 3min work + 3min recovery
      { type: 'work', duration: 180, power_low: 110, power_high: 120 },
      { type: 'recovery', duration: 180, power_low: 50, power_high: 60 },
      { type: 'work', duration: 180, power_low: 110, power_high: 120 },
      { type: 'recovery', duration: 180, power_low: 50, power_high: 60 },
      { type: 'work', duration: 180, power_low: 110, power_high: 120 },
      { type: 'recovery', duration: 180, power_low: 50, power_high: 60 },
      { type: 'work', duration: 180, power_low: 110, power_high: 120 },
      { type: 'recovery', duration: 180, power_low: 50, power_high: 60 },
      { type: 'work', duration: 180, power_low: 110, power_high: 120 },
      { type: 'cooldown', duration: 600, power_low: 50, power_high: 60 }, // 10min
    ],
    totalDuration: 3600, // 60 minutes
    estimatedTss: 78,
    tags: ['vo2max', 'intervals'],
  },
  {
    id: 'vo2max_8x2',
    name: '8x2min VO2max',
    description: 'High-intensity 2-minute VO2max efforts',
    workoutType: 'VO2max',
    intervals: [
      { type: 'warmup', duration: 600, power_low: 50, power_high: 65 }, // 10min
      // 8 sets of 2min work + 2min recovery
      ...Array.from({ length: 8 }, () => [
        { type: 'work', duration: 120, power_low: 115, power_high: 125 },
        { type: 'recovery', duration: 120, power_low: 50, power_high: 60 },
      ]).flat(),
      { type: 'cooldown', duration: 600, power_low: 50, power_high: 60 }, // 10min
    ],
    totalDuration: 3800, // 63 minutes
    estimatedTss: 75,
    tags: ['vo2max', 'intervals', 'short'],
  },

  // ========== Sweet Spot ==========
  {
    id: 'sweetspot_3x10',
    name: '3x10min Sweet Spot',
    description: 'Sustained sweet spot intervals for endurance',
    workoutType: 'Sweet Spot',
    intervals: [
      { type: 'warmup', duration: 900, power_low: 50, power_high: 65 }, // 15min
      // 3 sets of 10min work + 5min recovery
      { type: 'work', duration: 600, power_low: 88, power_high: 93 },
      { type: 'recovery', duration: 300, power_low: 50, power_high: 60 },
      { type: 'work', duration: 600, power_low: 88, power_high: 93 },
      { type: 'recovery', duration: 300, power_low: 50, power_high: 60 },
      { type: 'work', duration: 600, power_low: 88, power_high: 93 },
      { type: 'cooldown', duration: 600, power_low: 50, power_high: 60 }, // 10min
    ],
    totalDuration: 5400, // 90 minutes
    estimatedTss: 85,
    tags: ['sweet-spot', 'endurance'],
  },
  {
    id: 'sweetspot_2x20',
    name: '2x20min Sweet Spot',
    description: 'Long sweet spot efforts',
    workoutType: 'Sweet Spot',
    intervals: [
      { type: 'warmup', duration: 900, power_low: 50, power_high: 65 }, // 15min
      // 2 sets of 20min work + 10min recovery
      { type: 'work', duration: 1200, power_low: 88, power_high: 93 },
      { type: 'recovery', duration: 600, power_low: 50, power_high: 60 },
      { type: 'work', duration: 1200, power_low: 88, power_high: 93 },
      { type: 'cooldown', duration: 900, power_low: 50, power_high: 60 }, // 15min
    ],
    totalDuration: 5400, // 90 minutes
    estimatedTss: 90,
    tags: ['sweet-spot', 'endurance'],
  },

  // ========== Threshold ==========
  {
    id: 'threshold_2x20',
    name: '2x20min Threshold',
    description: 'Classic FTP test or threshold workout',
    workoutType: 'Threshold',
    intervals: [
      { type: 'warmup', duration: 1200, power_low: 50, power_high: 70 }, // 20min
      // 2 sets of 20min work + 10min recovery
      { type: 'work', duration: 1200, power_low: 95, power_high: 105 },
      { type: 'recovery', duration: 600, power_low: 50, power_high: 60 },
      { type: 'work', duration: 1200, power_low: 95, power_high: 105 },
      { type: 'cooldown', duration: 600, power_low: 50, power_high: 60 }, // 10min
    ],
    totalDuration: 5400, // 90 minutes
    estimatedTss: 100,
    tags: ['threshold', 'ftp-test'],
  },
  {
    id: 'threshold_3x8',
    name: '3x8min Threshold',
    description: 'Shorter threshold intervals',
    workoutType: 'Threshold',
    intervals: [
      { type: 'warmup', duration: 900, power_low: 50, power_high: 65 }, // 15min
      // 3 sets of 8min work + 4min recovery
      { type: 'work', duration: 480, power_low: 95, power_high: 105 },
      { type: 'recovery', duration: 240, power_low: 50, power_high: 60 },
      { type: 'work', duration: 480, power_low: 95, power_high: 105 },
      { type: 'recovery', duration: 240, power_low: 50, power_high: 60 },
      { type: 'work', duration: 480, power_low: 95, power_high: 105 },
      { type: 'cooldown', duration: 600, power_low: 50, power_high: 60 }, // 10min
    ],
    totalDuration: 3900, // 65 minutes
    estimatedTss: 72,
    tags: ['threshold', 'intervals'],
  },

  // ========== Sprint Intervals ==========
  {
    id: 'sprint_10x30_30',
    name: '10x30s Sprint',
    description: '30 seconds on, 30 seconds off sprint intervals',
    workoutType: 'Anaerobic',
    intervals: [
      { type: 'warmup', duration: 900, power_low: 50, power_high: 70 }, // 15min
      // 10 sets of 30s sprint + 30s recovery
      ...Array.from({ length: 10 }, () => [
        { type: 'work', duration: 30, power_low: 150, power_high: 200 },
        { type: 'recovery', duration: 30, power_low: 50, power_high: 60 },
      ]).flat(),
      { type: 'cooldown', duration: 600, power_low: 50, power_high: 60 }, // 10min
    ],
    totalDuration: 2100, // 35 minutes
    estimatedTss: 45,
    tags: ['sprint', 'anaerobic', 'short'],
  },
  {
    id: 'sprint_6x1_2',
    name: '6x1min Sprint',
    description: '1 minute on, 2 minutes off sprint intervals',
    workoutType: 'Anaerobic',
    intervals: [
      { type: 'warmup', duration: 900, power_low: 50, power_high: 70 }, // 15min
      // 6 sets of 1min sprint + 2min recovery
      ...Array.from({ length: 6 }, () => [
        { type: 'work', duration: 60, power_low: 140, power_high: 160 },
        { type: 'recovery', duration: 120, power_low: 50, power_high: 60 },
      ]).flat(),
      { type: 'cooldown', duration: 600, power_low: 50, power_high: 60 }, // 10min
    ],
    totalDuration: 2580, // 43 minutes
    estimatedTss: 50,
    tags: ['sprint', 'anaerobic'],
  },

  // ========== Endurance ==========
  {
    id: 'endurance_60_z2',
    name: '60min Z2 Endurance',
    description: 'Steady endurance ride',
    workoutType: 'Endurance',
    intervals: [
      { type: 'warmup', duration: 600, power_low: 50, power_high: 65 }, // 10min
      { type: 'work', duration: 3600, power_low: 60, power_high: 70 }, // 60min Z2
      { type: 'cooldown', duration: 600, power_low: 50, power_high: 60 }, // 10min
    ],
    totalDuration: 4800, // 80 minutes
    estimatedTss: 60,
    tags: ['endurance', 'zone2', 'base'],
  },
  {
    id: 'endurance_90_z2',
    name: '90min Z2 Endurance',
    description: 'Long steady endurance ride',
    workoutType: 'Endurance',
    intervals: [
      { type: 'warmup', duration: 900, power_low: 50, power_high: 65 }, // 15min
      { type: 'work', duration: 5400, power_low: 60, power_high: 70 }, // 90min Z2
      { type: 'cooldown', duration: 900, power_low: 50, power_high: 60 }, // 15min
    ],
    totalDuration: 7200, // 120 minutes
    estimatedTss: 90,
    tags: ['endurance', 'zone2', 'base', 'long'],
  },

  // ========== Recovery ==========
  {
    id: 'recovery_30',
    name: '30min Recovery',
    description: 'Easy recovery spin',
    workoutType: 'Recovery',
    intervals: [
      { type: 'warmup', duration: 300, power_low: 40, power_high: 50 }, // 5min
      { type: 'work', duration: 1800, power_low: 45, power_high: 55 }, // 30min Z1
      { type: 'cooldown', duration: 300, power_low: 40, power_high: 50 }, // 5min
    ],
    totalDuration: 2400, // 40 minutes
    estimatedTss: 20,
    tags: ['recovery', 'zone1', 'easy'],
  },

  // ========== Mixed/Pyramid ==========
  {
    id: 'pyramid_30_60_90_60_30',
    name: 'Pyramid 30-60-90-60-30',
    description: 'Progressive threshold pyramid intervals',
    workoutType: 'Threshold',
    intervals: [
      { type: 'warmup', duration: 900, power_low: 50, power_high: 65 }, // 15min
      // Pyramid up
      { type: 'work', duration: 30, power_low: 95, power_high: 105 },
      { type: 'recovery', duration: 30, power_low: 50, power_high: 60 },
      { type: 'work', duration: 60, power_low: 95, power_high: 105 },
      { type: 'recovery', duration: 60, power_low: 50, power_high: 60 },
      { type: 'work', duration: 90, power_low: 95, power_high: 105 },
      { type: 'recovery', duration: 90, power_low: 50, power_high: 60 },
      // Pyramid down
      { type: 'work', duration: 60, power_low: 95, power_high: 105 },
      { type: 'recovery', duration: 60, power_low: 50, power_high: 60 },
      { type: 'work', duration: 30, power_low: 95, power_high: 105 },
      { type: 'cooldown', duration: 600, power_low: 50, power_high: 60 }, // 10min
    ],
    totalDuration: 2640, // 44 minutes
    estimatedTss: 55,
    tags: ['threshold', 'pyramid', 'varied'],
  },
];

/**
 * Get template by ID
 * @param {string} templateId - Template ID
 * @returns {object|null} Template object or null
 */
export function getTemplate(templateId) {
  return INTERVAL_TEMPLATES.find(t => t.id === templateId) || null;
}

/**
 * Get templates by tag
 * @param {string} tag - Tag to filter by
 * @returns {Array} Array of matching templates
 */
export function getTemplatesByTag(tag) {
  return INTERVAL_TEMPLATES.filter(t => t.tags.includes(tag));
}

/**
 * Get templates by workout type
 * @param {string} workoutType - Workout type
 * @returns {Array} Array of matching templates
 */
export function getTemplatesByType(workoutType) {
  return INTERVAL_TEMPLATES.filter(t => t.workoutType === workoutType);
}

/**
 * Search templates by name or description
 * @param {string} query - Search query
 * @returns {Array} Array of matching templates
 */
export function searchTemplates(query) {
  const lowerQuery = query.toLowerCase();
  return INTERVAL_TEMPLATES.filter(t =>
    t.name.toLowerCase().includes(lowerQuery) ||
    t.description.toLowerCase().includes(lowerQuery) ||
    t.tags.some(tag => tag.includes(lowerQuery))
  );
}

/**
 * Get all unique tags
 * @returns {Array} Array of unique tags
 */
export function getAllTags() {
  const tags = new Set();
  INTERVAL_TEMPLATES.forEach(t => t.tags.forEach(tag => tags.add(tag)));
  return Array.from(tags).sort();
}

/**
 * Format template duration
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration
 */
export function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export default {
  INTERVAL_TEMPLATES,
  getTemplate,
  getTemplatesByTag,
  getTemplatesByType,
  searchTemplates,
  getAllTags,
  formatDuration,
};
