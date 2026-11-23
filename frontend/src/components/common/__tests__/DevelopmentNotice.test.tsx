import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DevelopmentNotice from '../DevelopmentNotice';

vi.mock('../DevelopmentNotice.module.css', () => ({
  default: { notice: '', icon: '', message: '', dismiss: '' },
}));

describe('DevelopmentNotice', () => {
  it('informs users that the instance is for development and testing', () => {
    render(<DevelopmentNotice />);

    expect(screen.getByRole('status')).toHaveTextContent(
      'This WordSprout instance is for development and testing only',
    );
  });

  it('can be dismissed for the current mount and reappears on a fresh mount', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<DevelopmentNotice />);

    await user.click(screen.getByRole('button', { name: 'Dismiss development notice' }));

    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    unmount();
    render(<DevelopmentNotice />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
