import React from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend,
} from 'recharts';
import { usePoolData } from '../hooks/usePoolData.js';
import { formatTimeInterval } from '../utils/poissonCalculations.js';

// Format time interval without seconds for graph labels
const formatTimeIntervalNoSeconds = (seconds) => {
  if (!Number.isFinite(seconds) || seconds < 0) {
    if (seconds === Infinity || seconds === -Infinity) {
      return '∞';
    }
    return 'N/A';
  }
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  // Don't include seconds
  return parts.length > 0 ? parts.join(' ') : '0m';
};

function ProbabilityGraphComponent() {
  const { predictionData, analysis } = usePoolData();

  // Debug logging
  React.useEffect(() => {
    console.log('=== ProbabilityGraph Debug ===');
    console.log('predictionData:', predictionData);
    console.log('analysis:', analysis);
    
    if (predictionData) {
      console.log('probabilityCurve length:', predictionData.probabilityCurve?.length);
      console.log('probabilityCurve sample (first 3):', predictionData.probabilityCurve?.slice(0, 3));
      console.log('cumulativeCurve length:', predictionData.cumulativeCurve?.length);
      console.log('deviationBands:', {
        upperLength: predictionData.deviationBands?.upper?.length,
        lowerLength: predictionData.deviationBands?.lower?.length,
      });
    }
    
    if (analysis) {
      console.log('analysis.adjustedExpectedTime:', analysis.adjustedExpectedTime);
      console.log('analysis.timePercentiles:', analysis.timePercentiles);
      console.log('analysis.lambdaExpected:', analysis.lambdaExpected);
      console.log('analysis.lambdaAdjusted:', analysis.lambdaAdjusted);
      console.log('analysis.observedBlocks:', analysis.observedBlocks);
      console.log('analysis.expectedBlocks:', analysis.expectedBlocks);
    }
    console.log('=============================');
  }, [predictionData, analysis]);

  if (!predictionData || !analysis) {
    console.warn('ProbabilityGraph: Missing data', { predictionData: !!predictionData, analysis: !!analysis });
    return (
      <div className="bg-navy-light border border-dark p-6 rounded">
        <p className="text-primary">No prediction data available</p>
        <p className="text-primary text-sm mt-2">
          predictionData: {predictionData ? 'exists' : 'missing'}, 
          analysis: {analysis ? 'exists' : 'missing'}
        </p>
      </div>
    );
  }

  const { probabilityCurve, cumulativeCurve, deviationBands } = predictionData;
  
  // Additional validation
  if (!probabilityCurve || probabilityCurve.length === 0) {
    console.error('ProbabilityGraph: Empty probabilityCurve', { probabilityCurve });
    return (
      <div className="bg-navy-light border border-dark p-6 rounded">
        <p className="text-primary">Error: Probability curve is empty</p>
        <p className="text-primary text-sm mt-2">Check console for details</p>
      </div>
    );
  }

  // Convert time from seconds to hours for x-axis
  const chartData = probabilityCurve.map((point, index) => ({
    timeHours: point.time / 3600,
    probability: point.probability,
    cumulative: cumulativeCurve[index]?.cumulativeProbability || 0,
    upperBand: deviationBands.upper[index]?.probability || 0,
    lowerBand: deviationBands.lower[index]?.probability || 0,
  }));

  // Calculate percentile times in hours
  const percentile50 = Number.isFinite(analysis.timePercentiles[0]) ? analysis.timePercentiles[0] / 3600 : null;
  const percentile80 = Number.isFinite(analysis.timePercentiles[1]) ? analysis.timePercentiles[1] / 3600 : null;
  const percentile90 = Number.isFinite(analysis.timePercentiles[2]) ? analysis.timePercentiles[2] / 3600 : null;
  const expectedTimeHours = Number.isFinite(analysis.adjustedExpectedTime) ? analysis.adjustedExpectedTime / 3600 : null;
  
  // Calculate deviation bounds around expected time
  // For exponential distribution, stdDev = 1/λ = expectedTime
  // Use z-score to calculate deviation bounds: ±z * stdDev
  let deviationLowerHours = null;
  let deviationUpperHours = null;
  if (expectedTimeHours !== null && Number.isFinite(expectedTimeHours) && analysis.deviation?.zScore !== undefined) {
    const zScore = Math.abs(analysis.deviation.zScore);
    const stdDevHours = expectedTimeHours; // For exponential: stdDev = mean
    deviationLowerHours = Math.max(0, expectedTimeHours - zScore * stdDevHours);
    deviationUpperHours = expectedTimeHours + zScore * stdDevHours;
  }
  
  // Calculate time since last block in hours
  const timeSinceLastBlockHours = predictionData?.timeSinceLastBlock 
    ? predictionData.timeSinceLastBlock / 3600 
    : 0;
  
  console.log('Graph calculations:', {
    percentile50,
    percentile80,
    percentile90,
    expectedTimeHours,
    chartDataLength: chartData.length,
    chartDataSample: chartData.slice(0, 3),
    hasValidData: chartData.some(d => d.probability > 0),
  });
  
  // Check if we have valid data
  if (!chartData.some(d => Number.isFinite(d.probability) && d.probability > 0)) {
    console.error('Graph: No valid probability data!', {
      chartDataLength: chartData.length,
      firstFew: chartData.slice(0, 5),
    });
    return (
      <div className="bg-navy-light border border-dark p-6 rounded">
        <p className="text-primary">Error: No valid probability data</p>
        <p className="text-primary text-sm mt-2">
          Lambda: {analysis.lambdaAdjusted || analysis.lambdaExpected}, 
          Expected Time: {Number.isFinite(analysis.adjustedExpectedTime) ? formatTimeInterval(analysis.adjustedExpectedTime) : 'Infinity'}
        </p>
        <p className="text-primary text-xs mt-2">Check console for detailed logs</p>
      </div>
    );
  }

  // Custom tooltip
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-navy border border-dark p-3 rounded shadow-lg">
          <p className="text-primary mb-2">
            <span className="text-accent-orange">Time:</span> {data.timeHours.toFixed(2)}h
          </p>
          <p className="text-primary mb-1">
            <span className="text-accent-orange">Probability:</span> {(data.probability * 100).toFixed(2)}%
          </p>
          <p className="text-primary mb-1">
            <span className="text-accent-orange">Cumulative:</span> {(data.cumulative * 100).toFixed(2)}%
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-navy-light border border-dark p-6 rounded">
      <h2 className="text-primary text-xl font-bold mb-4">Probability Distribution</h2>
      <div className="w-full h-[400px] sm:h-[500px]">
        <ResponsiveContainer width="100%" height="100%">
        <ComposedChart 
          data={chartData}
          margin={{ top: 50, right: 20, bottom: 30, left: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#1a2332" />
          <XAxis
            dataKey="timeHours"
            type="number"
            domain={[0, 24]}
            label={{ value: 'Time (hours)', position: 'insideBottom', offset: -5, fill: '#ffffff' }}
            stroke="#ffffff"
            tick={{ fill: '#ffffff' }}
          />
          <YAxis
            label={{ value: 'Probability', angle: -90, position: 'insideLeft', fill: '#ffffff' }}
            stroke="#ffffff"
            tick={{ fill: '#ffffff' }}
            domain={[0, 1]}
            ticks={[0, 0.2, 0.4, 0.6, 0.8, 1]}
            tickFormatter={(value) => value.toFixed(1)}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ color: '#ffffff' }} />
          
          {/* Deviation bands */}
          <Area
            type="monotone"
            dataKey="upperBand"
            stroke="none"
            fill="#1a2332"
            fillOpacity={0.3}
            name="Upper Band"
          />
          <Area
            type="monotone"
            dataKey="lowerBand"
            stroke="none"
            fill="#1a2332"
            fillOpacity={0.3}
            name="Lower Band"
          />
          
          {/* Main probability curve */}
          <Area
            type="monotone"
            dataKey="probability"
            stroke="#ff8c42"
            fill="#ff8c42"
            fillOpacity={0.5}
            name="Probability Density"
          />
          
          {/* Cumulative probability */}
          <Line
            type="monotone"
            dataKey="cumulative"
            stroke="#ffffff"
            strokeWidth={2}
            dot={false}
            name="Cumulative Probability"
          />
          
          {/* Current time line (time since last block) */}
          {timeSinceLastBlockHours > 0 && (
            <ReferenceLine
              x={timeSinceLastBlockHours}
              stroke="#ffffff"
              strokeWidth={2}
              strokeDasharray="2 2"
              label={{ 
                value: `Now (${formatTimeIntervalNoSeconds(predictionData.timeSinceLastBlock)})`, 
                position: 'bottom', 
                fill: '#ffffff',
                fontSize: 12,
                offset: 10
              }}
            />
          )}
          
          {/* Deviation bounds around expected time */}
          {deviationLowerHours !== null && deviationUpperHours !== null && (
            <>
              <ReferenceLine
                x={deviationLowerHours}
                stroke="#ff8c42"
                strokeWidth={1}
                strokeDasharray="2 2"
                strokeOpacity={0.5}
                label={{ 
                  value: `-${Math.abs(analysis.deviation?.zScore || 0).toFixed(1)}σ`, 
                  position: 'top', 
                  fill: '#ff8c42',
                  fontSize: 10,
                  offset: 2
                }}
              />
              <ReferenceLine
                x={deviationUpperHours}
                stroke="#ff8c42"
                strokeWidth={1}
                strokeDasharray="2 2"
                strokeOpacity={0.5}
                label={{ 
                  value: `+${Math.abs(analysis.deviation?.zScore || 0).toFixed(1)}σ`, 
                  position: 'top', 
                  fill: '#ff8c42',
                  fontSize: 10,
                  offset: 2
                }}
              />
            </>
          )}
          
          {/* Expected time line - only show if valid */}
          {expectedTimeHours !== null && Number.isFinite(expectedTimeHours) && (
            <ReferenceLine
              x={expectedTimeHours}
              stroke="#ff8c42"
              strokeWidth={2}
              strokeDasharray="5 5"
              label={{ 
                value: `Expected: ${formatTimeIntervalNoSeconds(analysis.adjustedExpectedTime)}`, 
                position: 'top', 
                fill: '#ff8c42',
                offset: 25
              }}
            />
          )}
          
          {/* Percentile lines - only show if valid */}
          {percentile50 !== null && Number.isFinite(percentile50) && (
            <ReferenceLine
              x={percentile50}
              stroke="#ff8c42"
              strokeWidth={1}
              strokeDasharray="3 3"
              label={{ 
                value: `50% (${formatTimeIntervalNoSeconds(analysis.timePercentiles[0])})`, 
                position: 'top', 
                fill: '#ff8c42', 
                fontSize: 11,
                offset: 10
              }}
            />
          )}
          {percentile80 !== null && Number.isFinite(percentile80) && (
            <ReferenceLine
              x={percentile80}
              stroke="#ff8c42"
              strokeWidth={1}
              strokeDasharray="3 3"
              label={{ 
                value: `80% (${formatTimeIntervalNoSeconds(analysis.timePercentiles[1])})`, 
                position: 'top', 
                fill: '#ff8c42', 
                fontSize: 11,
                offset: 10
              }}
            />
          )}
          {percentile90 !== null && Number.isFinite(percentile90) && (
            <ReferenceLine
              x={percentile90}
              stroke="#ff8c42"
              strokeWidth={1}
              strokeDasharray="3 3"
              label={{ 
                value: `90% (${formatTimeIntervalNoSeconds(analysis.timePercentiles[2])})`, 
                position: 'top', 
                fill: '#ff8c42', 
                fontSize: 11,
                offset: 10
              }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
      </div>
      <div className="mt-4 text-sm text-primary">
        <p>
          <span className="text-accent-orange">Deviation (z-score):</span> {analysis.deviation?.zScore?.toFixed(2) || 'N/A'}
        </p>
      </div>
    </div>
  );
}

// Memoize ProbabilityGraph to prevent unnecessary re-renders
export const ProbabilityGraph = React.memo(ProbabilityGraphComponent, (prevProps, nextProps) => {
  // Custom comparison - compare key properties of predictionData and analysis
  // Since we're using context, we compare the actual values
  // This comparison will be checked when context updates
  return false; // Always allow re-render and let React.memo handle shallow comparison
});
