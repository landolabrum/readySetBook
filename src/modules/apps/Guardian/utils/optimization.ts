import { useCallback, useEffect, useRef, useState } from "react";

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export function useBatchedState<T>(
  initialState: T
): [T, (updater: Partial<T>) => void] {
  const [state, setState] = useState(initialState);
  const pendingUpdates = useRef<Partial<T>>({});
  const rafId = useRef<number | null>(null);

  const batchedSetState = useCallback((updates: Partial<T>) => {
    pendingUpdates.current = { ...pendingUpdates.current, ...updates };

    if (rafId.current === null) {
      rafId.current = requestAnimationFrame(() => {
        setState((prev) => ({ ...prev, ...pendingUpdates.current }));
        pendingUpdates.current = {};
        rafId.current = null;
      });
    }
  }, []);

  useEffect(() => {
    return () => {
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, []);

  return [state, batchedSetState];
}
