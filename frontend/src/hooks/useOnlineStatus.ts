import { useEffect, useState } from 'react';

interface OnlineStatus {
  online: boolean;
  offlineGeneration: number;
}

export default function useOnlineStatus(): OnlineStatus {
  const [status, setStatus] = useState<OnlineStatus>(() => ({
    online: navigator.onLine,
    offlineGeneration: navigator.onLine ? 0 : 1,
  }));

  useEffect(() => {
    function handleOnline() {
      setStatus(current => ({ ...current, online: true }));
    }

    function handleOffline() {
      setStatus(current => ({
        online: false,
        offlineGeneration: current.online
          ? current.offlineGeneration + 1
          : current.offlineGeneration,
      }));
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return status;
}