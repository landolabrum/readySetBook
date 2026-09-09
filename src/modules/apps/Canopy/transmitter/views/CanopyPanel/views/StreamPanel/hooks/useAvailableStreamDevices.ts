import React from 'react';
import environment from '~/src/core/environment';

/**
 * Hook to fetch available streaming devices from the backend.
 *
 * Devices are sorted by memory usage (least busy first) to enable smart load balancing.
 * Results are cached with standard React Query patterns.
 */
export const useAvailableStreamDevices = () => {
  const [devices, setDevices] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const fetchDevices = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    const base = String(environment?.serviceEndpoints?.membership || '').replace(/\/+$/, '');
    const candidates = [
      base ? `${base}/streaming/devices` : null,
      '/api/streaming/devices',
    ].filter(Boolean) as string[];

    let data: any = null;

    for (const url of candidates) {
      try {
        const response = await fetch(url, { credentials: 'include' });
        if (response.ok) {
          data = await response.json();
          break;
        }
      } catch {
        // Network error on this candidate — try the next one.
      }
    }

    if (!data) {
      setError('Streaming server is unreachable. Check the backend connection and try again.');
      setDevices([]);
      setLoading(false);
      return;
    }

    const sortedDevices: any[] = data.devices || [];

    sortedDevices.sort((a: any, b: any) => {
      if (a.status !== 'online' && b.status === 'online') return 1;
      if (a.status === 'online' && b.status !== 'online') return -1;

      const aAvail = typeof a.availableMemoryMB === 'number' ? a.availableMemoryMB : -1;
      const bAvail = typeof b.availableMemoryMB === 'number' ? b.availableMemoryMB : -1;
      if (aAvail !== bAvail) return bAvail - aAvail;

      const aMemory = typeof a.memoryUsagePercent === 'number' ? a.memoryUsagePercent : 101;
      const bMemory = typeof b.memoryUsagePercent === 'number' ? b.memoryUsagePercent : 101;
      return aMemory - bMemory;
    });

    setDevices(sortedDevices);
    setLoading(false);
  }, []);

  return {
    devices,
    loading,
    error,
    fetchDevices,
    refresh: fetchDevices, // Alias for consistency
  };
};
