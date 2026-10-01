import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import useOnlineStatus from '../useOnlineStatus';

function StatusHarness() {
  const { online, offlineGeneration } = useOnlineStatus();
  return <span>{online ? 'online' : `offline-${offlineGeneration}`}</span>;
}

describe('useOnlineStatus', () => {
  it('tracks browser online and offline events', () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    render(<StatusHarness />);
    expect(screen.getByText('online')).toBeInTheDocument();

    act(() => window.dispatchEvent(new Event('offline')));
    expect(screen.getByText('offline-1')).toBeInTheDocument();

    act(() => window.dispatchEvent(new Event('online')));
    expect(screen.getByText('online')).toBeInTheDocument();

    act(() => window.dispatchEvent(new Event('offline')));
    expect(screen.getByText('offline-2')).toBeInTheDocument();
  });
});