import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DevelopmentNotice from '../DevelopmentNotice';

vi.mock('../DevelopmentNotice.module.css', () => ({
  default: { notice: '', icon: '', message: '', dismiss: '' },
}));

describe('DevelopmentNotice', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('informs users that the instance is for development and testing', () => {
    render(<DevelopmentNotice />);

    expect(screen.getByRole('status')).toHaveTextContent(
      'This WordSprout instance is for development and testing only',
    );
  });

  it('can be dismissed and remembers the dismissal', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<DevelopmentNotice />);

    await user.click(screen.getByRole('button', { name: 'Dismiss development notice' }));

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(localStorage.getItem('ws_development_notice_dismissed')).toBe('true');

    unmount();
    render(<DevelopmentNotice />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
