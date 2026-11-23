import type { VcrRecorder } from '@inixiative/vcr';

export const captureInTest = <T>(
  vcr: VcrRecorder,
  method: string,
  executeLive: () => Promise<T>,
): Promise<T> =>
  process.env.NODE_ENV === 'test' ? vcr.capture(method, executeLive) : executeLive();
