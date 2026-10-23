import { Component, type ReactNode } from 'react';
import { Button } from '@/components/ui';

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: unknown) { console.error('UI error', e); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="mt-2 max-w-md text-slate-400">An unexpected error occurred. Please reload the page. If the problem persists, contact support.</p>
        <Button className="mt-6" onClick={() => window.location.reload()}>Reload page</Button>
      </div>
    );
  }
}
