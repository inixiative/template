/**
 * @atlas
 * @kind utils
 * @partOf primitive:shared
 * @uses none
 */

const POLL_MS = 5;

export const waitFor = async (
  condition: () => boolean | Promise<boolean>,
  timeoutMs = 3000,
): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  while (!(await condition())) {
    if (Date.now() > deadline)
      throw new Error(`waitFor: condition still false after ${timeoutMs}ms`);
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
};
