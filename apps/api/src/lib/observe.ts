import { makeBroadcastRegistry } from '@template/shared/adapter';
import type { AppEventPayload, ObserveAdapter, ObserveData } from '#/appEvents/types';
import { enqueueJob } from '#/jobs/enqueue';

const createDbObserveAdapter = (): ObserveAdapter => ({
  record: async (event: AppEventPayload, data: ObserveData) => {
    await enqueueJob('recordAppEvent', {
      name: event.name,
      actor: event.actor,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      data,
    });
  },
});

export const observeRegistry = makeBroadcastRegistry<ObserveAdapter>();

observeRegistry.register('db', createDbObserveAdapter());
