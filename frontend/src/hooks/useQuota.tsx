import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { quotaApi } from '../services/api';
import type { UserQuota } from '../types/models';

interface QuotaState {
  quota: UserQuota | null;
  remaining: number;
  isLow: boolean;
  isExhausted: boolean;
  refreshQuota: () => void;
}

const QuotaContext = createContext<QuotaState>({
  quota: null,
  remaining: Infinity,
  isLow: false,
  isExhausted: false,
  refreshQuota: () => {},
});

export function QuotaProvider({ children }: { children: ReactNode }) {
  const [quota, setQuota] = useState<UserQuota | null>(null);

  const fetchQuota = useCallback(() => {
    quotaApi.get().then(setQuota).catch(() => {
      // Non-critical — silently degrade
    });
  }, []);

  useEffect(() => {
    fetchQuota();
  }, [fetchQuota]);

  const remaining = quota
    ? quota.aiDailyEnrichmentLimit - quota.aiQuotaUsedToday
    : Infinity;
  const isLow = quota
    ? remaining <= Math.ceil(quota.aiDailyEnrichmentLimit * 0.2) && remaining > 0
    : false;
  const isExhausted = quota ? remaining <= 0 : false;

  return (
    <QuotaContext.Provider value={{ quota, remaining, isLow, isExhausted, refreshQuota: fetchQuota }}>
      {children}
    </QuotaContext.Provider>
  );
}

export function useQuota() {
  return useContext(QuotaContext);
}
