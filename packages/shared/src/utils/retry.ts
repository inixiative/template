/**
 * @atlas
 * @kind utils
 * @partOf primitive:shared
 * @uses none
 */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type RetryOptions = {
  attempts?: number;
  baseDelayMs?: number;
  isRetryable?: (error: unknown) => boolean;
};

export const withRetry = async <T>(
  fn: () => Promise<T>,
  { attempts = 3, baseDelayMs = 1000, isRetryable = () => true }: RetryOptions = {},
): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isRetryable(err) || attempt === attempts - 1) throw err;
      await sleep(baseDelayMs * 2 ** attempt);
    }
  }
  throw lastError;
};
