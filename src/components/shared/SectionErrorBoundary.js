'use client';

import { Component } from 'react';
import SectionErrorFallback from '@/components/shared/SectionErrorFallback';
import { reportClientError } from '@/components/shared/clientErrorDisplay';

/**
 * Catches render errors in a subtree so the rest of the app (e.g. AppShell nav) keeps working.
 */
export class SectionErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    reportClientError(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    const { error } = this.state;
    if (!error) {
      return this.props.children;
    }

    const { fallback: Fallback, title, showReload = false, fallbackClassName } = this.props;

    if (Fallback) {
      return <Fallback error={error} reset={this.handleReset} />;
    }

    return (
      <SectionErrorFallback
        error={error}
        onRetry={this.handleReset}
        title={title}
        showReload={showReload}
        className={fallbackClassName}
      />
    );
  }
}
