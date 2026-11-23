import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import TagPickerDialog from '../TagPickerDialog';

vi.mock('dompurify', () => ({
  default: { sanitize: (value: string) => value },
}));

describe('TagPickerDialog', () => {
  it('shows the complete available tag list rather than truncating it', () => {
    const tags = Array.from({ length: 14 }, (_, index) => `tag-${index + 1}`);

    render(
      <TagPickerDialog
        availableTags={tags}
        selectedTags={[]}
        onApply={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getAllByRole('option')).toHaveLength(14);
    expect(screen.getByText('#tag-14')).toBeInTheDocument();
  });

  it('filters tags by the search query', async () => {
    const user = userEvent.setup();
    render(
      <TagPickerDialog
        availableTags={['food', 'formal', 'travel']}
        selectedTags={[]}
        onApply={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText('Search or create a tag'), 'foo');

    expect(screen.getByText('#food')).toBeInTheDocument();
    expect(screen.queryByText('#travel')).not.toBeInTheDocument();
  });

  it('creates a normalized tag and applies it with the selection', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(
      <TagPickerDialog
        availableTags={['food']}
        selectedTags={['food']}
        onApply={onApply}
        onCancel={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText('Search or create a tag'), 'Travel Phrases');
    await user.click(screen.getByRole('button', { name: 'Create #travel-phrases' }));
    await user.click(screen.getByRole('button', { name: 'Apply tags' }));

    expect(onApply).toHaveBeenCalledWith(['food', 'travel-phrases']);
  });

  it('discards staged selections when cancelled', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    const onCancel = vi.fn();
    render(
      <TagPickerDialog
        availableTags={['food', 'travel']}
        selectedTags={['food']}
        onApply={onApply}
        onCancel={onCancel}
      />,
    );

    await user.click(screen.getByRole('option', { name: '#travel' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledOnce();
    expect(onApply).not.toHaveBeenCalled();
  });

  it('disables unselected tags at the selection limit but permits removal', () => {
    const selectedTags = Array.from({ length: 20 }, (_, index) => `selected-${index}`);
    render(
      <TagPickerDialog
        availableTags={[...selectedTags, 'extra']}
        selectedTags={selectedTags}
        onApply={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole('option', { name: '#extra' })).toBeDisabled();
    expect(screen.getByRole('option', { name: '#selected-0' })).not.toBeDisabled();
  });
});