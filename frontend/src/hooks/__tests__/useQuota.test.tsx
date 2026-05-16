import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuotaProvider, useQuota } from '../useQuota';
import type { UserQuota } from '../../types/models';

// ─── Mock API ─────────────────────────────────────────────────────────────────

const { mockQuotaGet } = vi.hoisted(() => ({ mockQuotaGet: vi.fn() }));

vi.mock('../../services/api', () => ({
  quotaApi: { get: mockQuotaGet },
}));

// ─── Test consumer ─────────────────────────────────────────────────────────────

function TestConsumer() {
  const { quota, remaining, isLow, isExhausted, refreshQuota } = useQuota();
  return (
    <div>
      <span data-testid="quota">{quota ? JSON.stringify(quota) : 'null'}</span>
      <span data-testid="remaining">{remaining === Infinity ? 'Infinity' : remaining}</span>
      <span data-testid="isLow">{String(isLow)}</span>
      <span data-testid="isExhausted">{String(isExhausted)}</span>
      <button onClick={refreshQuota}>Refresh</button>
    </div>
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('QuotaProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows null quota initially then populates after fetch', async () => {
    const mockQuota: UserQuota = {
      aiQuotaUsedToday: 5,
      aiDailyEnrichmentLimit: 20,
      aiQuotaResetAt: new Date(Date.now() + 86400000).toISOString(),
    };
    mockQuotaGet.mockResolvedValue(mockQuota);

    render(
      <QuotaProvider>
        <TestConsumer />
      </QuotaProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('quota').textContent).not.toBe('null');
    });
  });

  it('calculates remaining as limit minus used', async () => {
    const mockQuota: UserQuota = {
      aiQuotaUsedToday: 15,
      aiDailyEnrichmentLimit: 20,
      aiQuotaResetAt: new Date(Date.now() + 86400000).toISOString(),
    };
    mockQuotaGet.mockResolvedValue(mockQuota);

    render(
      <QuotaProvider>
        <TestConsumer />
      </QuotaProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('remaining').textContent).toBe('5');
    });
  });

  it('sets isLow when remaining <= 20% of limit', async () => {
    const mockQuota: UserQuota = {
      aiQuotaUsedToday: 17, // remaining=3, 20% of 20=4, so 3 <= 4 → isLow
      aiDailyEnrichmentLimit: 20,
      aiQuotaResetAt: new Date(Date.now() + 86400000).toISOString(),
    };
    mockQuotaGet.mockResolvedValue(mockQuota);

    render(
      <QuotaProvider>
        <TestConsumer />
      </QuotaProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('isLow').textContent).toBe('true');
    });
  });

  it('sets isExhausted when remaining <= 0', async () => {
    const mockQuota: UserQuota = {
      aiQuotaUsedToday: 20,
      aiDailyEnrichmentLimit: 20,
      aiQuotaResetAt: new Date(Date.now() + 86400000).toISOString(),
    };
    mockQuotaGet.mockResolvedValue(mockQuota);

    render(
      <QuotaProvider>
        <TestConsumer />
      </QuotaProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('isExhausted').textContent).toBe('true');
    });
  });

  it('silently degrades when quota fetch fails', async () => {
    mockQuotaGet.mockRejectedValue(new Error('Network error'));

    render(
      <QuotaProvider>
        <TestConsumer />
      </QuotaProvider>,
    );

    // Should still render without throwing
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByTestId('quota').textContent).toBe('null');
    expect(screen.getByTestId('remaining').textContent).toBe('Infinity');
  });

  it('re-fetches quota when refreshQuota is called', async () => {
    mockQuotaGet.mockResolvedValue({
      aiQuotaUsedToday: 5,
      aiDailyEnrichmentLimit: 20,
      aiQuotaResetAt: new Date(Date.now() + 86400000).toISOString(),
    });
    const user = userEvent.setup();

    render(
      <QuotaProvider>
        <TestConsumer />
      </QuotaProvider>,
    );

    await waitFor(() => expect(mockQuotaGet).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole('button', { name: 'Refresh' }));

    await waitFor(() => expect(mockQuotaGet).toHaveBeenCalledTimes(2));
  });
});
