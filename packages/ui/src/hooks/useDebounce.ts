/**
 * @atlas
 * @kind hook
 * @partOf primitive:ui
 * @uses none
 */
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Debounce belongs ONLY on inputs that hit the backend — a network search, a fetch-triggering field.
 * Front-end in-memory filtering of an already-loaded list stays undebounced: just filter. A debounce on a
 * local filter adds latency for nothing, and the next consumer cargo-cults it.
 */
export const useDebounce = <T>(value: T, delay: number = 300): T => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
};

// biome-ignore lint/suspicious/noExplicitAny: generic callback constraint — any[] required to match any function signature
export const useDebouncedCallback = <T extends (...args: any[]) => any>(callback: T, delay: number = 300): T => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  const delayRef = useRef(delay);
  delayRef.current = delay;

  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  // Stable function identity — never changes across renders. Refs track
  // the current callback / delay so the debounced function never stales.
  return useCallback(
    ((...args: Parameters<T>) => {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => callbackRef.current(...args), delayRef.current);
    }) as T,
    [],
  );
};
