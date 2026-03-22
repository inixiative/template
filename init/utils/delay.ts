const isTest = process.env.NODE_ENV === 'test';

/**
 * Async delay that skips waiting in test environment.
 * Use this instead of raw `setTimeout` in setup tasks.
 */
export const delay = (ms: number): Promise<void> => {
  if (isTest) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
};
