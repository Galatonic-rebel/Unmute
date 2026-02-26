import { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackDescription?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const { fallbackTitle = 'Something went wrong', fallbackDescription } = this.props;

      return (
        <div
          className="relative w-full rounded-2xl overflow-hidden border border-white/10 flex items-center justify-center bg-black/30 backdrop-blur-xl"
          style={{ aspectRatio: '16/10' }}
          data-testid="error-boundary-fallback"
          role="alert"
        >
          <div className="text-center px-8 max-w-md">
            <AlertCircle className="w-10 h-10 text-red-400/70 mx-auto mb-4" />
            <p className="text-white/70 text-base font-semibold mb-2" data-testid="text-error-title">
              {fallbackTitle}
            </p>
            <p className="text-white/40 text-sm mb-1" data-testid="text-error-description">
              {fallbackDescription ?? 'An unexpected error occurred in this component.'}
            </p>
            {this.state.error && (
              <p className="text-white/20 text-xs mt-2 break-words" data-testid="text-error-details">
                {this.state.error.message}
              </p>
            )}
            <Button
              variant="ghost"
              onClick={this.handleReset}
              className="mt-4 text-white/60"
              data-testid="button-error-retry"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
