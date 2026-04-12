import { useEffect, useState } from 'react';
import { quotaApi } from '../../services/api';
import type { UserQuota } from '../../types/models';
import styles from './QuotaIndicator.module.css';

export default function QuotaIndicator() {
  const [quota, setQuota] = useState<UserQuota | null>(null);

  useEffect(() => {
    quotaApi.get().then(setQuota).catch(() => {
      // Silently fail — quota indicator is non-critical
    });
  }, []);

  if (!quota) return null;

  const remaining = quota.aiQuotaLimit - quota.aiQuotaUsedToday;
  const pct = Math.round((quota.aiQuotaUsedToday / quota.aiQuotaLimit) * 100);
  const isLow = remaining <= Math.ceil(quota.aiQuotaLimit * 0.2);
  const isExhausted = remaining <= 0;

  const resetDate = new Date(quota.aiQuotaResetAt);
  const resetLabel = resetDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`${styles.container} ${isLow ? styles.low : ''} ${isExhausted ? styles.exhausted : ''}`}>
      <span className={styles.label}>
        {isExhausted
          ? `AI quota exhausted — resets at ${resetLabel}`
          : `AI enrichments: ${remaining} / ${quota.aiQuotaLimit} remaining`}
      </span>
      <div className={styles.track} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className={styles.fill} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
