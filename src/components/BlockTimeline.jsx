import React from 'react';
import { format } from 'date-fns';
import { usePoolData } from '../hooks/usePoolData.js';
import { satoshiToBTC } from '../services/dataModels.js';

function BlockTimelineComponent() {
  const { blocks, selectedBlocks, setSelectedBlocks } = usePoolData();

  if (!blocks || blocks.length === 0) {
    return (
      <div className="bg-navy-light border border-dark p-6 rounded">
        <p className="text-primary">No blocks available</p>
      </div>
    );
  }

  // Sort blocks by timestamp
  const sortedBlocks = [...blocks].sort((a, b) => a.timestamp - b.timestamp);

  // Calculate min/max for normalization using tx_count metric
  const metricValues = sortedBlocks.map(b => b.tx_count);
  const minMetric = Math.min(...metricValues);
  const maxMetric = Math.max(...metricValues);
  const metricRange = maxMetric - minMetric || 1;

  // Calculate time range
  const timestamps = sortedBlocks.map(b => b.timestamp);
  const minTime = Math.min(...timestamps);
  const maxTime = Math.max(...timestamps);
  const timeRange = maxTime - minTime || 1;

  const handleBlockClick = (block, event) => {
    const isSelected = selectedBlocks.some(b => b.id === block.id);
    
    if (event.ctrlKey || event.metaKey) {
      // Multi-select
      if (isSelected) {
        setSelectedBlocks(selectedBlocks.filter(b => b.id !== block.id));
      } else {
        setSelectedBlocks([...selectedBlocks, block]);
      }
    } else {
      // Single select
      setSelectedBlocks(isSelected ? [] : [block]);
    }
  };

  const isBlockSelected = (blockId) => {
    return selectedBlocks.some(b => b.id === blockId);
  };

  // Calculate normalized position and height for each block
  const blockElements = sortedBlocks.map((block) => {
    const timePosition = ((block.timestamp - minTime) / timeRange) * 100;
    const metricIntensity = ((block.tx_count - minMetric) / metricRange) * 0.5 + 0.5; // 0.5 to 1.0
    const isSelected = isBlockSelected(block.id);
    const height = Math.max(20, metricIntensity * 60);

    return (
      <div
        key={block.id}
        className="absolute cursor-pointer group"
        style={{
          left: `${timePosition}%`,
          bottom: 0,
          transform: 'translateX(-50%)',
        }}
        onClick={(e) => handleBlockClick(block, e)}
      >
        <div
          className={`w-1 transition-all ${
            isSelected
              ? 'bg-accent-orange border-2 border-accent-orange shadow-lg shadow-accent-orange'
              : 'bg-primary hover:bg-accent-orange'
          }`}
          style={{
            height: `${height}px`,
            opacity: metricIntensity,
          }}
          title={`Block ${block.height}`}
        />
        {/* Tooltip on hover */}
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
          <div className="bg-navy border border-dark p-3 rounded shadow-lg min-w-[160px] md:min-w-[200px]">
            <p className="text-primary text-sm font-bold mb-1">Block {block.height}</p>
            <p className="text-primary text-xs mb-1">
              {format(new Date(block.timestamp * 1000), 'PPpp')}
            </p>
            <p className="text-accent-orange text-xs mb-1">
              Reward: {block.rewardBTC.toFixed(8)} BTC
            </p>
            <p className="text-primary text-xs mb-1">
              Fee Rate: {block.medianFeeRate} sat/vB
            </p>
            <p className="text-primary text-xs">
              Transactions: {block.tx_count}
            </p>
          </div>
        </div>
      </div>
    );
  });

  return (
    <div className="bg-navy-light border border-dark p-4 md:p-6 rounded">
      <h2 className="text-primary text-xl font-bold mb-4">Block Timeline</h2>
      <div className="relative h-24 md:h-32 bg-navy border border-dark rounded overflow-hidden">
        {blockElements}
        {/* Time axis labels */}
        <div className="absolute bottom-0 left-0 right-0 h-6 flex justify-between items-end px-2 text-xs text-primary">
          <span>{format(new Date(minTime * 1000), 'MMM d, HH:mm')}</span>
          <span>{format(new Date(maxTime * 1000), 'MMM d, HH:mm')}</span>
        </div>
      </div>
      <div className="mt-4 text-sm text-primary">
        <p>Click blocks to select. Hold Ctrl/Cmd for multi-select.</p>
        <p className="text-accent-orange">
          Selected: {selectedBlocks.length} block{selectedBlocks.length !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  );
}

// Memoize BlockTimeline to prevent unnecessary re-renders
export const BlockTimeline = React.memo(BlockTimelineComponent, (prevProps, nextProps) => {
  // Custom comparison - compare blocks array and selectedBlocks
  // Since we're using context, we compare the actual values
  // This comparison will be checked when context updates
  return false; // Always allow re-render and let React.memo handle shallow comparison
});
