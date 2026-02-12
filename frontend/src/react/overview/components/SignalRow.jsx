import React from 'react';
import { motion } from 'framer-motion';
import { formatRelativeDate } from '../overviewUtils';

const SignalRow = ({ trainingLoad, activities, weeklyStats }) => {
  const tsb = trainingLoad?.current?.tsb || 0;
  const readiness = tsb > 5
    ? { label: 'Fresh', className: 'fresh', detail: 'Ideal for intensity' }
    : tsb > -5
      ? { label: 'Balanced', className: 'balanced', detail: 'Build with confidence' }
      : { label: 'Fatigued', className: 'fatigued', detail: 'Focus on recovery' };

  const latestActivity = activities?.[0] || null;
  const latestName = latestActivity?.custom_name
    || latestActivity?.file_name
    || latestActivity?.type
    || 'No recent ride';
  const latestDate = latestActivity?.start_time
    ? formatRelativeDate(latestActivity.start_time)
    : 'Sync to update';

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <motion.div 
      variants={container}
      initial="hidden"
      animate="show"
      className="ov-signal-row"
    >
      <motion.div variants={item} className="ov-signal-card glass-card">
        <div className="ov-signal-label">Readiness</div>
        <div className={`ov-signal-value ov-signal-value--${readiness.className}`}>{readiness.label}</div>
        <div className="ov-signal-meta">{readiness.detail}</div>
      </motion.div>

      <motion.div variants={item} className="ov-signal-card glass-card">
        <div className="ov-signal-label">Last Activity</div>
        <div className="ov-signal-value">{latestName}</div>
        <div className="ov-signal-meta">{latestDate}</div>
      </motion.div>

      <motion.div variants={item} className="ov-signal-card glass-card">
        <div className="ov-signal-label">Weekly Load</div>
        <div className="ov-signal-value">{Math.round(weeklyStats.recentTss)} TSS</div>
        <div className="ov-signal-progress">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${weeklyStats.percent}%` }}
            transition={{ duration: 1, delay: 0.5 }}
            className="ov-signal-progress__bar" 
          />
        </div>
        <div className="ov-signal-meta">
          Target {Math.round(weeklyStats.target)} TSS - {Math.round(weeklyStats.recentDistance)} km
        </div>
      </motion.div>
    </motion.div>
  );
};

export default SignalRow;
