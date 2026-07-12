/**
 * @atlas
 * @kind registry
 * @partOf infrastructure:observability, primitive:adapter
 * @uses primitive:appEvents, primitive:jobs
 */

import { makeBroadcastRegistry } from '@template/shared/adapter';
import { log } from '@template/shared/logger';
import type { ObserveAdapter } from '#/appEvents/types';
import { enqueueJob } from '#/jobs/enqueue';

const createLogObserveAdapter = (): ObserveAdapter => ({
  record: (event) => {
    log.info(`appEvent ${event.name}`, { actor: event.actor, data: event.data });
    return Promise.resolve();
  },
});

const createDbObserveAdapter = (): ObserveAdapter => ({
  record: async (event) => {
    await enqueueJob('recordAppEvent', {
      name: event.name,
      actor: event.actor,
      data: event.data,
    });
  },
});

export const observeRegistry = makeBroadcastRegistry<ObserveAdapter>();

observeRegistry.register('log', createLogObserveAdapter());
observeRegistry.register('db', createDbObserveAdapter());
