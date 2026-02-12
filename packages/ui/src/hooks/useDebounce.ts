import { useEffect, useState } from 'react';

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

export const useDebouncedCallback = <T extends (...args: any[]) => any>(callback: T, delay: number = 300): T => {
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  return ((...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    const id = setTimeout(() => callback(...args), delay);
    setTimeoutId(id);
  }) as T;
};
