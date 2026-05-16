import { vi, describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SearchBar from '../SearchBar';

// Mock CSS modules
vi.mock('../SearchBar.module.css', () => ({
  default: { container: '', icon: '', input: '', clear: '' },
}));

describe('SearchBar', () => {
  it('renders an input with aria-label "Search vocabulary entries"', () => {
    render(<SearchBar value="" onChange={vi.fn()} />);
    expect(screen.getByRole('searchbox', { name: /search vocabulary entries/i })).toBeTruthy();
  });

  it('displays the current value', () => {
    render(<SearchBar value="ciao" onChange={vi.fn()} />);
    expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('ciao');
  });

  it('calls onChange when user types', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(<SearchBar value="" onChange={onChange} />);
    await user.type(screen.getByRole('searchbox'), 'h');

    expect(onChange).toHaveBeenCalled();
  });

  it('does not render a clear button when value is empty', () => {
    render(<SearchBar value="" onChange={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /clear/i })).toBeNull();
  });

  it('renders a clear button when value is non-empty', () => {
    render(<SearchBar value="ciao" onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /clear/i })).toBeTruthy();
  });

  it('calls onChange with empty string when clear button is clicked', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(<SearchBar value="ciao" onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: /clear/i }));

    expect(onChange).toHaveBeenCalledWith('');
  });

  it('renders with custom placeholder', () => {
    render(<SearchBar value="" onChange={vi.fn()} placeholder="Find entry…" />);
    expect((screen.getByRole('searchbox') as HTMLInputElement).placeholder).toBe('Find entry…');
  });

  it('renders default placeholder when none provided', () => {
    render(<SearchBar value="" onChange={vi.fn()} />);
    expect((screen.getByRole('searchbox') as HTMLInputElement).placeholder).toBe('Search entries…');
  });
});
