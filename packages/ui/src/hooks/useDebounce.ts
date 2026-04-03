import { useEffect, useRef, useState } from 'react';

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

  // Cleanup on unmount.
  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  return ((...args: Parameters<T>) => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => callbackRef.current(...args), delay);
  }) as T;
};
