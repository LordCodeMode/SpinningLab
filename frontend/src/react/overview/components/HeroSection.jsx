import React from 'react';
import { motion } from 'framer-motion';

const HeroSection = ({ userName, timeOfDay, heroDate }) => {
  const greeting = timeOfDay === 'morning'
    ? `Good morning, ${userName}!`
    : timeOfDay === 'afternoon'
      ? `Good afternoon, ${userName}!`
      : `Good evening, ${userName}!`;

  return (
    <div className="ov-hero">
      <div className="ov-welcome-text">
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="ov-welcome-title page-title"
        >
          {greeting}
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="ov-welcome-subtitle page-description"
        >
          <span className="ov-welcome-date">{heroDate}</span>
          <span className="ov-welcome-dot" aria-hidden="true"></span>
          <span className="ov-welcome-tagline">Your training overview is ready</span>
        </motion.p>
      </div>
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="ov-welcome-graphic"
      >
        <svg viewBox="0 0 200 200" className="ov-hero-logo" aria-hidden="true">
          <defs>
            <linearGradient id="ovHeroRimGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#5b8cff" stopOpacity="1" />
              <stop offset="100%" stopColor="#7c5cff" stopOpacity="1" />
            </linearGradient>
            <linearGradient id="ovHeroHubGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#5b8cff" stopOpacity="1" />
              <stop offset="60%" stopColor="#7c5cff" stopOpacity="1" />
              <stop offset="100%" stopColor="#f08fdc" stopOpacity="1" />
            </linearGradient>
            <filter id="ovHeroGlow">
              <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <path id="ovHeroWordTop" d="M 30 100 A 70 70 0 0 0 170 100" />
            <path id="ovHeroWordBottom" d="M 170 100 A 70 70 0 0 0 30 100" />
          </defs>

          <g className="ov-hero-rim ov-hero-origin">
            <circle cx="100" cy="100" r="70" fill="none" stroke="url(#ovHeroRimGradient)" strokeWidth="20" opacity="0.95" />
            <text className="ov-hero-wordmark">
              <textPath href="#ovHeroWordTop" startOffset="50%" textAnchor="middle">
                SpinningLab
              </textPath>
            </text>
            <text className="ov-hero-wordmark">
              <textPath href="#ovHeroWordBottom" startOffset="50%" textAnchor="middle">
                SpinningLab
              </textPath>
            </text>
          </g>

          <g className="ov-hero-chain ov-hero-origin">
            <circle cx="100" cy="100" r="30" fill="none" stroke="url(#ovHeroHubGradient)" strokeWidth="5" opacity="0.9" />
            <circle cx="100" cy="100" r="34" fill="none" stroke="url(#ovHeroHubGradient)" strokeWidth="4.5" strokeDasharray="4 9" strokeLinecap="round" opacity="0.9" />
            <circle cx="100" cy="100" r="18" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" />
            <circle cx="100" cy="100" r="12" fill="url(#ovHeroHubGradient)" filter="url(#ovHeroGlow)" />
            <circle cx="100" cy="100" r="7.5" fill="none" stroke="white" strokeWidth="2" opacity="0.65" />
            <circle cx="100" cy="100" r="3.5" fill="white" opacity="0.45" />
          </g>
        </svg>
      </motion.div>
    </div>
  );
};

export default HeroSection;
