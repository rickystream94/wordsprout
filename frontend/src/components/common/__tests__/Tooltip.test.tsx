import { vi, describe, it, expect } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Tooltip from '../Tooltip';

vi.mock('../Tooltip.module.css', () => ({
  default: { wrapper: 'wrapper', icon: 'icon', bubble: 'bubble' },
}));

describe('Tooltip', () => {
  it('renders children and the info icon', () => {
    const { container } = render(<Tooltip text="Helpful context"><span>Label</span></Tooltip>);
    expect(screen.getByText('Label')).toBeTruthy();
    expect(container.querySelector('[aria-hidden="true"]')).toBeTruthy();
  });

  it('renders tooltip text in a role=tooltip element', () => {
    render(<Tooltip text="Helpful context"><span>Label</span></Tooltip>);
    fireEvent.click(screen.getByText('Label').parentElement as HTMLElement);
    expect(screen.getByRole('tooltip')).toBeTruthy();
    expect(screen.getByRole('tooltip').textContent).toBe('Helpful context');
  });

  it('wrapper is focusable via tabIndex', () => {
    const { container } = render(<Tooltip text="Helpful context"><span>Label</span></Tooltip>);
    const wrapper = container.querySelector('[tabindex]') as HTMLElement;
    expect(wrapper).toBeTruthy();
    expect(wrapper.getAttribute('tabindex')).toBe('0');
  });

  it('sets data-open on click and removes it on second click', async () => {
    const user = userEvent.setup();
    const { container } = render(<Tooltip text="Helpful context"><span>Label</span></Tooltip>);
    const wrapper = container.querySelector('[tabindex]') as HTMLElement;

    await user.click(wrapper);
    expect(wrapper.getAttribute('data-open')).toBe('true');

    await user.click(wrapper);
    expect(wrapper.getAttribute('data-open')).toBeNull();
  });

  it('sets data-open on Enter keydown', async () => {
    const user = userEvent.setup();
    const { container } = render(<Tooltip text="Helpful context"><span>Label</span></Tooltip>);
    const wrapper = container.querySelector('[tabindex]') as HTMLElement;

    wrapper.focus();
    await user.keyboard('{Enter}');
    expect(wrapper.getAttribute('data-open')).toBe('true');
  });

  it('clears data-open on Escape keydown', async () => {
    const user = userEvent.setup();
    const { container } = render(<Tooltip text="Helpful context"><span>Label</span></Tooltip>);
    const wrapper = container.querySelector('[tabindex]') as HTMLElement;

    wrapper.focus();
    await user.keyboard('{Enter}');
    expect(wrapper.getAttribute('data-open')).toBe('true');

    await user.keyboard('{Escape}');
    expect(wrapper.getAttribute('data-open')).toBeNull();
  });

  it('clamps a tooltip near the right viewport edge', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.getAttribute('role') === 'tooltip') {
        return { left: 0, top: 0, right: 220, bottom: 60, width: 220, height: 60, x: 0, y: 0, toJSON: () => ({}) };
      }
      if (this.className === 'icon') {
        return { left: 300, top: 100, right: 316, bottom: 116, width: 16, height: 16, x: 300, y: 100, toJSON: () => ({}) };
      }
      return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) };
    });
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 320 });
    const user = userEvent.setup();
    const { container } = render(<Tooltip text="Helpful context"><span>Label</span></Tooltip>);

    await user.click(container.querySelector('[tabindex]') as HTMLElement);

    await waitFor(() => expect(screen.getByRole('tooltip')).toHaveStyle({ left: '88px' }));
  });

  it('places the tooltip below when there is not enough room above', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.getAttribute('role') === 'tooltip') {
        return { left: 0, top: 0, right: 180, bottom: 60, width: 180, height: 60, x: 0, y: 0, toJSON: () => ({}) };
      }
      if (this.className === 'icon') {
        return { left: 100, top: 20, right: 116, bottom: 36, width: 16, height: 16, x: 100, y: 20, toJSON: () => ({}) };
      }
      return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) };
    });
    const user = userEvent.setup();
    const { container } = render(<Tooltip text="Helpful context"><span>Label</span></Tooltip>);

    await user.click(container.querySelector('[tabindex]') as HTMLElement);

    await waitFor(() => expect(screen.getByRole('tooltip')).toHaveAttribute('data-placement', 'below'));
    expect(screen.getByRole('tooltip')).toHaveStyle({ top: '44px' });
  });
});
