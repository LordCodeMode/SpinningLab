import React from 'react';
import { Activity, Zap, TrendingUp, Clock } from 'lucide-react';
import GlassCard from '../../components/ui/GlassCard';

const StatItem = ({ label, value, icon: Icon, color, delay, sparkline: Sparkline }) => (
  <GlassCard delay={delay} className="ov-stat-card">
    <div className="ov-stat-header">
      <div className={`ov-stat-icon-wrapper ${color}`}>
        <Icon size={18} />
      </div>
      <div className="ov-stat-sparkline-container">
        {Sparkline}
      </div>
    </div>
    <div className="ov-stat-content">
      <span className="ov-stat-label">{label}</span>
      <h3 className="ov-stat-value">{value}</h3>
    </div>
  </GlassCard>
);

const StatsGrid = ({ stats, sparklines }) => {
  return (
    <div className="ov-stats-grid">
      <StatItem
        label="Weekly TSS"
        value={Math.round(stats.recentTss)}
        icon={Zap}
        color="amber"
        delay={0.1}
        sparkline={sparklines.tss}
      />
      <StatItem
        label="Distance"
        value={`${stats.recentDistance.toFixed(1)} km`}
        icon={TrendingUp}
        color="purple"
        delay={0.2}
        sparkline={sparklines.distance}
      />
      <StatItem
        label="Sessions"
        value={stats.recentSessions}
        icon={Activity}
        color="blue"
        delay={0.3}
        sparkline={sparklines.activities}
      />
      <StatItem
        label="Duration"
        value={`${stats.recentDuration.toFixed(1)}h`}
        icon={Clock}
        color="cyan"
        delay={0.4}
        sparkline={sparklines.duration}
      />
    </div>
  );
};

export default StatsGrid;
