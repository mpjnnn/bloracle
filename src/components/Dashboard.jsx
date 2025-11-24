import React from 'react';
import { format } from 'date-fns';
import { ProbabilityGraph } from './ProbabilityGraph.jsx';
import { StatsPanel } from './StatsPanel.jsx';
import { BlockTimeline } from './BlockTimeline.jsx';
import { BlockTable } from './BlockTable.jsx';
import { LoadingSpinner } from './LoadingSpinner.jsx';
import { ErrorDisplay } from './ErrorDisplay.jsx';
import { PoolSelector } from './PoolSelector.jsx';
import { usePoolData } from '../hooks/usePoolData.js';

function DashboardComponent() {
  const { isLoading, error, poolInfo, lastRefresh, refreshData, isPollingEnabled, setIsPollingEnabled, poolSlug } = usePoolData();

  // ConstFlux Badge Component (reusable)
  const ConstFluxBadge = () => (
    <div className="fixed bottom-4 right-4 z-50">
      <a
        href="https://constflux.com"
        target="_blank"
        rel="noopener noreferrer"
        className="block transition-transform hover:scale-105 active:scale-95"
        aria-label="Visit ConstFlux"
      >
        <img
          src="https://raw.githubusercontent.com/conflcom/public-materials/main/AgentBadge012.png"
          alt="ConstFlux Badge"
          className="h-12 w-auto opacity-80 hover:opacity-100 transition-opacity"
        />
      </a>
    </div>
  );

  if (isLoading) {
    return (
      <>
        <LoadingSpinner fullHeight={true} />
        <ConstFluxBadge />
      </>
    );
  }

  if (error) {
    return (
      <>
        <ErrorDisplay error={error} onRetry={refreshData} fullHeight={true} />
        <ConstFluxBadge />
      </>
    );
  }
  
  // Check if pool info is missing or invalid
  if (poolInfo && (!poolInfo.name || poolInfo.hashrateShare === 0)) {
    return (
      <>
        <div className="min-h-screen bg-navy text-primary p-4 md:p-6">
          <div className="bg-navy-light border border-dark p-6 rounded max-w-2xl mx-auto mt-8">
            <h2 className="text-2xl font-bold text-primary mb-4">Pool Data Not Available</h2>
            <p className="text-primary mb-4">
              The pool <strong className="text-accent-orange">{poolSlug}</strong> does not have available data in the API, 
              or the pool may not exist.
            </p>
            <p className="text-primary mb-4">
              Please try selecting a different pool from the dropdown above, or check if the pool slug is correct.
            </p>
            <div className="mt-4">
              <button
                onClick={refreshData}
                className="px-4 py-2 bg-accent-orange text-navy font-semibold rounded hover:opacity-90 transition-opacity"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
        <ConstFluxBadge />
      </>
    );
  }

  const lastRefreshFormatted = lastRefresh
    ? format(lastRefresh, 'PPpp')
    : 'Never';

  return (
    <div className="min-h-screen bg-navy text-primary p-4 md:p-6">
      {/* Header */}
      <div className="mb-6 pb-4 border-b border-dark">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Left: BLOCRACLE */}
          <div className="flex-shrink-0">
            <h1 className="text-3xl font-bold text-primary">
              BLOCRACLE
            </h1>
          </div>

          {/* Middle: Pool Selector and mempool.space */}
          <div className="flex-1 flex justify-center items-center gap-4">
            <div className="w-full max-w-md">
              <PoolSelector />
            </div>
            <div className="flex-shrink-0">
              <p className="text-primary text-sm">mempool.space</p>
            </div>
          </div>

          {/* Right: Last Updated */}
          <div className="flex-shrink-0 text-right">
            <p className="text-primary text-sm">Last updated: {lastRefreshFormatted}</p>
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 md:grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        {/* Left Panel: Probability Graph */}
        <div className="lg:col-span-2">
          <ProbabilityGraph />
        </div>

        {/* Right Panel: Stats Panel */}
        <div className="lg:col-span-1">
          <StatsPanel />
        </div>
      </div>

      {/* Bottom Panel: Timeline and Table */}
      <div className="space-y-6">
        <BlockTimeline />
        <BlockTable />
      </div>

      {/* ConstFlux Badge - Bottom Right */}
      <ConstFluxBadge />
    </div>
  );
}

// Memoize Dashboard to prevent unnecessary re-renders
export const Dashboard = React.memo(DashboardComponent, (prevProps, nextProps) => {
  // Custom comparison function - Dashboard uses context, so we check context values
  // This will be handled by each child component's own memoization
  return false; // Always allow re-render since we're using context
});
