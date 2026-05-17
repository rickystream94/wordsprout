import { vi, describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Tooltip from '../Tooltip';

vi.mock('../Tooltip.module.css', () => ({
  default: { wrapper: '', icon: '', bubble: '' },
}));

describe('Tooltip', () => {
  it('renders children and the info icon', () => {
    const { container } = render(<Tooltip text="Helpful context"><span>Label</span></Tooltip>);
    expect(screen.getByText('Label')).toBeTruthy();
    expect(container.querySelector('[aria-hidden="true"]')).toBeTruthy();
  });

  it('renders tooltip text in a role=tooltip element', () => {
    render(<Tooltip text="Helpful context"><span>Label</span></Tooltip>);
    expect(screen.getByRole('tooltip')).toBeTruthy();
    expect(screen.getByRole('tooltip').textContent).toBe('Helpful context');
  });

  it('wrapper is focusable via tabIndex', () => {
    render(<Tooltip text="Helpful context"><span>Label</span></Tooltip>);
    const wrapper = screen.getByRole('tooltip').closest('[tabindex]') as HTMLElement;
    expect(wrapper).toBeTruthy();
    expect(wrapper.getAttribute('tabindex')).toBe('0');
  });

  it('sets data-open on click and removes it on second click', async () => {
    const user = userEvent.setup();
    render(<Tooltip text="Helpful context"><span>Label</span></Tooltip>);
    const wrapper = screen.getByRole('tooltip').closest('[tabindex]') as HTMLElement;

    await user.click(wrapper);
    expect(wrapper.getAttribute('data-open')).toBe('true');

    await user.click(wrapper);
    expect(wrapper.getAttribute('data-open')).toBeNull();
  });

  it('sets data-open on Enter keydown', async () => {
    const user = userEvent.setup();
    render(<Tooltip text="Helpful context"><span>Label</span></Tooltip>);
    const wrapper = screen.getByRole('tooltip').closest('[tabindex]') as HTMLElement;

    wrapper.focus();
    await user.keyboard('{Enter}');
    expect(wrapper.getAttribute('data-open')).toBe('true');
  });

  it('clears data-open on Escape keydown', async () => {
    const user = userEvent.setup();
    render(<Tooltip text="Helpful context"><span>Label</span></Tooltip>);
    const wrapper = screen.getByRole('tooltip').closest('[tabindex]') as HTMLElement;

    wrapper.focus();
    await user.keyboard('{Enter}');
    expect(wrapper.getAttribute('data-open')).toBe('true');

    await user.keyboard('{Escape}');
    expect(wrapper.getAttribute('data-open')).toBeNull();
  });
});
