/**
 * @atlas
 * @kind utils
 * @partOf primitive:shared
 * @uses none
 */

const TIMED_OUT = Symbol('timedOut');

// Races one promise against a timer that resolves (it never rejects), and clears the timer either way.
// On a timeout it returns what `onTimeout` returns, so each caller picks its own fallback (or throws)
// and does its own logging there. It does not cancel the work. Promise.race subscribes to it, so a late
// rejection is handled and never becomes an unhandled rejection; a rejection that comes before the
// timeout is passed through. A budget of zero or less starts no timer: a promise that has already
// settled still wins, and a pending one times out at once.
export const settleWithin = async <T, F>(
  work: Promise<T>,
  timeoutMs: number,
  onTimeout: () => F,
): Promise<T | F> => {
  if (timeoutMs <= 0) {
    const answer = await Promise.race([work, Promise.resolve(TIMED_OUT)]);
    return answer === TIMED_OUT ? onTimeout() : (answer as T);
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const answer = await Promise.race([
      work,
      new Promise<typeof TIMED_OUT>((resolve) => {
        timer = setTimeout(() => resolve(TIMED_OUT), timeoutMs);
      }),
    ]);
    return answer === TIMED_OUT ? onTimeout() : (answer as T);
  } finally {
    clearTimeout(timer);
  }
};
