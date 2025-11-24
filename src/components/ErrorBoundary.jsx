import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details to console
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Update state with error details
    this.setState({
      error,
      errorInfo,
    });

    // Call optional onError callback if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback UI if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="min-h-screen bg-navy text-primary flex items-center justify-center p-4">
          <div className="bg-navy-light border border-dark rounded-lg p-6 max-w-2xl w-full">
            <div className="text-center mb-6">
              <h1 className="text-3xl font-bold text-primary mb-2">Something went wrong</h1>
              <p className="text-accent-orange text-lg">An unexpected error occurred</p>
            </div>

            <div className="bg-navy border border-dark rounded p-4 mb-6">
              <p className="text-primary font-semibold mb-2">
                Error: {this.state.error?.name || 'Unknown Error'}
              </p>
              <p className="text-primary text-sm mb-4">
                {this.state.error?.message || 'An unexpected error occurred'}
              </p>

              {this.state.errorInfo && (
                <details className="text-primary text-sm">
                  <summary className="cursor-pointer text-accent-orange hover:opacity-80 mb-2">
                    Show Error Details
                  </summary>
                  <pre className="bg-navy p-3 rounded overflow-auto max-h-64 text-xs mt-2">
                    {this.state.error?.stack}
                    {'\n\n'}
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => {
                  this.resetError();
                  window.location.reload();
                }}
                className="px-6 py-3 bg-accent-orange text-navy font-semibold rounded hover:opacity-90 transition-opacity"
              >
                Try Again
              </button>
              <button
                onClick={() => {
                  this.resetError();
                  window.location.href = '/';
                }}
                className="px-6 py-3 bg-navy border border-dark text-primary font-semibold rounded hover:bg-navy-light transition-colors"
              >
                Go to Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

