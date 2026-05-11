import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Hook for automatic polling with Page Visibility API support.
 * Pauses polling when the page is not visible and resumes when it becomes visible.
 *
 * @param callback - Function to call on each poll interval
 * @param interval - Polling interval in milliseconds (default: 60000ms)
 * @returns { isPolling: boolean }
 */
export function usePolling(callback: () => void | Promise<void>, interval: number = 60000): { isPolling: boolean } {
  const [isPolling, setIsPolling] = useState(true);
  const callbackRef = useRef(callback);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep callback ref up to date
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const startPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    intervalRef.current = setInterval(() => {
      callbackRef.current();
    }, interval);
    setIsPolling(true);
  }, [interval]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPolling(false);
  }, []);

  useEffect(() => {
    // Call immediately on mount
    callbackRef.current();

    // Start interval
    startPolling();

    // Handle visibility change
    function handleVisibilityChange() {
      if (document.hidden) {
        stopPolling();
      } else {
        // Call immediately when page becomes visible again
        callbackRef.current();
        startPolling();
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [startPolling, stopPolling]);

  return { isPolling };
}
