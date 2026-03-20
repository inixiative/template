type RetryOptions = {
  maxRetries: number;
  delayMs: number;
  retryCondition?: (error: Error) => boolean;
  timeoutMessage?: string;
  /** Called before each retry with the current attempt number and max retries. Use to update UI. */
  onRetry?: (attempt: number, maxRetries: number) => void | Promise<void>;
};

/**
 * Retry an async operation with configurable timeout
 */
export const retryWithTimeout = async <T>(operation: () => Promise<T>, options: RetryOptions): Promise<T> => {
  const {
    maxRetries,
    delayMs,
    retryCondition = () => true,
    timeoutMessage = 'Operation timed out after maximum retries',
    onRetry,
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (!(error instanceof Error)) {
        throw error;
      }

      lastError = error;

      // Check if we should retry this error
      if (!retryCondition(error)) {
        throw error;
      }

      // If we've exhausted retries, throw timeout error
      if (attempt >= maxRetries) {
        throw new Error(`${timeoutMessage}: ${error.message}`);
      }

      // Notify caller of retry (for UI updates)
      await onRetry?.(attempt + 1, maxRetries);

      // Wait before next retry
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError || new Error(timeoutMessage);
};
