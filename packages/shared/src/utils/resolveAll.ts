/**
 * @atlas
 * @kind utils
 * @partOf primitive:shared
 * @uses none
 */
export const resolveAll = async <T>(fns: (() => Promise<T>)[], concurrency?: number): Promise<T[]> => {
  if (!concurrency || concurrency >= fns.length) {
    return Promise.all(fns.map((fn) => fn()));
  }

  const results: T[] = new Array(fns.length);
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < fns.length) {
      const i = nextIndex++;
      results[i] = await fns[i]();
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
};
