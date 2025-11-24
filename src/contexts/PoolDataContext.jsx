import React, { createContext, useState, useEffect, useCallback } from 'react';
import { fetchPoolBlocks, fetchPoolInfo, ApiError } from '../services/mempoolApi.js';
import { analyzePoolPerformance, generatePredictionData } from '../utils/poissonCalculations.js';

const PoolDataContext = createContext(null);

export function PoolDataProvider({ children }) {
  const [poolSlug, setPoolSlug] = useState('innopolistech');
  const [blocks, setBlocks] = useState([]);
  const [poolInfo, setPoolInfo] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [predictionData, setPredictionData] = useState(null);
  const [selectedBlocks, setSelectedBlocks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [isPollingEnabled, setIsPollingEnabled] = useState(true);

  // Get current time in UTC+3
  const getCurrentTimeUTC3 = () => {
    const now = new Date();
    const utc3Offset = 3 * 60 * 60; // UTC+3 in seconds
    return Math.floor(now.getTime() / 1000) + utc3Offset;
  };

  const fetchData = useCallback(async (forceRefresh = false) => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch pool blocks and info
      const [blocksData, poolInfoData] = await Promise.all([
        fetchPoolBlocks(poolSlug, null, { forceRefresh }),
        fetchPoolInfo(poolSlug, { forceRefresh }),
      ]);

      setBlocks(blocksData);
      
      // If poolInfo has no hashrate data, try to estimate from blocks
      let poolInfoToUse = poolInfoData;
      if (poolInfoData.hashrateShare === 0 && poolInfoData.estimatedHashrate === 0 && blocksData.length > 0) {
        console.warn('⚠️ Pool info has no hashrate data. Attempting to estimate from blocks...');
        
        // Calculate estimated hashrate share from block count over available time period
        // Find the time range of available blocks
        const blockTimestamps = blocksData.map(b => b.timestamp).filter(ts => ts > 0);
        if (blockTimestamps.length > 0) {
          const oldestBlock = Math.min(...blockTimestamps);
          const newestBlock = Math.max(...blockTimestamps);
          const timeRangeSeconds = newestBlock - oldestBlock;
          const timeRangeDays = timeRangeSeconds / 86400;
          
          console.log('Block time range:', {
            oldestBlock: new Date(oldestBlock * 1000).toISOString(),
            newestBlock: new Date(newestBlock * 1000).toISOString(),
            timeRangeDays: timeRangeDays.toFixed(2),
            totalBlocks: blocksData.length,
          });
          
          // Estimate hashrate share: (blocks_mined / time_days) / 144 blocks_per_day
          // This gives us the average daily block rate, divided by network rate
          if (timeRangeDays > 0) {
            const blocksPerDay = blocksData.length / timeRangeDays;
            const estimatedShare = blocksPerDay / 144; // Network mines ~144 blocks/day
            
            console.log('Estimated hashrate share from blocks:', {
              blocksPerDay: blocksPerDay.toFixed(2),
              estimatedShare: estimatedShare.toFixed(6),
              estimatedSharePercent: (estimatedShare * 100).toFixed(4),
            });
            
            if (estimatedShare > 0 && estimatedShare <= 1) {
              poolInfoToUse = {
                ...poolInfoData,
                hashrateShare: estimatedShare,
                hashrateSharePercent: estimatedShare * 100,
                blocksMined24h: Math.round(blocksPerDay),
                name: poolInfoData.name || poolSlug,
                slug: poolInfoData.slug || poolSlug,
              };
              console.log('✅ Using estimated hashrate share:', estimatedShare);
            } else {
              console.warn('⚠️ Estimated share is invalid:', estimatedShare);
            }
          }
        }
      }
      
      setPoolInfo(poolInfoToUse);

      // Debug logging
      console.log('=== PoolDataContext: Data Fetched ===');
      console.log('Pool slug:', poolSlug);
      console.log('Blocks count:', blocksData.length);
      console.log('Blocks sample (first 3):', blocksData.slice(0, 3).map(b => ({
        height: b.height,
        timestamp: b.timestamp,
        timestampDate: new Date(b.timestamp * 1000).toISOString(),
      })));
      console.log('PoolInfo (original):', {
        name: poolInfoData.name,
        slug: poolInfoData.slug,
        hashrateShare: poolInfoData.hashrateShare,
        estimatedHashrate: poolInfoData.estimatedHashrate,
      });
      console.log('PoolInfo (using):', {
        name: poolInfoToUse.name,
        slug: poolInfoToUse.slug,
        hashrateShare: poolInfoToUse.hashrateShare,
        hashrateSharePercent: poolInfoToUse.hashrateSharePercent,
        hashrateEH: poolInfoToUse.hashrateEH,
        estimatedHashrate: poolInfoToUse.estimatedHashrate,
        blocksMined24h: poolInfoToUse.blocksMined24h,
        lastBlockTimestamp: poolInfoToUse.lastBlockTimestamp,
        lastBlockTimestampDate: poolInfoToUse.lastBlockTimestamp ? new Date(poolInfoToUse.lastBlockTimestamp * 1000).toISOString() : 'N/A',
      });

      // Compute analysis using current time (UTC+3)
      const currentTime = getCurrentTimeUTC3();
      const analysisResult = analyzePoolPerformance(blocksData, poolInfoToUse, 24);
      console.log('Analysis result summary:', {
        observedBlocks: analysisResult.observedBlocks,
        expectedBlocks: analysisResult.expectedBlocks,
        lambdaExpected: analysisResult.lambdaExpected,
        lambdaAdjusted: analysisResult.lambdaAdjusted,
        adjustedExpectedTime: analysisResult.adjustedExpectedTime,
        adjustedExpectedTimeHours: analysisResult.adjustedExpectedTime / 3600,
        isInfinity: !Number.isFinite(analysisResult.adjustedExpectedTime),
      });
      setAnalysis(analysisResult);

      // Generate prediction curves with maxHours=24
      const predictionResult = generatePredictionData(blocksData, poolInfoToUse, currentTime, 24);
      console.log('Prediction data summary:', {
        probabilityCurveLength: predictionResult.probabilityCurve?.length || 0,
        cumulativeCurveLength: predictionResult.cumulativeCurve?.length || 0,
        deviationBandsUpperLength: predictionResult.deviationBands?.upper?.length || 0,
        deviationBandsLowerLength: predictionResult.deviationBands?.lower?.length || 0,
        nextBlockProbabilities: predictionResult.nextBlockProbabilities,
        timeSinceLastBlock: predictionResult.timeSinceLastBlock,
      });
      console.log('=====================================');
      setPredictionData(predictionResult);

      setLastRefresh(new Date());
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err);
      } else {
        setError(new Error(err.message || 'Failed to fetch pool data'));
      }
    } finally {
      setIsLoading(false);
    }
  }, [poolSlug]);

  const refreshData = useCallback(() => {
    fetchData(true);
  }, [fetchData]);

  // Initial load on mount
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Automatic polling with visibility API support
  useEffect(() => {
    if (!isPollingEnabled) return;

    const handleVisibilityChange = () => {
      // Polling will be controlled by visibility state in the interval
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    const pollInterval = setInterval(() => {
      // Only poll if tab is visible
      if (!document.hidden) {
        fetchData(true);
      }
    }, 60000); // 60 seconds

    // Cleanup on unmount or when polling is disabled
    return () => {
      clearInterval(pollInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchData, isPollingEnabled]);

  const contextValue = {
    poolSlug,
    blocks,
    poolInfo,
    analysis,
    predictionData,
    selectedBlocks,
    isLoading,
    error,
    lastRefresh,
    setSelectedBlocks,
    refreshData,
    setPoolSlug,
    isPollingEnabled,
    setIsPollingEnabled,
  };

  return (
    <PoolDataContext.Provider value={contextValue}>
      {children}
    </PoolDataContext.Provider>
  );
}

export default PoolDataContext;

