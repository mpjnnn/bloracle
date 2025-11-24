import React from 'react';

export function LoadingSpinner({ message = 'Loading pool data...', fullHeight = false }) {
  return (
    <div
      className={`bg-navy flex items-center justify-center ${
        fullHeight ? 'min-h-screen' : 'min-h-[400px]'
      }`}
    >
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-navy-light border-t-accent-orange mb-4"></div>
        <p className="text-primary text-lg">{message}</p>
      </div>
    </div>
  );
}



