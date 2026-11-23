import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import OfflineIndicator, { OfflineStatusIcon } from '../OfflineIndicator';

vi.mock('../OfflineIndicator.module.css', () => ({
  default: {
    banner: 'banner',
    bannerIcon: 'bannerIcon',
    message: 'message',
    dismiss: 'dismiss',
    statusButton: 'statusButton',
  },
}));

describe('OfflineIndicator', () => {
  it('shows the offline synchronization message', () => {
    render(<OfflineIndicator onDismiss={vi.fn()} />);

    expect(screen.getByRole('status')).toHaveTextContent(
      'You’re offline. Changes will sync when you reconnect.',
    );
  });

  it('allows the banner to be dismissed', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<OfflineIndicator onDismiss={onDismiss} />);

    await user.click(screen.getByRole('button', { name: 'Dismiss offline notice' }));

    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('keeps an accessible header control for restoring the notice', async () => {
    const user = userEvent.setup();
    const onShowNotice = vi.fn();
    render(<OfflineStatusIcon onShowNotice={onShowNotice} />);

    await user.click(screen.getByRole('button', { name: 'Offline. Show connection notice' }));

    expect(onShowNotice).toHaveBeenCalledOnce();
  });
});