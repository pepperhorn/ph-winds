import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ph-winds crashed', error, info);
  }

  resetBoard = () => {
    try {
      const backup = localStorage.getItem('ph-winds-board');
      if (backup != null) localStorage.setItem('ph-winds-board-backup', backup);
      localStorage.removeItem('ph-winds-board');
    } catch {
      /* ignore storage failures — still reload */
    }
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="wc-error-boundary grid min-h-screen place-items-center bg-canvas p-6">
        <div className="wc-error-boundary-card flex max-w-sm flex-col items-center gap-3 rounded-2xl border border-hairline bg-surface p-6 text-center shadow-glow">
          <p className="wc-error-boundary-title text-lg font-semibold text-ink">Something went wrong</p>
          <p className="wc-error-boundary-desc text-sm text-muted">
            The board hit an unexpected error. You can reset it and start fresh.
          </p>
          <Button variant="filled" onClick={this.resetBoard} className="btn-reset-board">
            Reset board
          </Button>
        </div>
      </div>
    );
  }
}
