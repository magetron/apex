/**
 * <Detailed url>: a glTF body/wheel. Nothing stands in while it streams (the explorer shows a
 * progress bar instead), and a failed load draws nothing and offers a retry rather than taking
 * the whole scene down.
 */
import { Component, Suspense, type ReactNode } from 'react';
import { markFailed, useModelLoad } from './load';

class Boundary extends Component<{ url: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(e: unknown) {
    console.warn('[apex] car model failed to load:', e);
    markFailed(this.props.url);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function Detailed({ url, children }: { url: string; children: ReactNode }) {
  // a retry remounts the boundary, which clears its failed state
  const attempt = useModelLoad((s) => s[url]?.attempt ?? 0);
  return (
    <Boundary key={attempt} url={url}>
      <Suspense fallback={null}>{children}</Suspense>
    </Boundary>
  );
}
