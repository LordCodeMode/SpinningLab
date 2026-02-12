import React from 'react';
import LoadMetrics from './LoadMetrics';
import FtpForecast from './FtpForecast';
import TrainingLoadChart from './TrainingLoadChart';

const PerformanceSnapshot = ({ 
  trainingLoad, 
  ftpPrediction, 
  chartSeries, 
  chartMeta, 
  chartSummary, 
  trainingLoadRange, 
  availableRanges, 
  handleRangeChange 
}) => {
  const ctl = trainingLoad?.current?.ctl || 0;
  const atl = trainingLoad?.current?.atl || 0;
  const tsb = trainingLoad?.current?.tsb || 0;

  return (
    <div className="ov-main-content">
      <div className="ov-left-panel">
        <div className="glass-card p-4">
          <LoadMetrics ctl={ctl} atl={atl} tsb={tsb} />
          <FtpForecast prediction={ftpPrediction} />
        </div>
      </div>

      <div className="ov-right-panel">
        <div className="glass-card p-4 h-full">
          <TrainingLoadChart 
            chartSeries={chartSeries}
            chartMeta={chartMeta}
            chartSummary={chartSummary}
            trainingLoadRange={trainingLoadRange}
            availableRanges={availableRanges}
            handleRangeChange={handleRangeChange}
          />
        </div>
      </div>
    </div>
  );
};

export default PerformanceSnapshot;
