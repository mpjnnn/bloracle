import React from 'react';
import { ApiError } from '../services/mempoolApi.js';

export function ErrorDisplay({ error, onRetry, fullHeight = false }) {
  if (!error) return null;

  const isApiError = error instanceof ApiError;
  const errorMessage = error.message || String(error);
  const statusCode = isApiError ? error.status : null;
  const retryable = isApiError ? error.retryable : false;
  const showRetry = (retryable || onRetry) && onRetry;

  return (
    <div
      className={`bg-navy flex items-center justify-center ${
        fullHeight ? 'min-h-screen' : 'min-h-[400px]'
      }`}
    >
      <div className="text-center max-w-md mx-auto p-6 border border-dark rounded-lg bg-navy-light">
        <div className="text-4xl mb-4">⚠️</div>
        <h2 className="text-primary text-xl font-bold mb-2">Error</h2>
        <p className="text-primary mb-2">{errorMessage}</p>
        {statusCode && (
          <p className="text-primary text-sm mb-4">Status Code: {statusCode}</p>
        )}
        {showRetry && (
          <button
            onClick={onRetry}
            className="mt-4 px-6 py-2 bg-accent-orange text-navy font-semibold rounded hover:opacity-90 transition-opacity"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}



