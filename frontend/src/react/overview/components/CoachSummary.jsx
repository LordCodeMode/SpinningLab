import React from 'react';
import { Brain, Lightbulb, TrendingUp } from 'lucide-react';
import GlassCard from '../../components/ui/GlassCard';

const CoachSummary = ({ insights, recommendations }) => {
  return (
    <div className="coach-summary-grid">
      <GlassCard delay={0.6} className="coach-panel insights-panel">
        <div className="panel-header">
          <Brain size={20} className="panel-icon text-blue" />
          <h3 className="section-title">AI Insights</h3>
        </div>
        <div className="insights-list">
          {insights.slice(0, 3).map((insight, index) => (
            <div key={index} className={`insight-item-modern ${insight.type}`}>
              <div className="insight-indicator" />
              <div className="insight-content">
                <div className="insight-title">{insight.title}</div>
                <div className="insight-text">{insight.text}</div>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassCard delay={0.7} className="coach-panel recommendations-panel">
        <div className="panel-header">
          <Lightbulb size={20} className="panel-icon text-amber" />
          <h3 className="section-title">Recommendations</h3>
        </div>
        <div className="recommendations-list">
          {recommendations.slice(0, 2).map((rec, index) => (
            <div key={index} className="rec-item-modern">
              <div className="rec-icon">
                <TrendingUp size={16} />
              </div>
              <div className="rec-content">
                <div className="rec-title">{rec.title}</div>
                <div className="rec-text">{rec.text}</div>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
};

export default CoachSummary;
