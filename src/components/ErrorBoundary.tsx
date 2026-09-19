import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Application ErrorBoundary Caught Error]:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          id="app-error-boundary-screen"
          className="min-h-screen bg-gray-50 flex items-center justify-center p-4 text-gray-900 selection:bg-emerald-500 selection:text-white"
        >
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-100 p-6 sm:p-8 text-center space-y-4">
            <div className="inline-flex p-3 bg-red-50 text-red-600 rounded-2xl">
              <AlertCircle className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h1 className="text-lg font-bold text-gray-900">Something went wrong</h1>
              <p className="text-xs text-gray-600 leading-relaxed">
                The storefront encountered an unexpected display issue. Your saved basket and preferences are safe.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-left max-h-48 overflow-y-auto">
                <p className="text-[11px] font-mono font-bold text-red-600 break-all">
                  {this.state.error.message || String(this.state.error)}
                </p>
                {this.state.error.stack && (
                  <pre className="text-[10px] font-mono text-gray-500 mt-2 whitespace-pre-wrap break-all">
                    {this.state.error.stack}
                  </pre>
                )}
                {this.state.errorInfo?.componentStack && (
                  <pre className="text-[9px] font-mono text-gray-400 mt-1 whitespace-pre-wrap break-all">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            )}

            <div className="pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs font-semibold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reload Application</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
