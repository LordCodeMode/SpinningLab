// ============================================
// FILE: pages/calendar/config.js
// Training Calendar Configuration
// ============================================

export default {
  PAGE_TITLE: 'Training Calendar',
  PAGE_DESCRIPTION: 'Plan and schedule your training workouts',

  // Calendar settings
  DEFAULT_VIEW: 'week', // 'week' or 'month'
  WEEKS_TO_SHOW: 4, // Number of weeks to show in calendar

  // Date format
  DATE_FORMAT: {
    full: 'YYYY-MM-DD',
    display: 'MMM DD, YYYY',
    dayOfWeek: 'ddd',
    monthYear: 'MMMM YYYY'
  },

  // UI settings
  SHOW_COMPLETED_ACTIVITIES: true,
  SHOW_TSS_TOTALS: true,
  ALLOW_DRAG_DROP: true,

  // Chart colors
  COLORS: {
    planned: '#6366f1',
    completed: '#10b981',
    skipped: '#f59e0b',
    overdue: '#ef4444'
  }
};
