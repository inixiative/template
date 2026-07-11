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

// Blind, webhook-style push of the event to an external system: fire-and-forget,
// no assumption anything is listening, no delivery guarantee. Distinct from the
// DB-mutation-triggered webhook hook (hooks/webhooks), which delivers against real
// WebhookSubscription rows; this is appEvent-triggered emission with no subscription
// contract. Unwired until a consumer exists — the seam keeps a future sink a drop-in.
const createSinkObserveAdapter = (): ObserveAdapter => ({
  record: () => Promise.resolve(),
});

export const observeRegistry = makeBroadcastRegistry<ObserveAdapter>();

observeRegistry.register('log', createLogObserveAdapter());
observeRegistry.register('db', createDbObserveAdapter());
observeRegistry.register('sink', createSinkObserveAdapter());
