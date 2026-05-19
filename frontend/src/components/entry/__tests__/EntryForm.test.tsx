import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: vi.fn(() => []),
}));

vi.mock('../../../auth/useAuth', () => ({
  useAuth: () => ({ userId: 'user-1' }),
}));

vi.mock('../../../services/db', () => ({
  getTagSuggestions: vi.fn(async () => []),
}));

vi.mock('dompurify', () => ({
  default: { sanitize: (s: string) => s },
}));

// Stub child components that would pull in heavy dependencies
vi.mock('../PartOfSpeechSelector', () => ({ default: () => null }));
vi.mock('../TagInput', () => ({ default: () => null }));
vi.mock('../ChipInput', () => ({ default: () => null }));
vi.mock('../../search/SortDropdown', () => ({ SortDropdown: () => null }));
vi.mock('../../common/Tooltip', () => ({ default: (_: { text: string; children: React.ReactNode }) => _.children }));
vi.mock('../TagManagerModal', () => ({ default: () => null }));

vi.mock('../EntryForm.module.css', () => ({
  default: {
    form: '', field: '', label: '', input: '', inputError: '', errorMsg: '',
    textarea: '', required: '', optional: '', actions: '', submitBtn: '', cancelBtn: '',
    heading: '', advanced: '', advancedToggle: '', advancedContent: '', sectionHeading: '',
    divider: '', enrichInput: '', labelRow: '', manageTagsBtn: '', warningBox: '',
    warningMsg: '', warningPrompt: '',
  },
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import React from 'react';
import EntryForm from '../EntryForm';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function renderForm(onDone = vi.fn()) {
  render(<EntryForm onDone={onDone} />);
}

async function typeInField(label: RegExp | string, value: string) {
  const user = userEvent.setup();
  const input = screen.getByLabelText(label) as HTMLInputElement;
  await user.clear(input);
  if (value) await user.type(input, value);
  return input;
}

async function blurField(label: RegExp | string, value: string) {
  const input = await typeInField(label, value);
  fireEvent.blur(input);
  return input;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('EntryForm — real-time inline validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sourceText field', () => {
    it('shows no error on initial render', () => {
      renderForm();
      expect(screen.queryByText(/only letters/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/required/i)).not.toBeInTheDocument();
    });

    it('shows required error after blurring an empty field', () => {
      renderForm();
      const input = screen.getByLabelText(/word \/ phrase/i) as HTMLInputElement;
      fireEvent.blur(input);
      expect(screen.getByText(/word or phrase is required/i)).toBeInTheDocument();
    });

    it('shows allowlist error after blurring a field with invalid chars', async () => {
      renderForm();
      await blurField(/word \/ phrase/i, 'hello@world');
      expect(screen.getByText(/only letters/i)).toBeInTheDocument();
    });

    it('clears the error when user types valid content after a blur error', async () => {
      renderForm();
      // First blur with invalid content to trigger error
      const input = await blurField(/word \/ phrase/i, 'bad@input');
      expect(screen.getByText(/only letters/i)).toBeInTheDocument();
      // Now type valid content — error should clear
      fireEvent.change(input, { target: { value: 'hello' } });
      expect(screen.queryByText(/only letters/i)).not.toBeInTheDocument();
    });

    it('shows error while typing invalid chars once the field has been touched', async () => {
      renderForm();
      // Touch the field first (blur with valid content)
      const input = await blurField(/word \/ phrase/i, 'hello');
      expect(screen.queryByText(/only letters/i)).not.toBeInTheDocument();
      // Now type an invalid char — error should appear immediately
      fireEvent.change(input, { target: { value: 'hello@' } });
      expect(screen.getByText(/only letters/i)).toBeInTheDocument();
    });

    it('does not show an error while typing before the field has been blurred', async () => {
      renderForm();
      const input = screen.getByLabelText(/word \/ phrase/i) as HTMLInputElement;
      // Type invalid content without blurring first
      fireEvent.change(input, { target: { value: 'bad@input' } });
      expect(screen.queryByText(/only letters/i)).not.toBeInTheDocument();
    });
  });

  describe('targetText field', () => {
    it('shows allowlist error after blurring with invalid chars', async () => {
      renderForm();
      await blurField(/translation/i, 'ciao@');
      expect(screen.getByText(/only letters/i)).toBeInTheDocument();
    });

    it('clears the error when field is emptied (targetText is optional)', async () => {
      renderForm();
      const input = await blurField(/translation/i, 'bad@input');
      expect(screen.getByText(/only letters/i)).toBeInTheDocument();
      fireEvent.change(input, { target: { value: '' } });
      expect(screen.queryByText(/only letters/i)).not.toBeInTheDocument();
    });

    it('clears the error when user types valid content after a blur error', async () => {
      renderForm();
      const input = await blurField(/translation/i, 'bad@input');
      expect(screen.getByText(/only letters/i)).toBeInTheDocument();
      fireEvent.change(input, { target: { value: 'ciao' } });
      expect(screen.queryByText(/only letters/i)).not.toBeInTheDocument();
    });
  });

  describe('submit still validates everything', () => {
    it('blocks submit and shows required error even if sourceText was never blurred', async () => {
      const onDone = vi.fn();
      render(<EntryForm onDone={onDone} />);
      const form = screen.getByRole('button', { name: /add entry/i }).closest('form')!;
      fireEvent.submit(form);
      expect(screen.getByText(/word or phrase is required/i)).toBeInTheDocument();
      expect(onDone).not.toHaveBeenCalled();
    });
  });
});
