import React from 'react';
import { motion } from 'framer-motion';

/**
 * GlassCard Component
 * A card component with glassmorphism effect and entry animation
 */
export const GlassCard = ({ children, className = '', delay = 0, ...props }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className={`glass-card ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export default GlassCard;
