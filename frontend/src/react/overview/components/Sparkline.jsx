import React from 'react';
import { buildSparkPath } from '../overviewUtils';

const Sparkline = ({ series, stroke = '#2563eb', fill = 'rgba(37, 99, 235, 0.12)' }) => {
  const width = 84;
  const height = 28;
  const path = buildSparkPath(series, width, height);
  if (!path) return null;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="ov-stat-sparkline" aria-hidden="true">
      <path d={path} fill="none" stroke={stroke} strokeWidth="2" />
      <path d={`${path} L ${width} ${height} L 0 ${height} Z`} fill={fill} stroke="none" />
    </svg>
  );
};

export default Sparkline;
