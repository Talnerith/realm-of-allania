'use client';
import { Component } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });

    // TODO: Send error to logging service (e.g., Sentry, LogRocket)
    // Example: logErrorToService(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans">
          <div className="max-w-2xl w-full bg-slate-900 border border-amber-900/50 rounded-xl p-8 shadow-2xl">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-red-900/30 rounded-full">
                <AlertTriangle className="w-8 h-8 text-red-400" />
              </div>
              <div>
                <h1 className="text-3xl font-serif font-bold text-amber-100">
                  A Dark Shadow Has Fallen
                </h1>
                <p className="text-slate-400 text-sm mt-1">
                  An unexpected error has disrupted the realm
                </p>
              </div>
            </div>

            <div className="bg-black/40 border border-slate-800 rounded-lg p-4 mb-6">
              <p className="text-slate-300 text-sm leading-relaxed mb-3">
                The Oracle&apos;s vision has grown cloudy. The Chronicles cannot continue at this time.
              </p>
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mt-4">
                  <summary className="text-xs text-amber-500 cursor-pointer hover:text-amber-400 mb-2 font-mono">
                    Show Technical Details (Development Only)
                  </summary>
                  <div className="bg-slate-950 border border-red-900/30 rounded p-3 mt-2 overflow-auto max-h-64">
                    <pre className="text-xs text-red-300 font-mono whitespace-pre-wrap break-words">
                      {this.state.error.toString()}
                      {'\n\n'}
                      {this.state.errorInfo?.componentStack}
                    </pre>
                  </div>
                </details>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-amber-700 hover:bg-amber-600 text-white rounded-lg transition-colors font-bold"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>
              <button
                onClick={this.handleGoHome}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-lg transition-colors font-bold"
              >
                <Home className="w-4 h-4" />
                Return Home
              </button>
              <button
                onClick={this.handleReload}
                className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 rounded-lg transition-colors text-sm"
                title="Reload Page"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <p className="text-center text-xs text-slate-600 mt-6">
              If this problem persists, please contact the realm administrators.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

