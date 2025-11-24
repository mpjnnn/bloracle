import React from 'react';
import { PoolDataProvider } from './contexts/PoolDataContext.jsx';
import { Dashboard } from './components/Dashboard.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';

function App() {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('Application error:', {
          error,
          errorInfo,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
        });
      }}
    >
      <div className="min-h-screen bg-navy text-primary">
        <PoolDataProvider>
          <Dashboard />
        </PoolDataProvider>
      </div>
    </ErrorBoundary>
  );
}

export default App;


