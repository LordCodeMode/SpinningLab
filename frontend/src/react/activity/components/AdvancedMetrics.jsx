import React from 'react';

const AdvancedMetrics = ({ advancedMetrics }) => {
  return (
    <section className="activity-section activity-advanced-section">
      <div className="activity-section-header section-header">
        <h2 className="activity-section-title section-title">Advanced Metrics</h2>
        <p className="activity-section-subtitle section-subtitle">Fatigue resistance, W' balance, variability, and decoupling.</p>
      </div>
      <div className="activity-advanced-grid">
        <div className="activity-advanced-card">
          <div className="activity-advanced-title">Fatigue Resistance</div>
          <div className="activity-advanced-value">
            {advancedMetrics?.fatigueResistance ? Number(advancedMetrics.fatigueResistance.fatigue_ratio).toFixed(2) : '-'}
          </div>
          <div className="activity-advanced-sub">
            {advancedMetrics?.fatigueResistance
              ? `Decay ${advancedMetrics.fatigueResistance.decay_percent}% over ${advancedMetrics.fatigueResistance.segment_minutes} min`
              : 'Insufficient data'}
          </div>
        </div>
        <div className="activity-advanced-card">
          <div className="activity-advanced-title">W' Balance</div>
          <div className="activity-advanced-value">
            {advancedMetrics?.wPrimeBalance
              ? `${(advancedMetrics.wPrimeBalance.min_w_balance / 1000).toFixed(1)} kJ`
              : '-'}
          </div>
          <div className="activity-advanced-sub">
            {advancedMetrics?.wPrimeBalance
              ? `Depletion ${advancedMetrics.wPrimeBalance.depletion_percent}%`
              : 'Insufficient data'}
          </div>
          {advancedMetrics?.wPrimeBalance && (
            <div className="activity-advanced-meta">
              CP {advancedMetrics.wPrimeBalance.critical_power}W - W' {(advancedMetrics.wPrimeBalance.w_prime / 1000).toFixed(1)} kJ
            </div>
          )}
        </div>
        <div className="activity-advanced-card">
          <div className="activity-advanced-title">Variability Index</div>
          <div className="activity-advanced-value">
            {advancedMetrics?.variabilityIndex ? Number(advancedMetrics.variabilityIndex.variability_index).toFixed(2) : '-'}
          </div>
          <div className="activity-advanced-sub">
            {advancedMetrics?.variabilityIndex
              ? `NP ${advancedMetrics.variabilityIndex.normalized_power}W - Avg ${advancedMetrics.variabilityIndex.avg_power}W`
              : 'Insufficient data'}
          </div>
        </div>
        <div className="activity-advanced-card">
          <div className="activity-advanced-title">Decoupling</div>
          <div className="activity-advanced-value">
            {advancedMetrics?.decoupling ? `${Number(advancedMetrics.decoupling.decoupling_percent).toFixed(1)}%` : '-'}
          </div>
          <div className="activity-advanced-sub">
            {advancedMetrics?.decoupling ? 'Power/HR drift' : 'Insufficient data'}
          </div>
          {advancedMetrics?.decoupling && (
            <div className="activity-advanced-meta">
              P {advancedMetrics.decoupling.power_first} to {advancedMetrics.decoupling.power_last}W - HR {advancedMetrics.decoupling.hr_first} to {advancedMetrics.decoupling.hr_last}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default AdvancedMetrics;
