import React, { useState, useEffect } from 'react';
import { fetchAvailablePools, ApiError } from '../services/mempoolApi.js';
import { usePoolData } from '../hooks/usePoolData.js';

export function PoolSelector() {
  const { poolSlug, setPoolSlug, poolInfo } = usePoolData();
  const [availablePools, setAvailablePools] = useState([]);
  const [isLoadingPools, setIsLoadingPools] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadPools = async () => {
      setIsLoadingPools(true);
      setError(null);
      try {
        const pools = await fetchAvailablePools('1w');
        // Pools are already sorted by the API function
        setAvailablePools(pools);
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError('Failed to load pools');
        }
        console.error('Error loading pools:', err);
      } finally {
        setIsLoadingPools(false);
      }
    };

    loadPools();
  }, []);

  const handlePoolChange = (e) => {
    const newSlug = e.target.value;
    if (newSlug && newSlug !== poolSlug) {
      setPoolSlug(newSlug);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <select
        id="pool-select"
        value={poolSlug}
        onChange={handlePoolChange}
        disabled={isLoadingPools}
        className="bg-navy border border-dark text-primary px-4 py-2 rounded focus:outline-none focus:border-accent-orange transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[200px]"
      >
        {isLoadingPools ? (
          <option value="">Loading pools...</option>
        ) : error ? (
          <option value="">Error loading pools</option>
        ) : availablePools.length === 0 ? (
          <option value="">No pools available</option>
        ) : (
          <>
            {availablePools.map((pool) => (
              <option key={pool.slug} value={pool.slug}>
                {pool.name} {pool.blockCount > 0 ? `(${pool.blockCount} blocks)` : ''}
              </option>
            ))}
          </>
        )}
      </select>
      {error && (
        <p className="text-red-500 text-xs text-center">Error: {error}</p>
      )}
    </div>
  );
}

