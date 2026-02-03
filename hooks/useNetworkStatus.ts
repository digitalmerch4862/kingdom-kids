
import { useState, useEffect } from 'react';

export type NetworkStatus = 'online' | 'slow' | 'offline';

export const useNetworkStatus = () => {
  const [status, setStatus] = useState<NetworkStatus>('online');

  const updateStatus = () => {
    if (!navigator.onLine) {
      setStatus('offline');
      return;
    }

    // Network Information API (Supported in Chrome/Edge/Android)
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    
    if (connection) {
      const { effectiveType, rtt } = connection;
      // Define "slow" as 3G or below, or high round-trip time (> 500ms)
      if (['slow-2g', '2g', '3g'].includes(effectiveType) || rtt > 500) {
        setStatus('slow');
      } else {
        setStatus('online');
      }
    } else {
      // Fallback if Network Information API is not supported (Safari/iOS)
      setStatus('online');
    }
  };

  useEffect(() => {
    updateStatus();

    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);

    const connection = (navigator as any).connection;
    if (connection) {
      connection.addEventListener('change', updateStatus);
    }

    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
      if (connection) {
        connection.removeEventListener('change', updateStatus);
      }
    };
  }, []);

  return status;
};
