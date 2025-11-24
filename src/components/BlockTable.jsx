import React, { useState, useMemo, useEffect } from 'react';
import { format } from 'date-fns';
import { FixedSizeList } from 'react-window';
import { usePoolData } from '../hooks/usePoolData.js';

function BlockTableComponent() {
  const { blocks, selectedBlocks, setSelectedBlocks } = usePoolData();
  const [sortColumn, setSortColumn] = useState('height');
  const [sortDirection, setSortDirection] = useState('desc');
  const [listHeight, setListHeight] = useState(400);
  const [filters, setFilters] = useState({
    heightMin: '',
    heightMax: '',
    rewardMin: '',
    rewardMax: '',
    txCountMin: '',
    txCountMax: '',
    timestampMin: '',
    timestampMax: '',
  });

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const filteredAndSortedBlocks = useMemo(() => {
    if (!blocks || blocks.length === 0) return [];

    // Apply filters
    let filtered = blocks.filter((block) => {
      if (filters.heightMin && block.height < Number(filters.heightMin)) return false;
      if (filters.heightMax && block.height > Number(filters.heightMax)) return false;
      if (filters.rewardMin && block.rewardBTC < Number(filters.rewardMin)) return false;
      if (filters.rewardMax && block.rewardBTC > Number(filters.rewardMax)) return false;
      if (filters.txCountMin && block.tx_count < Number(filters.txCountMin)) return false;
      if (filters.txCountMax && block.tx_count > Number(filters.txCountMax)) return false;
      // Timestamp range filters
      if (filters.timestampMin) {
        const minTimestamp = Math.floor(Date.parse(filters.timestampMin) / 1000);
        if (!isNaN(minTimestamp) && block.timestamp < minTimestamp) return false;
      }
      if (filters.timestampMax) {
        const maxTimestamp = Math.floor(Date.parse(filters.timestampMax) / 1000);
        if (!isNaN(maxTimestamp) && block.timestamp > maxTimestamp) return false;
      }
      return true;
    });

    // Apply sorting
    filtered.sort((a, b) => {
      let aVal, bVal;
      switch (sortColumn) {
        case 'height':
          aVal = a.height;
          bVal = b.height;
          break;
        case 'timestamp':
          aVal = a.timestamp;
          bVal = b.timestamp;
          break;
        case 'reward':
          aVal = a.rewardBTC;
          bVal = b.rewardBTC;
          break;
        case 'medianFeeRate':
          aVal = a.medianFeeRate;
          bVal = b.medianFeeRate;
          break;
        case 'avgFee':
          aVal = a.avgFee;
          bVal = b.avgFee;
          break;
        case 'tx_count':
          aVal = a.tx_count;
          bVal = b.tx_count;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [blocks, filters, sortColumn, sortDirection]);

  const handleRowClick = (block) => {
    const isSelected = selectedBlocks.some((b) => b.id === block.id);
    if (isSelected) {
      setSelectedBlocks(selectedBlocks.filter((b) => b.id !== block.id));
    } else {
      setSelectedBlocks([...selectedBlocks, block]);
    }
  };

  const isRowSelected = (blockId) => {
    return selectedBlocks.some((b) => b.id === blockId);
  };

  // Update list height based on viewport
  useEffect(() => {
    const updateHeight = () => {
      setListHeight(window.innerWidth < 768 ? 400 : 600);
    };
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  const SortIndicator = ({ column }) => {
    if (sortColumn !== column) return null;
    return <span className="text-accent-orange ml-1">{sortDirection === 'asc' ? '▲' : '▼'}</span>;
  };

  if (!blocks || blocks.length === 0) {
    return (
      <div className="bg-navy-light border border-dark p-4 md:p-6 rounded">
        <p className="text-primary">No blocks available</p>
      </div>
    );
  }

  // Row component for virtualization
  const Row = ({ index, style }) => {
    const block = filteredAndSortedBlocks[index];
    if (!block) return null;
    
    const isSelected = isRowSelected(block.id);
    return (
      <div
        style={style}
        onClick={() => handleRowClick(block)}
        className={`cursor-pointer border-b border-dark transition-colors grid grid-cols-[15%_25%_15%_15%_15%_15%] ${
          isSelected
            ? 'bg-accent-orange bg-opacity-20 border-l-4 border-l-accent-orange'
            : index % 2 === 0
            ? 'bg-navy'
            : 'bg-navy-light'
        } hover:bg-opacity-30`}
      >
        <div className="text-primary p-2">{block.height}</div>
        <div className="text-primary p-2 text-sm">
          {format(new Date(block.timestamp * 1000), 'PPpp')}
        </div>
        <div className="text-primary p-2">{block.rewardBTC.toFixed(8)}</div>
        <div className="text-primary p-2">{block.medianFeeRate}</div>
        <div className="text-primary p-2">{block.avgFee}</div>
        <div className="text-primary p-2">{block.tx_count}</div>
      </div>
    );
  };

  return (
    <div className="bg-navy-light border border-dark p-4 md:p-6 rounded">
      <h2 className="text-primary text-xl font-bold mb-4">Block Table</h2>

      {/* Filters */}
      <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <div>
          <label className="text-primary text-sm block mb-1">Height Min</label>
          <input
            type="number"
            value={filters.heightMin}
            onChange={(e) => handleFilterChange('heightMin', e.target.value)}
            className="w-full bg-navy border border-dark text-primary px-2 py-1 rounded"
            placeholder="Min"
          />
        </div>
        <div>
          <label className="text-primary text-sm block mb-1">Height Max</label>
          <input
            type="number"
            value={filters.heightMax}
            onChange={(e) => handleFilterChange('heightMax', e.target.value)}
            className="w-full bg-navy border border-dark text-primary px-2 py-1 rounded"
            placeholder="Max"
          />
        </div>
        <div>
          <label className="text-primary text-sm block mb-1">Reward Min (BTC)</label>
          <input
            type="number"
            step="0.00000001"
            value={filters.rewardMin}
            onChange={(e) => handleFilterChange('rewardMin', e.target.value)}
            className="w-full bg-navy border border-dark text-primary px-2 py-1 rounded"
            placeholder="Min"
          />
        </div>
        <div>
          <label className="text-primary text-sm block mb-1">Reward Max (BTC)</label>
          <input
            type="number"
            step="0.00000001"
            value={filters.rewardMax}
            onChange={(e) => handleFilterChange('rewardMax', e.target.value)}
            className="w-full bg-navy border border-dark text-primary px-2 py-1 rounded"
            placeholder="Max"
          />
        </div>
        <div>
          <label className="text-primary text-sm block mb-1">Tx Count Min</label>
          <input
            type="number"
            value={filters.txCountMin}
            onChange={(e) => handleFilterChange('txCountMin', e.target.value)}
            className="w-full bg-navy border border-dark text-primary px-2 py-1 rounded"
            placeholder="Min"
          />
        </div>
        <div>
          <label className="text-primary text-sm block mb-1">Tx Count Max</label>
          <input
            type="number"
            value={filters.txCountMax}
            onChange={(e) => handleFilterChange('txCountMax', e.target.value)}
            className="w-full bg-navy border border-dark text-primary px-2 py-1 rounded"
            placeholder="Max"
          />
        </div>
        <div>
          <label className="text-primary text-sm block mb-1">Timestamp Min</label>
          <input
            type="datetime-local"
            value={filters.timestampMin}
            onChange={(e) => handleFilterChange('timestampMin', e.target.value)}
            className="w-full bg-navy border border-dark text-primary px-2 py-1 rounded"
          />
        </div>
        <div>
          <label className="text-primary text-sm block mb-1">Timestamp Max</label>
          <input
            type="datetime-local"
            value={filters.timestampMax}
            onChange={(e) => handleFilterChange('timestampMax', e.target.value)}
            className="w-full bg-navy border border-dark text-primary px-2 py-1 rounded"
          />
        </div>
      </div>

      <p className="text-primary text-sm mb-4">
        {filteredAndSortedBlocks.length} block{filteredAndSortedBlocks.length !== 1 ? 's' : ''} shown ({blocks.length} total)
      </p>

      {/* Table */}
      <div className="overflow-x-auto">
        {filteredAndSortedBlocks.length === 0 ? (
          <div className="bg-navy border border-dark p-4 rounded">
            <p className="text-primary text-center">No blocks found matching filters</p>
          </div>
        ) : (
          <div className="overflow-hidden">
            {/* Table Header */}
            <div className="bg-navy border-b border-dark grid grid-cols-[15%_25%_15%_15%_15%_15%] sticky top-0 z-10">
              <div
                className="text-left text-primary p-2 cursor-pointer hover:text-accent-orange transition-colors"
                onClick={() => handleSort('height')}
              >
                Block Height <SortIndicator column="height" />
              </div>
              <div
                className="text-left text-primary p-2 cursor-pointer hover:text-accent-orange transition-colors"
                onClick={() => handleSort('timestamp')}
              >
                Timestamp <SortIndicator column="timestamp" />
              </div>
              <div
                className="text-left text-primary p-2 cursor-pointer hover:text-accent-orange transition-colors"
                onClick={() => handleSort('reward')}
              >
                Reward (BTC) <SortIndicator column="reward" />
              </div>
              <div
                className="text-left text-primary p-2 cursor-pointer hover:text-accent-orange transition-colors"
                onClick={() => handleSort('medianFeeRate')}
              >
                Median Fee Rate (sat/vB) <SortIndicator column="medianFeeRate" />
              </div>
              <div
                className="text-left text-primary p-2 cursor-pointer hover:text-accent-orange transition-colors"
                onClick={() => handleSort('avgFee')}
              >
                Avg Fee (sat) <SortIndicator column="avgFee" />
              </div>
              <div
                className="text-left text-primary p-2 cursor-pointer hover:text-accent-orange transition-colors"
                onClick={() => handleSort('tx_count')}
              >
                Transactions <SortIndicator column="tx_count" />
              </div>
            </div>
            {/* Virtualized Rows */}
            <div style={{ height: `${listHeight}px` }}>
              <FixedSizeList
                height={listHeight}
                itemCount={filteredAndSortedBlocks.length}
                itemSize={48}
                width="100%"
              >
                {Row}
              </FixedSizeList>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Memoize BlockTable to prevent unnecessary re-renders
export const BlockTable = React.memo(BlockTableComponent, (prevProps, nextProps) => {
  // Custom comparison - compare blocks, selectedBlocks, sortColumn, sortDirection, filters
  // Since we're using context, we compare the actual values
  // This comparison will be checked when context updates
  return false; // Always allow re-render and let React.memo handle shallow comparison
});

