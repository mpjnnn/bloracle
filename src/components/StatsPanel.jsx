import React from 'react';
import { format } from 'date-fns';
import { usePoolData } from '../hooks/usePoolData.js';
import { useTimeElapsed } from '../hooks/useTimeElapsed.js';
import { formatTimeInterval, formatProbability } from '../utils/poissonCalculations.js';

function StatsPanelComponent() {
  const { poolInfo, analysis, predictionData, lastRefresh, blocks } = usePoolData();
  
  // Get the most recent block timestamp as fallback if poolInfo.lastBlockTimestamp is missing
  const latestBlock = blocks && blocks.length > 0 
    ? blocks.reduce((latest, block) => {
        if (!latest) return block;
        // Prefer highest timestamp, fallback to highest height
        if (block.timestamp > latest.timestamp) return block;
        if (block.timestamp === latest.timestamp && block.height > latest.height) return block;
        return latest;
      })
    : null;
  
  // Use poolInfo.lastBlockTimestamp if available, otherwise use latest block's timestamp
  const lastBlockTimestamp = poolInfo?.lastBlockTimestamp && poolInfo.lastBlockTimestamp > 0
    ? poolInfo.lastBlockTimestamp
    : (latestBlock?.timestamp || 0);
  
  const elapsedTime = useTimeElapsed(lastBlockTimestamp);

  if (!poolInfo || !analysis) {
    return (
      <div className="bg-navy-light border border-dark p-6 rounded">
        <p className="text-primary">No statistics available</p>
      </div>
    );
  }

  // Calculate estimated time left (can be negative if overdue)
  const estimatedTimeLeft = analysis.adjustedExpectedTime - elapsedTime.seconds;
  const estimatedTimeLeftFormatted = formatTimeInterval(Math.abs(estimatedTimeLeft));
  const isOverdue = estimatedTimeLeft < 0;

  // Get network difficulty from most recent block (already calculated above)
  const networkDifficulty = latestBlock?.difficulty || 0;

  // Format last refresh time
  const lastRefreshFormatted = lastRefresh
    ? format(lastRefresh, 'HH:mm:ss')
    : 'Never';

  return (
    <div className="bg-navy-light border border-dark p-4 md:p-6 rounded space-y-4">
      <h2 className="text-primary text-xl font-bold mb-4">Statistics</h2>

      {/* Time Since Last Block */}
      <div className="bg-navy border border-dark p-3 md:p-4 rounded">
        <p className="text-primary text-sm mb-2">Time Since Last Block</p>
        <p className="text-accent-orange text-xl md:text-2xl font-bold">{elapsedTime.formatted}</p>
      </div>

      {/* Adjusted Expected Block Time */}
      <div className="bg-navy border border-dark p-3 md:p-4 rounded">
        <p className="text-primary text-sm mb-2">Adjusted Expected Time</p>
        <p className="text-primary text-base md:text-lg">{formatTimeInterval(analysis.adjustedExpectedTime)}</p>
      </div>

      {/* Estimated Time to Next Block */}
      <div className="bg-navy border border-dark p-3 md:p-4 rounded">
        <p className="text-primary text-sm mb-2">Est. Time to Next Block</p>
        <div className="flex items-center gap-2">
          <p
            className={`text-base md:text-lg font-bold ${
              isOverdue ? 'text-red-500' : 'text-accent-orange'
            }`}
          >
            {estimatedTimeLeftFormatted}
          </p>
          {isOverdue && (
            <span className="text-red-500 text-xs font-semibold">(overdue)</span>
          )}
        </div>
      </div>

      {/* Deviation from Expected */}
      <div className="bg-navy border border-dark p-3 md:p-4 rounded">
        <p className="text-primary text-sm mb-2">Performance Deviation</p>
        <p
          className={`text-base md:text-lg font-bold ${
            analysis.deviation?.pValue < 0.05 ? 'text-accent-orange' : 'text-primary'
          }`}
        >
          Z-score: {analysis.deviation?.zScore?.toFixed(2) || 'N/A'}
        </p>
        <p className="text-primary text-sm">
          P-value: {((analysis.deviation?.pValue || 0) * 100).toFixed(2)}%
        </p>
      </div>

      {/* Next Block Probabilities */}
      <div className="bg-navy border border-dark p-3 md:p-4 rounded">
        <p className="text-primary text-sm mb-2">Next Block Probabilities</p>
        {predictionData?.nextBlockProbabilities && (
          <div className="space-y-1 text-sm">
            <p className="text-primary">
              1h: <span className="text-accent-orange">{formatProbability(predictionData.nextBlockProbabilities.within1h)}</span>
            </p>
            <p className="text-primary">
              2h: <span className="text-accent-orange">{formatProbability(predictionData.nextBlockProbabilities.within2h)}</span>
            </p>
            <p className="text-primary">
              4h: <span className="text-accent-orange">{formatProbability(predictionData.nextBlockProbabilities.within4h)}</span>
            </p>
            <p className="text-primary">
              8h: <span className="text-accent-orange">{formatProbability(predictionData.nextBlockProbabilities.within8h)}</span>
            </p>
          </div>
        )}
      </div>

      {/* Percentiles */}
      <div className="bg-navy border border-dark p-3 md:p-4 rounded">
        <p className="text-primary text-sm mb-2">Confidence Intervals</p>
        <div className="space-y-1 text-sm">
          <p className="text-primary">
            50%: <span className="text-accent-orange">{formatTimeInterval(analysis.timePercentiles[0])}</span>
          </p>
          <p className="text-primary">
            80%: <span className="text-accent-orange">{formatTimeInterval(analysis.timePercentiles[1])}</span>
          </p>
          <p className="text-primary">
            90%: <span className="text-accent-orange">{formatTimeInterval(analysis.timePercentiles[2])}</span>
          </p>
        </div>
      </div>

      {/* Observed vs Expected Blocks */}
      <div className="bg-navy border border-dark p-3 md:p-4 rounded">
        <p className="text-primary text-sm mb-2">Recent Performance</p>
        <p className="text-primary text-sm">
          Observed: <span className="text-accent-orange">{analysis.observedBlocks}</span>
        </p>
        <p className="text-primary text-sm">
          Expected: <span className="text-accent-orange">{analysis.expectedBlocks.toFixed(2)}</span>
        </p>
        <p className="text-primary text-sm">
          Growth Factor: <span className="text-accent-orange">{analysis.growthFactor.toFixed(2)}</span>
        </p>
      </div>

      {/* Pool Hashrate & Network Info */}
      <div className="bg-navy border border-dark p-3 md:p-4 rounded">
        <p className="text-primary text-sm mb-2">Pool & Network</p>
        <p className="text-primary text-sm">
          Hashrate: <span className="text-accent-orange">{poolInfo.hashrateEH.toFixed(2)} EH/s</span>
        </p>
        <p className="text-primary text-sm">
          Network Share: <span className="text-accent-orange">{poolInfo.hashrateSharePercent.toFixed(2)}%</span>
        </p>
        {networkDifficulty > 0 && (
          <p className="text-primary text-sm">
            Difficulty: <span className="text-accent-orange">{networkDifficulty.toLocaleString()}</span>
          </p>
        )}
      </div>

      {/* Last Refresh */}
      <div className="pt-4 border-t border-dark">
        <p className="text-primary text-xs text-center">
          Last updated: {lastRefreshFormatted}
        </p>
      </div>
    </div>
  );
}

// Memoize StatsPanel to prevent unnecessary re-renders
export const StatsPanel = React.memo(StatsPanelComponent, (prevProps, nextProps) => {
  // Custom comparison - compare key properties
  // Since we're using context, we compare the actual values
  // This comparison will be checked when context updates
  return false; // Always allow re-render and let React.memo handle shallow comparison
});
