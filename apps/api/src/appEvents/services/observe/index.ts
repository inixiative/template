import type { ObserveAdapter } from '#/appEvents/types';
import { createDbObserveAdapter } from '#/appEvents/services/observe/dbAdapter';

const adapters: ObserveAdapter[] = [createDbObserveAdapter()];

export const observeAdapter: ObserveAdapter = {
  record: async (event, data) => {
    await Promise.all(adapters.map((a) => a.record(event, data)));
  },
};

export const registerObserveAdapter = (adapter: ObserveAdapter): void => {
  adapters.push(adapter);
};
