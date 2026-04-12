import { Component, type ErrorInfo, type ReactNode } from 'react';
import styles from './ErrorBoundary.module.css';

interface Props {
  children: ReactNode;
  fallbackLabel?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className={styles.container} role="alert">
          <div className={styles.icon} aria-hidden="true">⚠️</div>
          <h2 className={styles.heading}>Something went wrong</h2>
          <p className={styles.description}>
            {this.props.fallbackLabel ?? 'An unexpected error occurred in this part of the app.'}
          </p>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.retryBtn}
              onClick={this.handleReset}
            >
              Try again
            </button>
            <button
              type="button"
              className={styles.reloadBtn}
              onClick={() => window.location.reload()}
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
