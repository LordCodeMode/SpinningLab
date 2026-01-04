// ============================================
// FILE: pages/workout-builder/config.js
// Workout Builder Configuration
// ============================================

export default {
  PAGE_TITLE: 'Workout Builder',
  PAGE_DESCRIPTION: 'Create and edit custom workouts',

  INTERVAL_TYPES: [
    { value: 'warmup', label: 'Warmup' },
    { value: 'work', label: 'Work' },
    { value: 'recovery', label: 'Recovery' },
    { value: 'cooldown', label: 'Cooldown' }
  ],

  WORKOUT_TYPES: [
    'Sweet Spot',
    'VO2max',
    'Threshold',
    'Endurance',
    'Recovery',
    'Anaerobic',
    'Custom'
  ]
};
