/**
 * @atlas
 * @kind utils
 * @partOf primitive:shared
 * @uses none
 */
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export type RetryOptions = {
  attempts?: number;
  baseDelayMs?: number;
  isRetryable?: (error: unknown) => boolean;
  onRetry?: (error: unknown, attempt: number, waitMs: number) => void;
  sleep?: (ms: number) => Promise<void>;
};

export const withRetry = async <T>(
  fn: () => Promise<T>,
  { attempts = 3, baseDelayMs = 1000, isRetryable = () => true, onRetry, sleep: sleepFn = sleep }: RetryOptions = {},
): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isRetryable(err) || attempt === attempts - 1) throw err;
      const waitMs = baseDelayMs * 2 ** attempt;
      onRetry?.(err, attempt + 1, waitMs);
      await sleepFn(waitMs);
    }
  }
  throw lastError;
};
